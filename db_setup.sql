-- =============================================================================
--  Database bootstrap for Playdolar
--  Objetivos:
--    - Estrutura mínima para perfis e transações
--    - RLS segura (dono vs admin)
--    - Restrições para evitar abuso (is_admin/expiry)
--    - Economia de espaço: histórico limitado a 50 por usuário
-- =============================================================================

-- EXTENSIONS ------------------------------------------------------------------
create extension if not exists pgcrypto;

-- TYPES -----------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'transaction_type') then
    create type transaction_type as enum ('WIN','LOSS','DEPOSIT','RESET');
  end if;
end$$;

-- TABLES ----------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz default timezone('utc'::text, now()) not null,
  email text,
  initial_balance numeric default 1000.00 check (initial_balance >= 0),
  current_balance numeric default 1000.00 check (current_balance >= 0),
  risk_percentage numeric default 2.0 check (risk_percentage >= 0 and risk_percentage <= 100),
  subscription_expiry bigint default 0,
  is_admin boolean default false
);

create table if not exists public.transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type transaction_type not null,
  amount numeric not null check (amount >= 0),
  balance_after numeric not null check (balance_after >= 0),
  timestamp bigint not null,
  mode text not null,
  note text,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.planilha_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_percent numeric not null default 12 check (daily_percent >= 0 and daily_percent <= 100),
  entries_per_day integer not null default 12 check (entries_per_day >= 1 and entries_per_day <= 30),
  cycles integer not null default 15 check (cycles >= 1 and cycles <= 60),
  progress jsonb,
  updated_at timestamptz default timezone('utc'::text, now()) not null
);

create table if not exists public.payment_sessions (
  id uuid default gen_random_uuid() primary key,
  billing_id text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending',
  amount_cents integer,
  provider_customer_id text,
  provider_subscription_id text,
  paid_at timestamptz,
  access_granted_at timestamptz,
  created_at timestamptz default timezone('utc'::text, now()) not null
);

alter table if exists public.payment_sessions
  add column if not exists provider_customer_id text;

alter table if exists public.payment_sessions
  add column if not exists provider_subscription_id text;

alter table if exists public.payment_sessions
  add column if not exists access_granted_at timestamptz;

-- INDEXES ---------------------------------------------------------------------
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_user_time on public.transactions(user_id, timestamp desc);
create index if not exists idx_planilha_state_user_id on public.planilha_state(user_id);
create index if not exists idx_payment_sessions_user_id on public.payment_sessions(user_id);
create index if not exists idx_payment_sessions_billing_id on public.payment_sessions(billing_id);
create index if not exists idx_payment_sessions_customer_id on public.payment_sessions(provider_customer_id);
create index if not exists idx_payment_sessions_subscription_id on public.payment_sessions(provider_subscription_id);

-- ADMIN HELPER ----------------------------------------------------------------
create or replace function public.is_admin(p_user uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_user
      and p.is_admin = true
  );
$$;

-- RPC: CHECK EMAIL EXISTS (signup validation) --------------------------------
create or replace function public.is_email_taken(p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where lower(email) = lower(trim(p_email))
  );
$$;

-- TRIGGER: ENFORCE SAFE PROFILE UPDATE ---------------------------------------
create or replace function public.enforce_profile_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) and auth.role() <> 'service_role' then
    -- Bloqueia usuário comum de alterar is_admin ou subscription_expiry
    if new.is_admin is distinct from old.is_admin then
      raise exception 'Permission denied to change is_admin';
    end if;
    if new.subscription_expiry is distinct from old.subscription_expiry then
      raise exception 'Permission denied to change subscription_expiry';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_update on public.profiles;
create trigger trg_enforce_profile_update
before update on public.profiles
for each row execute procedure public.enforce_profile_update();

-- TRIGGER: AUTO-TRIM TRANSACTIONS (mantém 50 últimas) ------------------------
create or replace function public.trim_transactions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.transactions
  where id in (
    select id from public.transactions
    where user_id = new.user_id
    order by timestamp desc
    offset 50
  );
  return new;
end;
$$;

drop trigger if exists on_transaction_insert on public.transactions;
create trigger on_transaction_insert
after insert on public.transactions
for each row execute procedure public.trim_transactions();

-- RPC: ADMIN EXPIRE USER NOW --------------------------------------------------
create or replace function public.admin_expire_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;
  update public.profiles
  set subscription_expiry = extract(epoch from now()) * 1000
  where id = p_target;
end;
$$;

