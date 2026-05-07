import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const textResponse = (body: string, status = 200) =>
  new Response(body, { status, headers: corsHeaders });

const normalizeStatus = (status?: string) => (status || "PENDING").toUpperCase();
const paidStatuses = new Set(["PAID", "ACTIVE", "APPROVED", "COMPLETED", "CONFIRMED", "RECEIVED"]);
const days30 = 30 * 24 * 60 * 60 * 1000;

const isPaidStatus = (status?: string) => paidStatuses.has(normalizeStatus(status));

const resolveGrantedAt = (sessionRow: any) => {
  if (!sessionRow) return null;
  if (sessionRow.access_granted_at) return sessionRow.access_granted_at;
  if (normalizeStatus(sessionRow.status) === "PAID" && sessionRow.paid_at) return sessionRow.paid_at;
  return null;
};

const findBillingById = (payload: any, billingId: string) => {
  const candidates = [
    payload?.data,
    payload?.data?.billings,
    payload?.data?.items,
    payload?.billings,
    payload?.items,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      const match = candidate.find((item: any) => item?.id === billingId);
      if (match) return match;
    }
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
  const currentExpiryRaw = Number(profile?.subscription_expiry ?? 0);
  const baseExpiry = Number.isFinite(currentExpiryRaw) && currentExpiryRaw > now
    ? currentExpiryRaw
    : now;
  const newExpiry = baseExpiry + days30;

  const { error: profileUpdateError } = await supabaseAdmin
    .from("profiles")
    .update({ subscription_expiry: newExpiry })
    .eq("id", sessionRow.user_id);

  if (profileUpdateError) {
    throw new Error(profileUpdateError.message);
  }

  return { grantedAt: new Date().toISOString(), granted: true };
};

const fetchSubscriptionCheckout = async (billingId: string, apiKey: string) => {
  const response = await fetch(
    `https://api.abacatepay.com/v2/subscriptions/list?id=${encodeURIComponent(billingId)}&limit=1`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.success === false || json?.error) {
    return { found: false, error: json?.error ?? "Failed to list subscriptions", raw: json };
  }

  const items = Array.isArray(json?.data) ? json.data : [];
  const match = items.find((item: any) => item?.id === billingId) ?? items[0] ?? null;
  return {
    found: !!match,
    status: match?.status ?? null,
    customerId: match?.customerId ?? null,
    amount: match?.amount ?? null,
    raw: json,
  };
};

const fetchBillingStatusFromList = async (billingId: string, apiKey: string) => {
  const response = await fetch("https://api.abacatepay.com/v1/billing/list", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.error) {
    return { error: json?.error ?? "Failed to list billing", raw: json };
  }

  const match = findBillingById(json, billingId);
  return {
    status: match?.status ?? null,
    raw: json,
  };
};

