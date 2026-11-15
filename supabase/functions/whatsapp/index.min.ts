import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-cron-secret",
};

const GRAPH = "https://graph.facebook.com/v21.0";
const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function plain(text: string, status = 200) {
  return new Response(text, { status, headers: { ...cors, "Content-Type": "text/plain" } });
}

function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
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

async function planOk(userId: string) {
  const sb = adminClient();
  const { data: profile } = await sb.from("profiles").select("plan, is_admin, plan_expires_at").eq("id", userId).maybeSingle();
  if (!profile) return false;
  if (profile.is_admin) return true;
  if (profile.plan === "pro" || profile.plan === "pod") {
    if (profile.plan_expires_at && new Date(profile.plan_expires_at) < new Date()) return false;
    return true;
  }
  return false;
}

function linkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

function todayIso() {
  return nowInTimezone("Africa/Lagos").date;
}

function parseTimeToMinutes(t: string | null | undefined) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function nowInTimezone(tz: string) {
  const safeTz = tz || "Africa/Lagos";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: safeTz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
    const hour = Number(get("hour") === "24" ? "0" : get("hour"));
    const minute = Number(get("minute"));
    return {
      date: `${get("year")}-${get("month")}-${get("day")}`,
      minutes: hour * 60 + minute,
      tz: safeTz,
    };
  } catch {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return {
      date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`,
      minutes: d.getUTCHours() * 60 + d.getUTCMinutes(),
      tz: "UTC",
    };
  }
}

function formatMins(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

function inServiceWindow(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_MS;
}

async function waSend(token: string, phoneNumberId: string, to: string, text: string) {
  const res = await fetch(`${GRAPH}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: String(to).replace(/\D/g, ""),
      type: "text",
      text: { preview_url: false, body: String(text || "").slice(0, 4000) },
    }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !data?.error, data };
}

async function primaryRoomId(userId: string): Promise<string | null> {
  const sb = adminClient();
  const { data } = await sb
    .from("room_members")
    .select("room_id, archived_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(20);
  const rows = data || [];
  const active = rows.find((r) => !r.archived_at) || rows[0];
  return active?.room_id || null;
}

async function loadTodayGoals(userId: string) {
  const sb = adminClient();
  const today = todayIso();
  const { data } = await sb
    .from("goals")
    .select("id, title, done, start_time, duration_min, is_shared, scope, due_date")
    .eq("owner_id", userId)
    .eq("scope", "day")
    .eq("due_date", today)
    .order("created_at");
  return data || [];
}

async function buildContext(userId: string) {
  const sb = adminClient();
  const { data: profile } = await sb.from("profiles").select("username, plan, credits, is_admin").eq("id", userId).maybeSingle();
  const goals = await loadTodayGoals(userId);
  return {
    name: profile?.username || "friend",
    username: profile?.username || "",
    plan: profile?.plan || "free",
    credits: profile?.credits ?? 0,
    today: todayIso(),
    today_goals: goals.map((g) => ({
      title: g.title,
      done: !!g.done,
      time: g.start_time ? String(g.start_time).slice(0, 5) : "",
      shared: !!g.is_shared,
    })),
  };
}

async function spendCredit(userId: string) {
  const sb = adminClient();
  const { data: profile } = await sb.from("profiles").select("credits, is_admin, plan").eq("id", userId).maybeSingle();
  if (!profile) return { ok: false, credits: 0 };
  if (profile.is_admin) return { ok: true, credits: profile.credits ?? 0 };
  const credits = Number(profile.credits || 0);
  if (credits < 1) return { ok: false, credits };
  const { data } = await sb.from("profiles").update({ credits: credits - 1 }).eq("id", userId).select("credits").maybeSingle();
  return { ok: true, credits: data?.credits ?? credits - 1 };
}

async function chatWithGemini(text: string, context: Record<string, unknown>, apiKey: string) {
  const prompt = `You are Mylo, a calm friend — not a child, not a coach, not corporate. The user is messaging you on WhatsApp.
Voice: warm, short, sure. Lowercase is fine. No hype. Never say "lock in" or "solid".
Today is ${context.today}.
User context JSON:
${JSON.stringify(context).slice(0, 2800)}

User message:
"""${String(text).slice(0, 800)}"""

Reply as Mylo in plain text (no markdown). Keep under 500 characters.
If they clearly want to add a goal, also return goals.
Return ONLY valid JSON:
{
  "reply": "short calm message",
  "goals": [{"title":"...","due_date":"YYYY-MM-DD","start_time":"HH:MM","duration_min":30}]
}
Rules:
- Default goals to [].
- Only fill goals when they clearly ask to add a task.
- Prefer due_date = today when they say today/tonight.`;

  const models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) continue;
    const data = await res.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      return {
        reply: String(parsed.reply || "I’m here.").slice(0, 900),
        goals: Array.isArray(parsed.goals) ? parsed.goals.slice(0, 5) : [],
      };
    } catch {
      return { reply: String(raw).slice(0, 900), goals: [] };
    }
  }
  return null;
}

