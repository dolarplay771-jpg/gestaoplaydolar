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

const normalizeUrl = (value: unknown) => {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).toString();
  } catch {
    // ignore
  }
  if (!trimmed.includes("://")) {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      // ignore
    }
  }
  return "";
};

const ensureHttps = (value: string) => {
  if (!value) return "";
  if (value.startsWith("https://")) return value;
  return "";
};

const buildOrigin = (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin) return origin;
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      return new URL(referer).origin;
    } catch {
      return null;
    }
  }
  return null;
};

const onlyDigits = (value: string) => value.replace(/\D/g, "");

const normalizeCellphone = (value: string) => {
  const digits = onlyDigits(value);
  if (!digits) return "";
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `+${withCountry}`;
};

const normalizeTaxId = (value: string) => onlyDigits(value);

const buildCustomerFromUser = (user: any) => {
  const metadata = user?.user_metadata ?? {};
  const name = (metadata.full_name ?? metadata.name ?? "").toString().trim();
  const phoneRaw = (metadata.phone ?? metadata.phone_number ?? "").toString();
  const taxRaw = (metadata.tax_id ?? metadata.cpf ?? metadata.cnpj ?? "").toString();
  const email = (user?.email ?? "").toString().trim();

  const cellphone = phoneRaw ? normalizeCellphone(phoneRaw) : "";
  const taxId = taxRaw ? normalizeTaxId(taxRaw) : "";

  return { name, cellphone, taxId, email };
};

const allowedCycles = new Set(["WEEKLY", "MONTHLY", "SEMIANNUALLY", "ANNUALLY"]);
const allowedMethods = new Set(["PIX", "CARD"]);

const parsePlanCycle = (value: string) => {
  const normalized = value.trim().toUpperCase();
  return allowedCycles.has(normalized) ? normalized : "MONTHLY";
};

const parseMethods = (payloadMethods: unknown, envMethods: string) => {
  const source = Array.isArray(payloadMethods)
    ? payloadMethods
    : typeof payloadMethods === "string"
    ? payloadMethods.split(",")
    : envMethods.split(",");

  const normalized = source
    .map((item) => item?.toString().trim().toUpperCase())
    .filter((item) => item && allowedMethods.has(item));

  return normalized.length > 0 ? [...new Set(normalized)] : ["CARD"];
};

const buildExternalId = (userId: string) => `playdolar__${userId}__${Date.now()}`;

