import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-cron-secret",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function plain(text: string, status = 200) {
  return new Response(text, {
    status,
    headers: { ...cors, "Content-Type": "text/plain" },
  });
}

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "";

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const verify = await loadSecret("WHATSAPP_VERIFY_TOKEN");
      if (mode === "subscribe" && token && verify && token === verify && challenge) {
        return plain(challenge, 200);
      }
      if (action === "health") return json({ ok: true, service: "whatsapp", stub: true });
      return plain("forbidden", 403);
    }

    return json({
      ok: true,
      stub: true,
      message: "WhatsApp function stub live — full handler deploying next",
    });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