function localReply(text: string, context: { name: string; today_goals: Array<{ title: string; done: boolean; time?: string }> }) {
  const lower = String(text || "").toLowerCase().trim();
  const pending = (context.today_goals || []).filter((g) => !g.done);
  if (/^(hi|hello|hey|yo|sup)\b/.test(lower)) {
    return `Hey ${context.name}. What do you want to lock in?${pending.length ? `\nYou’ve got ${pending.length} open on Today.` : ""}`;
  }
  if (/help|what can you do|commands?/.test(lower)) {
    return `I’m Mylo on WhatsApp.\n• “Remind me in 5 min to stretch”\n• “What’s left today?”\n• “Add gym today at 7 for 1 hour”\n• “Mark essay done”\n\nSend UNLINK to disconnect.\nReminders only work while our chat window is open (you texted in the last 24h — free mode).`;
  }
  if (/what('?s| is) left|today|list (my )?(goals|tasks)/.test(lower)) {
    if (!context.today_goals.length) return "Today is clear so far. Tell me what to add.";
    const lines = context.today_goals.map((g) => `${g.done ? "✅" : "○"} ${g.title}${g.time ? ` · ${g.time}` : ""}`);
    return `Today:\n${lines.join("\n")}`;
  }
  return null;
}

async function markDone(userId: string, query: string) {
  const goals = await loadTodayGoals(userId);
  const q = query.toLowerCase();
  const hit = goals.find((g) => !g.done && String(g.title).toLowerCase().includes(q))
    || goals.find((g) => String(g.title).toLowerCase().includes(q));
  if (!hit) return null;
  const sb = adminClient();
  await sb.from("goals").update({ done: true }).eq("id", hit.id);
  return hit.title;
}

async function createGoals(userId: string, drafts: Array<Record<string, unknown>>) {
  const roomId = await primaryRoomId(userId);
  if (!roomId) return [];
  const sb = adminClient();
  const created: string[] = [];
  for (const g of drafts.slice(0, 5)) {
    const title = String(g.title || "Goal").slice(0, 80);
    const due = String(g.due_date || todayIso()).slice(0, 10);
    const start = g.start_time ? String(g.start_time).slice(0, 5) : "08:00";
    const duration = Number(g.duration_min) > 0 ? Number(g.duration_min) : 30;
    const { error } = await sb.from("goals").insert({
      room_id: roomId,
      owner_id: userId,
      title,
      scope: "day",
      due_date: due,
      start_time: start,
      duration_min: duration,
      done: false,
      is_shared: false,
    });
    if (!error) created.push(title);
  }
  return created;
}

function parseAdhocReminder(text: string, tz = "Africa/Lagos"): { body: string; fireAt: Date; whenLabel: string } | null {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (!/\bremind(?:\s+me)?\b/.test(lower)) return null;
  if (/\breminders?\s+(on|off|enable|disable)\b/.test(lower)) return null;

  const rel = lower.match(/\bin\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/);
  if (!rel) return null;
  const n = Number(rel[1]);
  if (!(n > 0)) return null;
  const unit = rel[2];
  let delayMs = 0;
  let whenLabel = "";
  if (/^h/.test(unit)) {
    if (n > 72) return null;
    delayMs = n * 60 * 60 * 1000;
    whenLabel = `in ${n} hour${n === 1 ? "" : "s"}`;
  } else {
    if (n > 24 * 60) return null;
    delayMs = n * 60 * 1000;
    whenLabel = `in ${n} min`;
  }
  const fireAt = new Date(Date.now() + delayMs);
  let body = raw
    .replace(/\bremind(?:\s+me)?(?:\s+to|\s+about)?\s*/i, "")
    .replace(/\bin\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h)\b/i, "")
    .replace(/^(to|about)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim() || "your thing";
  body = body.replace(/^(to|about)\s+/i, "").trim() || "your thing";
  return { body: body.slice(0, 280), fireAt, whenLabel };
}

async function runReminders(token: string, phoneNumberId: string) {
  const sb = adminClient();
  let sent = 0;
  const errors: string[] = [];

  const { data: due } = await sb
    .from("mylo_reminders")
    .select("id, user_id, body, fire_at")
    .is("sent_at", null)
    .lte("fire_at", new Date().toISOString())
    .eq("channel", "whatsapp")
    .order("fire_at")
    .limit(50);

  for (const rem of due || []) {
    const { data: acc } = await sb.from("whatsapp_accounts").select("*").eq("user_id", rem.user_id).maybeSingle();
    if (!acc?.wa_id || acc.reminders_enabled === false || !inServiceWindow(acc.last_inbound_at)) {
      if (acc && !inServiceWindow(acc.last_inbound_at)) {
        await sb.from("mylo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", rem.id);
      }
      continue;
    }
    const result = await waSend(token, phoneNumberId, acc.wa_id, `⏰ Reminder: ${rem.body}`);
    if (!result.ok) {
      errors.push(String((result.data as { error?: { message?: string } })?.error?.message || "adhoc send failed"));
      continue;
    }
    await sb.from("mylo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", rem.id);
    sent += 1;
  }

  const { data: accounts } = await sb
    .from("whatsapp_accounts")
    .select("*")
    .eq("reminders_enabled", true);

  for (const acc of accounts || []) {
    if (!inServiceWindow(acc.last_inbound_at)) continue;
    if (!(await planOk(acc.user_id))) continue;
    const lead = Math.min(120, Math.max(5, Number(acc.remind_minutes_before) || 15));
    const now = nowInTimezone(acc.timezone || "Africa/Lagos");
    const { data: goals } = await sb
      .from("goals")
      .select("id, title, done, start_time, due_date")
      .eq("owner_id", acc.user_id)
      .eq("scope", "day")
      .eq("due_date", now.date)
      .eq("done", false);

    for (const g of goals || []) {
      const startMins = parseTimeToMinutes(g.start_time);
      if (startMins == null) continue;
      const minsUntil = startMins - now.minutes;
      let kind: string | null = null;
      let text = "";
      if (minsUntil >= 1 && minsUntil <= lead + 4) {
        kind = "upcoming";
        text = minsUntil <= 1
          ? `⏰ Starting now: ${g.title}`
          : `⏰ Reminder: “${g.title}” in ${minsUntil} min (${formatMins(startMins)}). You’ve got this.`;
      } else if (minsUntil <= 0 && minsUntil >= -4) {
        kind = "starting";
        text = `⏰ Time for “${g.title}”. Lock in.`;
      }
      if (!kind) continue;
      const { data: existing } = await sb
        .from("whatsapp_reminder_log")
        .select("goal_id")
        .eq("goal_id", g.id)
        .eq("kind", kind)
        .maybeSingle();
      if (existing) continue;
      const result = await waSend(token, phoneNumberId, acc.wa_id, text);
      if (!result.ok) {
        errors.push(String((result.data as { error?: { message?: string } })?.error?.message || "send failed"));
        continue;
      }
      await sb.from("whatsapp_reminder_log").upsert({ goal_id: g.id, kind, sent_at: new Date().toISOString() });
      sent += 1;
    }
  }

  return { sent, checked: (accounts || []).length, errors: errors.slice(0, 5) };
}

async function handleInbound(
  token: string,
  phoneNumberId: string,
  msg: { from: string; text: string; name?: string },
) {
  const sb = adminClient();
  const waId = String(msg.from || "").replace(/\D/g, "");
  const text = String(msg.text || "").trim();
  if (!waId || !text) return;

  const prefixed = text.trim().match(/^(?:link|connect|start)\s+([A-Z0-9]{6,10})$/i);
  const bare = text.trim().match(/^([A-HJ-NP-Z2-9]{8})$/i);
  const linkMatch = prefixed || bare;
  if (linkMatch) {
    const code = String(linkMatch[1] || "").trim().toUpperCase();
    const { data: row } = await sb.from("whatsapp_link_codes").select("*").eq("code", code).maybeSingle();
    if (!row || new Date(row.expires_at).getTime() < Date.now()) {
      await waSend(token, phoneNumberId, waId, "That link code expired. Open Mylo → You → Integrations → Connect WhatsApp for a fresh one.");
      return;
    }
    if (!(await planOk(row.user_id))) {
      await waSend(token, phoneNumberId, waId, "WhatsApp Mylo is on Pro/Pod. Upgrade in the app, then connect again.");
      return;
    }
    await sb.from("whatsapp_accounts").delete().eq("wa_id", waId);
    await sb.from("whatsapp_accounts").delete().eq("user_id", row.user_id);
    await sb.from("whatsapp_accounts").upsert({
      user_id: row.user_id,
      wa_id: waId,
      phone_e164: `+${waId}`,
      profile_name: msg.name || null,
      connected_at: new Date().toISOString(),
      last_inbound_at: new Date().toISOString(),
      last_message_at: new Date().toISOString(),
      reminders_enabled: true,
    });
    await sb.from("whatsapp_link_codes").delete().eq("code", code);
    const { data: profile } = await sb.from("profiles").select("username").eq("id", row.user_id).maybeSingle();
    await waSend(
      token,
      phoneNumberId,
      waId,
      `Linked to @${profile?.username || "you"}. You’re talking to Mylo on WhatsApp.\n\nTry: What’s left today?\nOr: Remind me in 5 min to stretch`,
    );
    return;
  }

  if (/^unlink$/i.test(text)) {
    await sb.from("whatsapp_accounts").delete().eq("wa_id", waId);
    await waSend(token, phoneNumberId, waId, "Unlinked. Connect again anytime from Mylo → You → Integrations.");
    return;
  }

  const { data: acc } = await sb.from("whatsapp_accounts").select("*").eq("wa_id", waId).maybeSingle();
  if (!acc?.user_id) {
    await waSend(
      token,
      phoneNumberId,
      waId,
      "You’re not linked yet.\nOpen Mylo → You → Integrations → Connect WhatsApp, then send the code here.",
    );
    return;
  }

  await sb.from("whatsapp_accounts").update({
    last_inbound_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    profile_name: msg.name || acc.profile_name,
  }).eq("user_id", acc.user_id);

  if (!(await planOk(acc.user_id))) {
    await waSend(token, phoneNumberId, waId, "WhatsApp Mylo needs Pro/Pod. Upgrade in the app.");
    return;
  }

  if (/^reminders?\s+(on|off)$/i.test(text) || /^reminders?$/i.test(text)) {
    const lower = text.toLowerCase();
    let enabled = acc.reminders_enabled;
    if (/\bon\b/.test(lower)) enabled = true;
    else if (/\boff\b/.test(lower)) enabled = false;
    else enabled = !enabled;
    await sb.from("whatsapp_accounts").update({ reminders_enabled: enabled }).eq("user_id", acc.user_id);
    await waSend(
      token,
      phoneNumberId,
      waId,
      enabled
        ? "Reminders on (free while you keep chatting within 24h)."
        : "Reminders off.",
    );
    return;
  }

  const context = await buildContext(acc.user_id);

  const adhoc = parseAdhocReminder(text, acc.timezone || "Africa/Lagos");
  if (adhoc) {
    if (acc.reminders_enabled === false) {
      await waSend(token, phoneNumberId, waId, "Reminders are off. Send “reminders on”, then ask again.");
      return;
    }
    const { error } = await sb.from("mylo_reminders").insert({
      user_id: acc.user_id,
      channel: "whatsapp",
      chat_id: null,
      body: adhoc.body,
      fire_at: adhoc.fireAt.toISOString(),
    });
    if (error) {
      await waSend(token, phoneNumberId, waId, "Couldn’t set that reminder — try again.");
      return;
    }
    await waSend(token, phoneNumberId, waId, `Got it — I’ll remind you ${adhoc.whenLabel}: ${adhoc.body}\n(Works free while our chat window is open.)`);
    return;
  }

  const doneMatch = text.match(/\b(?:mark|set)?\s*(.+?)\s+(?:as\s+)?(?:done|complete|finished)\b/i)
    || text.match(/\b(?:done|finished|complete[sd]?)\s+(.+)/i);
  if (doneMatch) {
    const title = await markDone(acc.user_id, doneMatch[1].replace(/^["']|["']$/g, "").trim());
    if (title) {
      await waSend(token, phoneNumberId, waId, `Marked “${title}” done. Nice.`);
      return;
    }
  }

  const local = localReply(text, context);
  if (local && !/\b(add|create|lock|schedule|remind)\b/i.test(text)) {
    await waSend(token, phoneNumberId, waId, local);
    return;
  }

  const spent = await spendCredit(acc.user_id);
  if (!spent.ok) {
    await waSend(token, phoneNumberId, waId, `You’re out of Mylo credits (${spent.credits} left). Top up in the app → You → Plan.`);
    return;
  }

  const key = await loadSecret("GEMINI_API_KEY");
  let result = key ? await chatWithGemini(text, context, key) : null;
  if (!result) {
    result = {
      reply: local || "I’m with you — try “What’s left today?” or “Add study today at 5 for 30 mins”.",
      goals: [],
    };
  }
  const created = result.goals?.length ? await createGoals(acc.user_id, result.goals) : [];
  let replyText = result.reply;
  if (created.length) replyText += `\n\nAdded to Today:\n${created.map((t) => `• ${t}`).join("\n")}`;
  await waSend(token, phoneNumberId, waId, replyText);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action") || "";

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");
      const verify = await loadSecret("WHATSAPP_VERIFY_TOKEN");
      if (mode === "subscribe" && token && verify && token === verify && challenge) {
        return plain(challenge, 200);
      }
      if (action === "health") return json({ ok: true, service: "whatsapp" });
      return plain("forbidden", 403);
    }

    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
      if (!action) {
        if (body && body.object === "whatsapp_business_account") action = "webhook";
        else action = String(body.action || "status");
      }
    }

    const waToken = await loadSecret("WHATSAPP_TOKEN");
    const phoneNumberId = await loadSecret("WHATSAPP_PHONE_NUMBER_ID");
    const cronSecret = await loadSecret("TELEGRAM_WEBHOOK_SECRET") || await loadSecret("WHATSAPP_VERIFY_TOKEN");
    const displayNumber = await loadSecret("WHATSAPP_DISPLAY_NUMBER");

    if (action === "webhook") {
      if (!waToken || !phoneNumberId) return json({ ok: true, skipped: "not configured" });
      try {
        const entry = (body.entry as Array<Record<string, unknown>> | undefined) || [];
        for (const ent of entry) {
          const changes = (ent.changes as Array<Record<string, unknown>> | undefined) || [];
          for (const ch of changes) {
            const value = (ch.value || {}) as Record<string, unknown>;
            const messages = (value.messages as Array<Record<string, unknown>> | undefined) || [];
            const contacts = (value.contacts as Array<Record<string, unknown>> | undefined) || [];
            for (const m of messages) {
              if (m.type && m.type !== "text") {
                const from = String(m.from || "");
                await waSend(waToken, phoneNumberId, from, "Send me text for now — Mylo reads messages.");
                continue;
              }
              const textObj = m.text as { body?: string } | undefined;
              const from = String(m.from || "");
              const name = String(((contacts[0]?.profile as { name?: string } | undefined)?.name) || "");
              await handleInbound(waToken, phoneNumberId, { from, text: textObj?.body || "", name });
            }
          }
        }
      } catch (e) {
        console.error("whatsapp webhook", e);
      }
      return json({ ok: true });
    }

    if (action === "run_reminders") {
      if (!waToken || !phoneNumberId) return json({ ok: true, sent: 0, skipped: "not configured" });
      const hdr = req.headers.get("x-cron-secret") || "";
      const auth = req.headers.get("Authorization") || "";
      const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
      const okSecret = !!(cronSecret && hdr === cronSecret);
      const okService = !!(service && auth === `Bearer ${service}`);
      if (!okSecret && !okService) return json({ error: "unauthorized" }, 401);
      const result = await runReminders(waToken, phoneNumberId);
      return json({ ok: true, ...result });
    }

    const configured = !!(waToken && phoneNumberId);
    if (!configured && action !== "status") {
      return json({ error: "WhatsApp is not configured yet", configured: false }, 503);
    }

    const user = await userFromAuth(req);
    if (!user) return json({ error: "sign in required" }, 401);

    if (action === "status") {
      const sb = adminClient();
      const { data: acc } = await sb.from("whatsapp_accounts")
        .select("phone_e164, profile_name, connected_at, last_inbound_at, last_message_at, reminders_enabled, remind_minutes_before, timezone")
        .eq("user_id", user.id)
        .maybeSingle();
      return json({
        ok: true,
        configured,
        connected: !!acc,
        plan_ok: await planOk(user.id),
        phone_e164: acc?.phone_e164 || null,
        profile_name: acc?.profile_name || null,
        reminders_enabled: acc?.reminders_enabled ?? true,
        remind_minutes_before: acc?.remind_minutes_before ?? 15,
        timezone: acc?.timezone || "Africa/Lagos",
        connected_at: acc?.connected_at || null,
        last_inbound_at: acc?.last_inbound_at || null,
        display_number: displayNumber || null,
        service_window_open: inServiceWindow(acc?.last_inbound_at),
      });
    }

    if (action === "connect") {
      if (!(await planOk(user.id))) {
        return json({ error: "WhatsApp Mylo requires Pro or Pod", plan_ok: false }, 403);
      }
      if (!configured) return json({ error: "WhatsApp is not configured yet", configured: false }, 503);
      const sb = adminClient();
      const code = linkCode();
      await sb.from("whatsapp_link_codes").delete().eq("user_id", user.id);
      await sb.from("whatsapp_link_codes").insert({
        code,
        user_id: user.id,
        expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      });
      const digits = String(displayNumber || "").replace(/\D/g, "");
      const prefill = encodeURIComponent(`LINK ${code}`);
      const urlWa = digits ? `https://wa.me/${digits}?text=${prefill}` : null;
      return json({
        ok: true,
        code,
        url: urlWa,
        display_number: displayNumber || null,
        expires_in_min: 15,
        instructions: urlWa
          ? "Tap Open WhatsApp, then send the prefilled LINK code."
          : `Open WhatsApp and message your Mylo business number with: LINK ${code}`,
      });
    }

    if (action === "disconnect") {
      const sb = adminClient();
      await sb.from("whatsapp_accounts").delete().eq("user_id", user.id);
      await sb.from("whatsapp_link_codes").delete().eq("user_id", user.id);
      return json({ ok: true, disconnected: true });
    }

    if (action === "set_reminders") {
      if (!(await planOk(user.id))) return json({ error: "WhatsApp Mylo requires Pro or Pod", plan_ok: false }, 403);
      const sb = adminClient();
      const { data: acc } = await sb.from("whatsapp_accounts").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!acc) return json({ error: "Connect WhatsApp first" }, 400);
      const patch: Record<string, unknown> = {};
      if (typeof body.enabled === "boolean") patch.reminders_enabled = body.enabled;
      if (Number(body.minutes) > 0) patch.remind_minutes_before = Math.min(120, Math.max(5, Number(body.minutes)));
      if (!Object.keys(patch).length) return json({ error: "Nothing to update" }, 400);
      const { data } = await sb.from("whatsapp_accounts").update(patch).eq("user_id", user.id)
        .select("reminders_enabled, remind_minutes_before").maybeSingle();
      return json({ ok: true, ...data });
    }

    return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