const abacateRequest = async (
  path: string,
  apiKey: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    query?: Record<string, string | number | null | undefined>;
  } = {},
) => {
  const url = new URL(`https://api.abacatepay.com${path}`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const response = await fetch(url.toString(), {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  let json: any = {};
  if (raw) {
    try {
      json = JSON.parse(raw);
    } catch {
      json = { raw };
    }
  }

  return {
    ok: response.ok && json?.success !== false && !json?.error,
    status: response.status,
    json,
  };
};

const createOrReuseCustomer = async (
  customer: ReturnType<typeof buildCustomerFromUser>,
  apiKey: string,
) => {
  const customerPayload: Record<string, unknown> = {
    email: customer.email,
  };

  if (customer.name) customerPayload.name = customer.name;
  if (customer.cellphone) customerPayload.cellphone = customer.cellphone;
  if (customer.taxId) customerPayload.taxId = customer.taxId;

  const result = await abacateRequest("/v2/customers/create", apiKey, {
    method: "POST",
    body: customerPayload,
  });

  return {
    ...result,
    customer: result.json?.data ?? null,
    sent: customerPayload,
  };
};

const ensureSubscriptionProduct = async (
  apiKey: string,
  productId: string,
  productExternalId: string,
  planName: string,
  planDescription: string,
  priceCents: number,
  planCycle: string,
) => {
  if (productId) {
    return { ok: true, product: { id: productId }, raw: null };
  }

  const lookup = await abacateRequest("/v2/products/list", apiKey, {
    query: {
      externalId: productExternalId,
      status: "ACTIVE",
      limit: 1,
    },
  });

  if (lookup.ok) {
    const product = Array.isArray(lookup.json?.data) ? lookup.json.data[0] : null;
    if (product?.id) {
      const currentPrice = Number(product.price ?? NaN);
      const currentCycle = (product.cycle ?? "").toString().trim().toUpperCase();

      if (currentPrice !== priceCents || currentCycle !== planCycle) {
        return {
          ok: false,
          product: null,
          raw: {
            error:
              "Existing AbacatePay product does not match configured plan price/cycle. Update the product in AbacatePay or define ABACATEPAY_PRODUCT_ID.",
            product,
            expected: {
              externalId: productExternalId,
              price: priceCents,
              cycle: planCycle,
            },
          },
        };
      }

      return { ok: true, product, raw: lookup.json };
    }
  }

  const create = await abacateRequest("/v2/products/create", apiKey, {
    method: "POST",
    body: {
      externalId: productExternalId,
      name: planName,
      description: planDescription,
      price: priceCents,
      currency: "BRL",
      cycle: planCycle,
    },
  });

  return {
    ok: create.ok && !!create.json?.data?.id,
    product: create.json?.data ?? null,
    raw: {
      lookup: lookup.json ?? null,
      create: create.json ?? null,
    },
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
    console.error("Auth error:", userError);
    return jsonResponse({ error: "Unauthorized", details: userError?.message ?? null }, 401);
  }

  const plan = typeof (payload as any)?.plan === "string" ? (payload as any).plan : "pro";
  const priceCentsRaw = Number(Deno.env.get("ABACATEPAY_PLAN_PRICE_CENTS") ?? 1999);
  const priceCents = Number.isFinite(priceCentsRaw) ? Math.round(priceCentsRaw) : NaN;
  if (!Number.isFinite(priceCents) || priceCents < 100) {
    return jsonResponse({ error: "Invalid plan price" }, 500);
  }

  const planName = Deno.env.get("ABACATEPAY_PLAN_NAME") ?? "Plano Pro";
  const planDescriptionRaw = Deno.env.get("ABACATEPAY_PLAN_DESCRIPTION") ??
    "Acesso total por 30 dias.";
  const planDescription = planDescriptionRaw.slice(0, 120);
  const planExternalId = Deno.env.get("ABACATEPAY_PLAN_EXTERNAL_ID") ?? `plan-${plan}`;
  const productId = (Deno.env.get("ABACATEPAY_PRODUCT_ID") ?? "").trim();
  const planCycle = parsePlanCycle(Deno.env.get("ABACATEPAY_PLAN_CYCLE") ?? "MONTHLY");
  const methods = parseMethods(
    (payload as any)?.methods,
    Deno.env.get("ABACATEPAY_SUBSCRIPTION_METHODS") ?? "CARD",
  );

  const origin = buildOrigin(req);
  const customer = buildCustomerFromUser(userData.user);
  const payloadReturnRaw = (payload as any)?.returnUrl ?? "";
  const payloadCompletionRaw = (payload as any)?.completionUrl ?? "";
  const envReturnRaw = Deno.env.get("ABACATEPAY_RETURN_URL") ?? "";
  const envCompletionRaw = Deno.env.get("ABACATEPAY_COMPLETION_URL") ?? "";
  const originRaw = origin ?? "";

  const payloadReturn = normalizeUrl(payloadReturnRaw);
  const payloadCompletion = normalizeUrl(payloadCompletionRaw);
  const envReturn = normalizeUrl(envReturnRaw);
  const envCompletion = normalizeUrl(envCompletionRaw);
  const originUrl = normalizeUrl(originRaw);
  const fallbackUrl = normalizeUrl(supabaseUrl);

  const returnUrl =
    ensureHttps(payloadReturn) ||
    ensureHttps(envReturn) ||
    ensureHttps(originUrl) ||
    ensureHttps(fallbackUrl);
  const completionUrl =
    ensureHttps(payloadCompletion) ||
    ensureHttps(envCompletion) ||
    ensureHttps(payloadReturn) ||
    ensureHttps(envReturn) ||
    ensureHttps(originUrl) ||
    ensureHttps(fallbackUrl);

  if (!customer.email) {
    return jsonResponse({ error: "Missing customer email" }, 400);
  }

  if (!returnUrl || !completionUrl) {
    return jsonResponse(
      {
        error: "Invalid return/completion URL",
        details: {
          returnUrl: payloadReturnRaw,
          completionUrl: payloadCompletionRaw,
          envReturn: envReturnRaw,
          envCompletion: envCompletionRaw,
          origin: originRaw,
          fallbackUrl: supabaseUrl,
        },
      },
      400,
    );
  }

  const customerResult = await createOrReuseCustomer(customer, abacatePayApiKey);
  if (!customerResult.ok || !customerResult.customer?.id) {
    return jsonResponse(
      {
        error: customerResult.json?.error ?? "Failed to create customer",
        details: {
          abacate: customerResult.json,
          sent: customerResult.sent,
        },
      },
      400,
    );
  }

  const productResult = await ensureSubscriptionProduct(
    abacatePayApiKey,
    productId,
    planExternalId,
    planName,
    planDescription,
    priceCents,
    planCycle,
  );
  if (!productResult.ok || !productResult.product?.id) {
    return jsonResponse(
      {
        error: "Failed to resolve subscription product",
        details: {
          abacate: productResult.raw,
        },
      },
      400,
    );
  }

  const checkoutPayload: Record<string, unknown> = {
    items: [
      {
        id: productResult.product.id,
        quantity: 1,
      },
    ],
    customerId: customerResult.customer.id,
    methods,
    returnUrl,
    completionUrl,
    externalId: buildExternalId(userData.user.id),
    metadata: {
      plan,
      userId: userData.user.id,
      source: "playdolar",
    },
  };

  const checkoutResult = await abacateRequest("/v2/subscriptions/create", abacatePayApiKey, {
    method: "POST",
    body: checkoutPayload,
  });

  if (!checkoutResult.ok) {
    return jsonResponse(
      {
        error: checkoutResult.json?.error ?? "Failed to create subscription checkout",
        details: {
          abacate: checkoutResult.json,
          sent: checkoutPayload,
        },
      },
      400,
    );
  }

  const checkout = checkoutResult.json?.data ?? checkoutResult.json;
  const billingId = checkout?.id as string | undefined;
  const url = checkout?.url as string | undefined;
  const status = (checkout?.status as string | undefined) ?? "PENDING";
  const amount = Number(checkout?.amount ?? priceCents);
  const customerId = (checkout?.customerId as string | undefined) ?? customerResult.customer.id;

  if (!billingId || !url) {
    console.error("Unexpected AbacatePay response:", checkoutResult.json);
    return jsonResponse(
      {
        error: "Unexpected AbacatePay response",
        details: checkoutResult.json,
      },
      502,
    );
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
  const { error: insertError } = await supabaseAdmin.from("payment_sessions").upsert(
    {
      billing_id: billingId,
      user_id: userData.user.id,
      status,
      amount_cents: amount,
      provider_customer_id: customerId,
    },
    { onConflict: "billing_id" },
  );

  if (insertError) {
    console.error("Failed to store payment session:", insertError);
    return jsonResponse({ error: "Failed to create checkout session" }, 500);
  }

  return jsonResponse({
    id: billingId,
    billingId,
    checkoutId: billingId,
    url,
    status,
    amount,
    customerId,
  });
});
