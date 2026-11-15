import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-hub-signature-256, x-cron-secret",
};

export const GRAPH = "https://graph.facebook.com/v21.0";
export const SERVICE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

export function plain(text: string, status = 200) {
  return new Response(text, { status, headers: { ...cors, "Content-Type": "text/plain" } });
}

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  );
}

export async function loadSecret(key: string): Promise<string> {
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

export async function userFromAuth(req: Request) {
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

export async function planOk(userId: string) {
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

export function linkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export function todayIso() {
  return nowInTimezone("Africa/Lagos").date;
}

export function parseTimeToMinutes(t: string | null | undefined) {
  if (!t) return null;
  const m = String(t).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

export function nowInTimezone(tz: string) {
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

export function formatMins(total: number) {
  const h = Math.floor(total / 60) % 24;
  const m = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}`;
}

export function inServiceWindow(lastInboundAt: string | null | undefined) {
  if (!lastInboundAt) return false;
  return Date.now() - new Date(lastInboundAt).getTime() < SERVICE_WINDOW_MS;
}

export async function waSend(token: string, phoneNumberId: string, to: string, text: string) {
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

export async function primaryRoomId(userId: string): Promise<string | null> {
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

export async function loadTodayGoals(userId: string) {
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

export async function buildContext(userId: string) {
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

export async function spendCredit(userId: string) {
  const sb = adminClient();
  const { data: profile } = await sb.from("profiles").select("credits, is_admin, plan").eq("id", userId).maybeSingle();
  if (!profile) return { ok: false, credits: 0 };
  if (profile.is_admin) return { ok: true, credits: profile.credits ?? 0 };
  const credits = Number(profile.credits || 0);
  if (credits < 1) return { ok: false, credits };
  const { data } = await sb.from("profiles").update({ credits: credits - 1 }).eq("id", userId).select("credits").maybeSingle();
  return { ok: true, credits: data?.credits ?? credits - 1 };
}

export async function chatWithGemini(text: string, context: Record<string, unknown>, apiKey: string) {
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

export function localReply(text: string, context: { name: string; today_goals: Array<{ title: string; done: boolean; time?: string }> }) {
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

export async function markDone(userId: string, query: string) {
  const goals = await loadTodayGoals(userId);
  const q = query.toLowerCase();
  const hit = goals.find((g) => !g.done && String(g.title).toLowerCase().includes(q))
    || goals.find((g) => String(g.title).toLowerCase().includes(q));
  if (!hit) return null;
  const sb = adminClient();
  await sb.from("goals").update({ done: true }).eq("id", hit.id);
  return hit.title;
}
