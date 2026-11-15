/* Mylo — Web Push sender.

   The browser half of push lives in sw.js and js/app.js: the app subscribes and
   parks the subscription as a `push` space-meta row. Delivering to a CLOSED app
   needs somebody holding the VAPID private key to sign the request, which is
   what this does.

   Deploy:
     npx web-push generate-vapid-keys
     npx supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
     npx supabase functions deploy push
   Then put the PUBLIC key into js/config.js as `vapidPublicKey`. Until that key
   is set the app simply does not subscribe, so nothing here is load-bearing for
   notifications that fire while Mylo is open.

   POST { to: <user id>, title, body, url?, tag? }
*/
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PUB = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const PRIV = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const SUBJ = Deno.env.get("VAPID_SUBJECT") ?? "mailto:hello@staymylo.com";

if (PUB && PRIV) webpush.setVapidDetails(SUBJ, PUB, PRIV);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (!PUB || !PRIV) {
    return json({ error: "VAPID keys are not set on this project" }, 500);
  }

  let payload: { to?: string; title?: string; body?: string; url?: string; tag?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "expected JSON" }, 400);
  }
  const { to, title, body = "", url = "/", tag } = payload;
  if (!to || !title) return json({ error: "to and title are required" }, 400);

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Subscriptions are append-only rows, so the newest one per endpoint wins and
  // the same device re-subscribing does not get pushed to twice.
  const { data, error } = await db
    .from("messages")
    .select("payload, created_at")
    .eq("from_id", to)
    .order("created_at", { ascending: false })
    .limit(400);
  if (error) return json({ error: error.message }, 500);

  const seen = new Set<string>();
  const subs = (data ?? [])
    .map((r) => r.payload as Record<string, string>)
    .filter((p) => p?.msg_kind === "push" && p?.mtype === "sub" && p?.endpoint)
    .filter((p) => (seen.has(p.endpoint) ? false : (seen.add(p.endpoint), true)));

  if (!subs.length) return json({ sent: 0, note: "no subscriptions for this user" });

  const note = JSON.stringify({ title, body, url, tag });
  const results = await Promise.allSettled(
    subs.map((p) =>
      webpush.sendNotification(
        { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
        note,
      )
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  // 404/410 means the browser threw the subscription away; nothing to clean up
  // here because the table is append-only — the newest row still wins.
  return json({ sent, tried: subs.length });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
