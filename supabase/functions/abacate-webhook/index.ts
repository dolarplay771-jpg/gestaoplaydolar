import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const textResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: corsHeaders });

const normalizeStatus = (status?: string) => (status || "PENDING").toUpperCase();
const days30 = 30 * 24 * 60 * 60 * 1000;

const parseUserIdFromExternalId = (value: unknown) => {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^playdolar__([0-9a-fA-F-]{36})__\d+$/);
  return match?.[1] ?? "";
};

const resolveGrantedAt = (sessionRow: any) => {
  if (!sessionRow) return null;
  if (sessionRow.access_granted_at) return sessionRow.access_granted_at;
  if (normalizeStatus(sessionRow.status) === "PAID" && sessionRow.paid_at) return sessionRow.paid_at;
  return null;
};

const findSessionOwner = async (
  supabaseAdmin: any,
  args: { checkoutId?: string; customerId?: string; subscriptionId?: string },
) => {
  if (args.checkoutId) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("id, user_id, status, paid_at, access_granted_at, amount_cents, provider_customer_id, provider_subscription_id")
      .eq("billing_id", args.checkoutId)
      .maybeSingle();
    if (data) return data;
  }

  if (args.subscriptionId) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("id, user_id, status, paid_at, access_granted_at, amount_cents, provider_customer_id, provider_subscription_id")
      .eq("provider_subscription_id", args.subscriptionId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  if (args.customerId) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("id, user_id, status, paid_at, access_granted_at, amount_cents, provider_customer_id, provider_subscription_id")
      .eq("provider_customer_id", args.customerId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
};

const grantAccessIfNeeded = async (supabaseAdmin: any, sessionRow: any) => {
  const alreadyGrantedAt = resolveGrantedAt(sessionRow);
  if (alreadyGrantedAt) {
    return { grantedAt: alreadyGrantedAt, granted: false };
  }

  const { data: profile, error: profileFetchError } = await supabaseAdmin
    .from("profiles")
    .select("subscription_expiry")
    .eq("id", sessionRow.user_id)
    .maybeSingle();
  if (profileFetchError) {
    throw new Error(profileFetchError.message);
  }

  const now = Date.now();
  const currentExpiry =
    profile?.subscription_expiry && profile.subscription_expiry > now
      ? profile.subscription_expiry
      : now;
  const newExpiry = currentExpiry + days30;

  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .update({ subscription_expiry: newExpiry })
    .eq("id", sessionRow.user_id);
  if (profileUpdateError) {
    throw new Error(profileUpdateError.message);
  }

  return { grantedAt: new Date().toISOString(), granted: true };
};

const toBase64 = (bytes: Uint8Array) => {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const timingSafeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
};

const verifySignature = async (payload: string, signature: string, key: string) => {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
  const expected = toBase64(new Uint8Array(signed));
  return timingSafeEqual(expected, signature);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return textResponse("ok");
  }

  const url = new URL(req.url);
  const webhookSecret = Deno.env.get("ABACATEPAY_WEBHOOK_SECRET") ?? "";
  const secretFromUrl = url.searchParams.get("webhookSecret") ?? "";
  if (webhookSecret && secretFromUrl !== webhookSecret) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  if (req.method === "GET" || req.method === "HEAD") {
    return textResponse("ok");
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const publicKey = Deno.env.get("ABACATEPAY_PUBLIC_KEY") ?? "";

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ error: "Missing server configuration" }, 500);
  }

  const rawBody = await req.text();
  if (!rawBody || rawBody.trim().length === 0) {
    return textResponse("ok");
  }
  const signature = req.headers.get("X-Webhook-Signature") ?? "";

  if (publicKey) {
    if (!signature) {
      return jsonResponse({ error: "Missing signature" }, 400);
    }
    const validSignature = await verifySignature(rawBody, signature, publicKey);
    if (!validSignature) {
      return jsonResponse({ error: "Invalid signature" }, 401);
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  const eventName = event?.event ?? event?.type ?? "";
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (eventName === "billing.paid") {
    const billingId =
      event?.data?.billing?.id ??
      event?.data?.payment?.billingId ??
      event?.data?.payment?.billing?.id ??
      event?.data?.pixQrCode?.billingId ??
      "";

    if (!billingId) {
      return textResponse("ok");
    }

    const sessionRow = await findSessionOwner(supabaseAdmin, { checkoutId: billingId });
    if (!sessionRow) {
      return textResponse("ok");
    }

    let grantedAt: string | null = null;
    try {
      const grantResult = await grantAccessIfNeeded(supabaseAdmin, sessionRow);
      grantedAt = grantResult.grantedAt;
    } catch (error: any) {
      return jsonResponse(
        { error: "Failed to update subscription", details: error?.message ?? String(error) },
        500,
      );
    }

    const { error: sessionUpdateError } = await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "PAID",
        paid_at: sessionRow.paid_at ?? new Date().toISOString(),
        access_granted_at: grantedAt ?? sessionRow.paid_at ?? new Date().toISOString(),
      })
      .eq("id", sessionRow.id);
    if (sessionUpdateError) {
      return jsonResponse({ error: "Failed to update payment session", details: sessionUpdateError.message }, 500);
    }

    return textResponse("ok");
  }

  if (eventName === "subscription.completed" || eventName === "subscription.renewed") {
    const checkoutId = event?.data?.checkout?.id ?? "";
    const checkoutExternalId = event?.data?.checkout?.externalId ?? "";
    const customerId = event?.data?.customer?.id ?? event?.data?.checkout?.customerId ?? "";
    const subscriptionId = event?.data?.subscription?.id ?? "";
    const amountCents = Number(
      event?.data?.payment?.amount ??
      event?.data?.checkout?.amount ??
      0,
    );

    if (!checkoutId) {
      return textResponse("ok");
    }

    let sessionRow = await findSessionOwner(supabaseAdmin, {
      checkoutId,
      customerId,
      subscriptionId,
    });

    let ownerUserId = sessionRow?.user_id ?? "";
    if (!ownerUserId) {
      ownerUserId = parseUserIdFromExternalId(checkoutExternalId);
    }

    if (!sessionRow && ownerUserId) {
      const { data: insertedRow, error: insertError } = await supabaseAdmin
        .from("payment_sessions")
        .insert({
          billing_id: checkoutId,
          user_id: ownerUserId,
          status: "PENDING",
          amount_cents: Number.isFinite(amountCents) ? amountCents : null,
          provider_customer_id: customerId || null,
          provider_subscription_id: subscriptionId || null,
        })
        .select("id, user_id, status, paid_at, access_granted_at, amount_cents, provider_customer_id, provider_subscription_id")
        .maybeSingle();

      if (insertError) {
        const existingRow = await findSessionOwner(supabaseAdmin, { checkoutId });
        if (!existingRow) {
          return jsonResponse({ error: "Failed to store payment session", details: insertError.message }, 500);
        }
        sessionRow = existingRow;
      } else {
        sessionRow = insertedRow;
      }
    }

    if (!sessionRow) {
      return textResponse("ok");
    }

    let grantedAt: string | null = null;
    try {
      const grantResult = await grantAccessIfNeeded(supabaseAdmin, sessionRow);
      grantedAt = grantResult.grantedAt;
    } catch (error: any) {
      return jsonResponse(
        { error: "Failed to update subscription", details: error?.message ?? String(error) },
        500,
      );
    }

    const { error: sessionUpdateError } = await supabaseAdmin
      .from("payment_sessions")
      .update({
        status: "PAID",
        paid_at: sessionRow.paid_at ?? new Date().toISOString(),
        access_granted_at: grantedAt ?? resolveGrantedAt(sessionRow) ?? new Date().toISOString(),
        amount_cents: Number.isFinite(amountCents) ? amountCents : sessionRow.amount_cents,
        provider_customer_id: customerId || sessionRow.provider_customer_id || null,
        provider_subscription_id: subscriptionId || sessionRow.provider_subscription_id || null,
      })
      .eq("id", sessionRow.id);
    if (sessionUpdateError) {
      return jsonResponse({ error: "Failed to update payment session", details: sessionUpdateError.message }, 500);
    }

    return textResponse("ok");
  }

  return textResponse("ok");
});
