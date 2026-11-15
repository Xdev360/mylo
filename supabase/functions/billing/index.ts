import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

type Sku =
  | "pro_month"
  | "pod_month"
  | "credits_100"
  | "credits_400"
  | "credits_1000";

const SKUS: Record<Sku, { amount: number; label: string; kind: "plan" | "credits"; plan?: "pro" | "pod"; credits?: number }> = {
  pro_month: { amount: 599000, label: "Mylo Pro (1 month)", kind: "plan", plan: "pro" },
  pod_month: { amount: 1299000, label: "Mylo Pod (1 month)", kind: "plan", plan: "pod" },
  credits_100: { amount: 299000, label: "100 Mylo credits", kind: "credits", credits: 100 },
  credits_400: { amount: 799000, label: "400 Mylo credits", kind: "credits", credits: 400 },
  credits_1000: { amount: 1599000, label: "1000 Mylo credits", kind: "credits", credits: 1000 },
};

async function loadSecret(key: string): Promise<string> {
  const fromEnv = Deno.env.get(key) || "";
  if (fromEnv) return fromEnv;
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) return "";
  const res = await fetch(
    `${url}/rest/v1/app_secrets?key=eq.${encodeURIComponent(key)}&select=value&limit=1`,
    { headers: { apikey: service, Authorization: `Bearer ${service}` } },
  );
  if (!res.ok) return "";
  const rows = await res.json();
  return String(rows?.[0]?.value || "");
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sha512Hex(secret: string, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
}

async function applyPaidReference(reference: string) {
  const sb = adminClient();
  const { data: payment } = await sb
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();
  if (!payment) return { ok: false, error: "payment not found" };
  if (payment.status === "success") return { ok: true, already: true };

  const sku = payment.sku as Sku;
  const conf = SKUS[sku];
  if (!conf) return { ok: false, error: "unknown sku" };

  const { data: profile } = await sb
    .from("profiles")
    .select("*")
    .eq("id", payment.user_id)
    .maybeSingle();
  if (!profile) return { ok: false, error: "profile missing" };

  const patch: Record<string, unknown> = {};
  if (conf.kind === "plan" && conf.plan) {
    const base = profile.plan_expires_at && new Date(profile.plan_expires_at) > new Date()
      ? new Date(profile.plan_expires_at)
      : new Date();
    const expires = new Date(base);
    expires.setDate(expires.getDate() + 30);
    patch.plan = conf.plan;
    patch.plan_expires_at = expires.toISOString();
    patch.credits = conf.plan === "pod" ? 1000 : 400;
    patch.credits_reset_at = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
  } else if (conf.kind === "credits" && conf.credits) {
    patch.credits = Number(profile.credits || 0) + conf.credits;
  }

  if (Object.keys(patch).length) {
    await sb.from("profiles").update(patch).eq("id", payment.user_id);
  }
  await sb.from("payments").update({
    status: "success",
    paid_at: new Date().toISOString(),
  }).eq("id", payment.id);

  return { ok: true, sku, user_id: payment.user_id };
}

async function userFromAuth(req: Request) {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
    { global: { headers: { Authorization: auth } } },
  );
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const secret = await loadSecret("PAYSTACK_SECRET_KEY");
  if (!secret) return json({ error: "Paystack is not configured yet" }, 503);

  const signature = req.headers.get("x-paystack-signature");
  const raw = await req.text();

  // Webhook from Paystack
  if (signature) {
    const hash = await sha512Hex(secret, raw);
    if (hash !== signature) return json({ error: "invalid signature" }, 401);
    const event = JSON.parse(raw || "{}");
    if (event?.event === "charge.success") {
      const reference = String(event?.data?.reference || "");
      if (reference) await applyPaidReference(reference);
    }
    return json({ received: true });
  }

  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw || "{}"); } catch { body = {}; }

  const user = await userFromAuth(req);
  if (!user) return json({ error: "sign in required" }, 401);

  const action = String(body.action || "initialize");
  const site = String(body.callback_origin || "https://app.staymylo.com").replace(/\/$/, "");

  if (action === "verify") {
    const reference = String(body.reference || "");
    if (!reference) return json({ error: "missing reference" }, 400);
    const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const data = await res.json();
    if (!res.ok || data?.data?.status !== "success") {
      return json({ error: data?.message || "Payment not successful", data }, 400);
    }
    const applied = await applyPaidReference(reference);
    return json({ ok: true, applied, paystack: data.data });
  }

  // initialize
  const sku = String(body.sku || "") as Sku;
  const conf = SKUS[sku];
  if (!conf) return json({ error: "invalid sku" }, 400);

  const reference = `sph_${sku}_${user.id.slice(0, 8)}_${Date.now()}`;
  const sb = adminClient();
  await sb.from("payments").insert({
    user_id: user.id,
    reference,
    sku,
    amount_kobo: conf.amount,
    currency: "NGN",
    status: "pending",
    metadata: { label: conf.label },
  });

  const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: user.email || `${user.id}@example.com`,
      amount: conf.amount,
      currency: "NGN",
      reference,
      callback_url: `${site}/?billing=1&reference=${encodeURIComponent(reference)}`,
      metadata: {
        user_id: user.id,
        sku,
        custom_fields: [
          { display_name: "Product", variable_name: "product", value: conf.label },
        ],
      },
    }),
  });
  const initData = await initRes.json();
  if (!initRes.ok || !initData?.data?.authorization_url) {
    await sb.from("payments").update({ status: "failed" }).eq("reference", reference);
    return json({ error: initData?.message || "Could not start payment" }, 400);
  }

  return json({
    ok: true,
    reference,
    authorization_url: initData.data.authorization_url,
    access_code: initData.data.access_code,
  });
});