-- RPC: ADMIN ADD DAYS TO USER -------------------------------------------------
create or replace function public.admin_add_days(p_target uuid, p_days integer default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  base_expiry bigint;
  new_expiry bigint;
  days_ms bigint;
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;

  -- Converte dias para milissegundos em bigint para evitar overflow de integer
  days_ms := (p_days::bigint) * 24 * 60 * 60 * 1000;

  select case when subscription_expiry > (extract(epoch from now()) * 1000)::bigint
              then subscription_expiry
              else (extract(epoch from now()) * 1000)::bigint end
    into base_expiry
  from public.profiles where id = p_target;

  new_expiry := base_expiry + days_ms;

  update public.profiles
  set subscription_expiry = new_expiry
  where id = p_target;
end;
$$;

-- RPC: ADMIN PURGE USER (perfil + transações + auth.users) --------------------
create or replace function public.admin_purge_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    raise exception 'Not allowed';
  end if;
  -- Evita autoexclusão acidental
  if p_target = auth.uid() then
    raise exception 'Cannot delete self';
  end if;

  delete from public.transactions where user_id = p_target;
  delete from public.profiles where id = p_target;
  -- Se o papel do proprietário permitir, remove também do auth.users
  delete from auth.users where id = p_target;
end;
$$;

-- TRIGGER: HANDLE NEW USER ----------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, subscription_expiry)
  values (new.id, new.email, 0)
  on conflict (id) do update
  set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- RLS -------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.transactions enable row level security;
alter table public.planilha_state enable row level security;
alter table public.payment_sessions enable row level security;

-- POLICIES: PROFILES
drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_select_admin" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
drop policy if exists "profiles_delete_admin" on public.profiles;

create policy "profiles_select_own"
on public.profiles for select
using (auth.uid() = id);

create policy "profiles_update_own"
on public.profiles for update
using (auth.uid() = id)
with check (auth.uid() = id and is_admin = false);

create policy "profiles_select_admin"
on public.profiles for select
using (public.is_admin(auth.uid()));

create policy "profiles_update_admin"
on public.profiles for update
using (public.is_admin(auth.uid()))
with check (public.is_admin(auth.uid()));

create policy "profiles_delete_admin"
on public.profiles for delete
using (public.is_admin(auth.uid()));

-- POLICIES: TRANSACTIONS
drop policy if exists "transactions_select_own" on public.transactions;
drop policy if exists "transactions_insert_own" on public.transactions;
drop policy if exists "transactions_delete_own" on public.transactions;
drop policy if exists "transactions_select_admin" on public.transactions;
drop policy if exists "transactions_delete_admin" on public.transactions;

create policy "transactions_select_own"
on public.transactions for select
using (auth.uid() = user_id);

create policy "transactions_insert_own"
on public.transactions for insert
with check (auth.uid() = user_id);

create policy "transactions_delete_own"
on public.transactions for delete
using (auth.uid() = user_id);

create policy "transactions_select_admin"
on public.transactions for select
using (public.is_admin(auth.uid()));

create policy "transactions_delete_admin"
on public.transactions for delete
using (public.is_admin(auth.uid()));

-- POLICIES: PLANILHA_STATE
drop policy if exists "planilha_select_own" on public.planilha_state;
drop policy if exists "planilha_insert_own" on public.planilha_state;
drop policy if exists "planilha_update_own" on public.planilha_state;
drop policy if exists "planilha_select_admin" on public.planilha_state;

create policy "planilha_select_own"
on public.planilha_state for select
using (auth.uid() = user_id);

create policy "planilha_insert_own"
on public.planilha_state for insert
with check (auth.uid() = user_id);

create policy "planilha_update_own"
on public.planilha_state for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "planilha_select_admin"
on public.planilha_state for select
using (public.is_admin(auth.uid()));

-- GRANTS (minimos) ------------------------------------------------------------
grant usage on schema public to anon, authenticated;

revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon;
revoke all on all sequences in schema public from authenticated;
revoke all on all functions in schema public from anon;
revoke all on all functions in schema public from authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, delete on public.transactions to authenticated;
grant select, insert, update on public.planilha_state to authenticated;
grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_email_taken(text) to anon, authenticated;
grant execute on function public.admin_expire_user(uuid) to authenticated;
grant execute on function public.admin_add_days(uuid, integer) to authenticated;
grant execute on function public.admin_purge_user(uuid) to authenticated;

-- Se usar funções/edge para admin com service role, conceda separadamente.

-- BACKFILL --------------------------------------------------------------------
insert into public.profiles (id, email, subscription_expiry)
select u.id, u.email, 0
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