const fetchPixStatus = async (pixId: string, apiKey: string) => {
  const response = await fetch(
    `https://api.abacatepay.com/v1/pixQrCode/check?id=${encodeURIComponent(pixId)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    },
  );

  const json = await response.json().catch(() => ({}));
  if (!response.ok || json?.error) {
    return { error: json?.error ?? "Failed to check pix status", raw: json };
  }

  return {
    status: json?.data?.status,
    expiresAt: json?.data?.expiresAt,
    raw: json,
  };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return textResponse("ok");
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const requestOrigin = new URL(req.url).origin;
  const supabaseUrlEnv = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseUrl = supabaseUrlEnv || requestOrigin;
  const apikeyHeader = req.headers.get("apikey") ?? "";
  const supabaseAnonKeyEnv = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const supabaseAnonKey = apikeyHeader || supabaseAnonKeyEnv;
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const abacatePayApiKey = Deno.env.get("ABACATEPAY_API_KEY") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !abacatePayApiKey) {
    return jsonResponse({ error: "Missing server configuration" }, 500);
  }

  const payload = await req.json().catch(() => ({}));

  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization") ?? "";
  const tokenMatch = authHeader.match(/^Bearer\s+(.+)$/i);
  const tokenFromHeader = tokenMatch?.[1]?.trim() ?? "";
  const tokenFromBody = typeof (payload as any)?.token === "string" ? (payload as any).token.trim() : "";
  const token = tokenFromHeader || tokenFromBody;

  if (!token) {
    return jsonResponse({ error: "Missing bearer token" }, 401);
  }

  if (token.split(".").length < 3) {
    return jsonResponse({ error: "Invalid bearer token format" }, 401);
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
  if (userError || !userData?.user) {
    return jsonResponse({ error: "Unauthorized", details: userError?.message ?? null }, 401);
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

  const billingIdFromBody =
    typeof (payload as any)?.billingId === "string"
      ? (payload as any).billingId.trim()
      : typeof (payload as any)?.id === "string"
      ? (payload as any).id.trim()
      : "";

  let sessionRow: any = null;
  if (billingIdFromBody) {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("id, user_id, status, billing_id, amount_cents, paid_at, access_granted_at, provider_customer_id")
      .eq("billing_id", billingIdFromBody)
      .maybeSingle();
    sessionRow = data;
  } else {
    const { data } = await supabaseAdmin
      .from("payment_sessions")
      .select("id, user_id, status, billing_id, amount_cents, paid_at, access_granted_at, provider_customer_id")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sessionRow = data;
  }

  if (!sessionRow || sessionRow.user_id !== userData.user.id) {
    return jsonResponse({ error: "Not found" }, 404);
  }

  const billingId = sessionRow.billing_id as string;
  let status: string | undefined;
  let expiresAt: string | undefined;
  let customerId: string | undefined;
  let amount = Number(sessionRow.amount_cents ?? 0);
  let details: Record<string, unknown> = {};

  const subscriptionCheck = await fetchSubscriptionCheckout(billingId, abacatePayApiKey);
  if (subscriptionCheck.found) {
    status = subscriptionCheck.status as string | undefined;
    customerId = subscriptionCheck.customerId as string | undefined;
    amount = Number(subscriptionCheck.amount ?? amount);
    details = { subscriptions: subscriptionCheck.raw ?? null };
  } else {
    const billingListCheck = await fetchBillingStatusFromList(billingId, abacatePayApiKey);
    if (!billingListCheck.error && billingListCheck.status) {
      status = billingListCheck.status as string;
      details = { billingList: billingListCheck.raw ?? null };
    } else if (billingId.startsWith("pix_")) {
      const pixCheck = await fetchPixStatus(billingId, abacatePayApiKey);
      if (pixCheck.error) {
        return jsonResponse(
          {
            error: "Failed to check payment status",
            details: {
              subscriptions: subscriptionCheck.raw ?? null,
              billingList: billingListCheck.raw ?? null,
              pix: pixCheck.raw ?? null,
            },
          },
          400,
        );
      }
      status = pixCheck.status as string | undefined;
      expiresAt = pixCheck.expiresAt as string | undefined;
      details = {
        subscriptions: subscriptionCheck.raw ?? null,
        billingList: billingListCheck.raw ?? null,
        pix: pixCheck.raw ?? null,
      };
    } else {
      return jsonResponse(
        {
          error: "Failed to check payment status",
          details: {
            subscriptions: subscriptionCheck.raw ?? null,
            billingList: billingListCheck.raw ?? null,
          },
        },
        400,
      );
    }
  }

  if (!status) {
    return jsonResponse({ error: "Invalid status response", details }, 500);
  }

  const normalizedStatus = normalizeStatus(status);
  if (isPaidStatus(normalizedStatus)) {
    let grantedAt = resolveGrantedAt(sessionRow);
    let grantedNow = false;

    try {
      const grantResult = await grantAccessIfNeeded(supabaseAdmin, sessionRow);
      grantedAt = grantResult.grantedAt;
      grantedNow = grantResult.granted;
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
        amount_cents: Number.isFinite(amount) ? amount : sessionRow.amount_cents,
        provider_customer_id: customerId ?? sessionRow.provider_customer_id ?? null,
      })
      .eq("id", sessionRow.id);

    if (sessionUpdateError) {
      return jsonResponse(
        { error: "Failed to update payment session", details: sessionUpdateError.message },
        500,
      );
    }

    return jsonResponse({
      status: "PAID",
      expiresAt,
      billingId,
      checkoutId: billingId,
      customerId: customerId ?? sessionRow.provider_customer_id ?? null,
      grantedNow,
    });
  }

  const { error: sessionUpdateError } = await supabaseAdmin
    .from("payment_sessions")
    .update({
      status: normalizedStatus,
      amount_cents: Number.isFinite(amount) ? amount : sessionRow.amount_cents,
      provider_customer_id: customerId ?? sessionRow.provider_customer_id ?? null,
    })
    .eq("id", sessionRow.id);

  if (sessionUpdateError) {
    return jsonResponse(
      { error: "Failed to update payment session", details: sessionUpdateError.message },
      500,
    );
  }

  return jsonResponse({
    status: normalizedStatus,
    expiresAt,
    billingId,
    checkoutId: billingId,
    customerId: customerId ?? sessionRow.provider_customer_id ?? null,
  });
});
