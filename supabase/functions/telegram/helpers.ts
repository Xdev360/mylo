import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

export const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
};

export const BOT_USERNAME = "MyloPodbot";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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

export function todayIso() {
  return nowInTimezone("Africa/Lagos").date;
}

/** Claim + send one ad-hoc reminder (idempotent — skips if already sent). */
export async function deliverAdhocReminder(
  token: string,
  reminderId: string,
  chatId: number,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = adminClient();
  const { data: claimed } = await sb
    .from("mylo_reminders")
    .update({ sent_at: new Date().toISOString() })
    .eq("id", reminderId)
    .is("sent_at", null)
    .select("id")
    .maybeSingle();
  if (!claimed) return { ok: true }; // already delivered
  const result = await tgApi(token, "sendMessage", {
    chat_id: chatId,
    text: `⏰ Reminder: ${body}`,
    disable_web_page_preview: true,
  });
  if (!result.ok) {
    await sb.from("mylo_reminders").update({ sent_at: null }).eq("id", reminderId);
    return { ok: false, error: String((result.data as { description?: string })?.description || "adhoc send failed") };
  }
  return { ok: true };
}

/**
 * Fire short reminders on an exact timer (cron is only every minute → up to ~60s late).
 * Longer ones stay on the minute cron.
 */
export function schedulePreciseAdhoc(
  token: string,
  reminderId: string,
  chatId: number,
  body: string,
  fireAt: Date,
) {
  const waitMs = fireAt.getTime() - Date.now();
  const MAX_PRECISE_MS = 140_000; // stay under edge wall-clock limits
  if (waitMs > MAX_PRECISE_MS) return;
  const delay = Math.max(0, waitMs);
  const task = (async () => {
    if (delay > 0) await new Promise((r) => setTimeout(r, delay));
    await deliverAdhocReminder(token, reminderId, chatId, body);
  })();
  const er = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (er?.waitUntil) er.waitUntil(task);
  else void task;
}

export async function runReminders(token: string) {
  const sb = adminClient();
  let sent = 0;
  const errors: string[] = [];

  // 1) One-shot “remind me in 5 min…” pings (backup for precise timer + longer delays)
  const { data: due } = await sb
    .from("mylo_reminders")
    .select("id, user_id, chat_id, body, fire_at")
    .is("sent_at", null)
    .lte("fire_at", new Date().toISOString())
    .eq("channel", "telegram")
    .order("fire_at")
    .limit(50);

  for (const rem of due || []) {
    let chatId = rem.chat_id;
    if (!chatId) {
      const { data: acc } = await sb.from("telegram_accounts").select("chat_id").eq("user_id", rem.user_id).maybeSingle();
      if (!acc?.chat_id) {
        await sb.from("mylo_reminders").update({ sent_at: new Date().toISOString() }).eq("id", rem.id);
        continue;
      }
      chatId = acc.chat_id;
    }
    const result = await deliverAdhocReminder(token, rem.id, Number(chatId), rem.body);
    if (!result.ok) {
      errors.push(result.error || "adhoc send failed");
      continue;
    }
    sent += 1;
  }

  // 2) Timed Today-goal reminders
  const { data: accounts } = await sb
    .from("telegram_accounts")
    .select("user_id, chat_id, timezone, remind_minutes_before, reminders_enabled")
    .eq("reminders_enabled", true);

  for (const acc of accounts || []) {
    if (!(await planOk(acc.user_id))) continue;
    const lead = Math.min(120, Math.max(5, Number(acc.remind_minutes_before) || 15));
    const now = nowInTimezone(acc.timezone || "Africa/Lagos");

    const { data: goals } = await sb
      .from("goals")
      .select("id, title, done, start_time, due_date, duration_min")
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
        .from("telegram_reminder_log")
        .select("goal_id")
        .eq("goal_id", g.id)
        .eq("kind", kind)
        .maybeSingle();
      if (existing) continue;

      const result = await tgApi(token, "sendMessage", {
        chat_id: acc.chat_id,
        text,
        disable_web_page_preview: true,
      });
      if (!result.ok) {
        errors.push(String((result.data as { description?: string })?.description || "send failed"));
        continue;
      }
      await sb.from("telegram_reminder_log").upsert({
        goal_id: g.id,
        kind,
        sent_at: new Date().toISOString(),
      });
      sent += 1;
    }
  }

  return { sent, checked: (accounts || []).length, errors: errors.slice(0, 5) };
}

export function parseAdhocReminder(text: string, tz = "Africa/Lagos"): { body: string; fireAt: Date; whenLabel: string } | null {
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();
  if (!/\bremind(?:\s+me)?\b/.test(lower)) return null;
  if (/^\/reminders\b/.test(lower)) return null;
  if (/\breminders?\s+(on|off|enable|disable)\b/.test(lower)) return null;

  let delayMs = 0;
  let whenLabel = "";

  const rel = lower.match(/\bin\s+(\d+)\s*(minutes?|mins?|m|hours?|hrs?|h)\b/);
  if (rel) {
    const n = Number(rel[1]);
    if (!(n > 0)) return null;
    const unit = rel[2];
    if (/^h/.test(unit)) {
      if (n > 72) return null;
      delayMs = n * 60 * 60 * 1000;
      whenLabel = `in ${n} hour${n === 1 ? "" : "s"}`;
    } else {
      if (n > 24 * 60) return null;
      delayMs = n * 60 * 1000;
      whenLabel = `in ${n} min`;
    }
  } else {
    const at = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (!at) return null;
    let h = Number(at[1]);
    const min = at[2] ? Number(at[2]) : 0;
    const ap = at[3];
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    const now = nowInTimezone(tz);
    const target = h * 60 + min;
    let dayOffset = target <= now.minutes ? 1 : 0;
    // Africa/Lagos is UTC+1 year-round
    const lagosOffsetMin = 60;
    const probe = new Date();
    const utcMidnight = Date.UTC(probe.getUTCFullYear(), probe.getUTCMonth(), probe.getUTCDate());
    // If Lagos date is ahead of UTC date, adjust — use local date parts from nowInTimezone
    const [y, mo, d] = now.date.split("-").map(Number);
    const localMidnightUtc = Date.UTC(y, mo - 1, d) - lagosOffsetMin * 60 * 1000;
    const fireAt = new Date(localMidnightUtc + (dayOffset * 24 * 60 + target) * 60 * 1000);
    if (fireAt.getTime() <= Date.now() + 30_000) {
      fireAt.setTime(fireAt.getTime() + 24 * 60 * 60 * 1000);
      dayOffset = 1;
    }
    whenLabel = `at ${formatMins(target)}${dayOffset ? " tomorrow" : ""}`;
    let body = raw
      .replace(/\bremind(?:\s+me)?(?:\s+to|\s+about)?\s*/i, "")
      .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/i, "")
      .replace(/^(to|about)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!body || body.length < 2) body = "your thing";
    return { body: body.slice(0, 280), fireAt, whenLabel };
  }

  const fireAt = new Date(Date.now() + delayMs);
  let body = raw
    .replace(/\bremind(?:\s+me)?(?:\s+to|\s+about)?\s*/i, "")
    .replace(/\bin\s+\d+\s*(?:minutes?|mins?|m|hours?|hrs?|h)\b/i, "")
    .replace(/^(to|about)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
  // Also handle “remind me in 5 min to stretch” where "to stretch" remains
  if (!body || body.length < 2) body = "your thing";
  // Clean leftover leading “to ”
  body = body.replace(/^(to|about)\s+/i, "").trim() || "your thing";
  return { body: body.slice(0, 280), fireAt, whenLabel };
}


export function linkCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}

export async function tgApi(token: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && !!data?.ok, data };
}

export async function downloadTelegramFile(
  token: string,
  fileId: string,
): Promise<{ bytes: Uint8Array; mime: string; path: string } | null> {
  const meta = await tgApi(token, "getFile", { file_id: fileId });
  const path = String((meta.data as { result?: { file_path?: string } })?.result?.file_path || "");
  if (!meta.ok || !path) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${token}/${path}`);
  if (!res.ok) return null;
  const buf = new Uint8Array(await res.arrayBuffer());
  if (!buf.length || buf.length > 2_500_000) return null; // ~2.5MB cap
  let mime = "audio/ogg";
  if (/\.mp3$/i.test(path)) mime = "audio/mpeg";
  else if (/\.m4a$/i.test(path)) mime = "audio/mp4";
  else if (/\.wav$/i.test(path)) mime = "audio/wav";
  else if (/\.webm$/i.test(path)) mime = "audio/webm";
  return { bytes: buf, mime, path };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Transcribe a Telegram voice/audio note via Gemini. Returns plain text or null. */
export async function transcribeVoiceNote(
  token: string,
  fileId: string,
  apiKey: string,
  durationSec?: number,
): Promise<string | null> {
  if (durationSec != null && durationSec > 120) return null;
  if (!apiKey) return null;
  const file = await downloadTelegramFile(token, fileId);
  if (!file) return null;
  const b64 = bytesToBase64(file.bytes);
  const prompt =
    "Transcribe this voice note. Return ONLY the spoken words as plain text. No quotes, labels, or commentary. If silence or unintelligible, return an empty string.";
  const models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash"];
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inline_data: { mime_type: file.mime, data: b64 } },
          ],
        }],
        generationConfig: { temperature: 0.1 },
      }),
    });
    if (!res.ok) continue;
    const data = await res.json().catch(() => ({}));
    const raw = String(data?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
    if (raw) return raw.slice(0, 1200);
  }
  return null;
}

export async function reply(token: string, chatId: number, text: string) {
  const chunks: string[] = [];
  let rest = String(text || "").slice(0, 3900);
  while (rest.length) {
    chunks.push(rest.slice(0, 3500));
    rest = rest.slice(3500);
  }
  for (const chunk of chunks) {
    await tgApi(token, "sendMessage", {
      chat_id: chatId,
      text: chunk,
      disable_web_page_preview: true,
    });
  }
}

export async function primaryRoomId(userId: string): Promise<string | null> {
  const sb = adminClient();
  const { data } = await sb
    .from("room_members")
    .select("room_id, archived_at, joined_at, rooms(id, kind, parent_room_id, group_room_id)")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false })
    .limit(30);
  const rows = (data || []).filter((r) => !r.archived_at);
  // App Today board uses the workspace (space) room — not the nested group chat room
  for (const r of rows) {
    const room = r.rooms as { id?: string; kind?: string; parent_room_id?: string } | null;
    if (room?.kind === "space" && room.id) return room.id;
  }
  for (const r of rows) {
    const room = r.rooms as { id?: string; kind?: string; parent_room_id?: string } | null;
    if (room?.kind === "group" && room.parent_room_id) return room.parent_room_id;
  }
  return rows[0]?.room_id || null;
}

function endTimeFrom(start: string, durationMin: number) {
  const m = String(start).match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let mins = Number(m[1]) * 60 + Number(m[2]) + Math.max(1, durationMin);
  mins = ((mins % (24 * 60)) + 24 * 60) % (24 * 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
}

/** Local parse so “add gym today at 7” still creates a goal if Gemini returns empty goals. */
export function parseLocalGoals(text: string, today = todayIso()): Array<Record<string, unknown>> {
  const raw = String(text || "").trim();
  if (!raw || raw.length > 200) return [];
  const lower = raw.toLowerCase();
  if (/[?]/.test(raw)) return [];
  if (!/\b(add|create|lock|schedule|set|put|new)\b/.test(lower) &&
    !(/\b(today|tomorrow|tonight)\b/.test(lower) && /\bat\s+\d{1,2}/.test(lower))) {
    return [];
  }
  if (/\b(notion|calendar|remind me)\b/.test(lower)) return [];

  let due = today;
  if (/\btomorrow\b/.test(lower)) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    due = d.toISOString().slice(0, 10);
  }
  let start = "08:00";
  const tm = lower.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tm) {
    let h = Number(tm[1]);
    const min = tm[2] ? Number(tm[2]) : 0;
    const ap = (tm[3] || "").toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h <= 23 && min <= 59) start = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
  } else if (/\bafternoon\b/.test(lower)) start = "13:00";
  else if (/\b(night|evening|tonight)\b/.test(lower)) start = "19:00";

  let duration = 30;
  const hm = lower.match(/(\d+(?:\.\d+)?)\s*h(?:ou)?rs?/);
  const mm = lower.match(/(\d+)\s*mins?/);
  if (hm) duration = Math.round(Number(hm[1]) * 60);
  else if (mm) duration = Number(mm[1]);
  else if (/\ban?\s*hour\b/.test(lower)) duration = 60;

  let title = raw
    .replace(/\b(today|tomorrow|tonight|morning|afternoon|evening|night)\b/gi, " ")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, " ")
    .replace(/\bfor\s+\d+(?:\.\d+)?\s*(h(?:ou)?rs?|mins?|m)\b/gi, " ")
    .replace(/\b(add|create|lock\s*in|schedule|set|put|please|can you|mylo|milo|to my (today|list|tasks?)|a task|task)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 &'+/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Goal";
  title = title.slice(0, 80).replace(/^\w/, (c) => c.toUpperCase());
  return [{ title, due_date: due, start_time: start, duration_min: duration, scope: "day" }];
}

export async function createGoals(userId: string, drafts: Array<Record<string, unknown>>) {
  const roomId = await primaryRoomId(userId);
  if (!roomId) return { created: [] as string[], error: "No room found — open Mylo and enter a room first." };
  const sb = adminClient();
  const created: string[] = [];
  const errors: string[] = [];
  for (const g of drafts.slice(0, 5)) {
    const title = String(g.title || "Goal").slice(0, 80);
    const due = String(g.due_date || todayIso()).slice(0, 10);
    const start = g.start_time ? String(g.start_time).slice(0, 5) : "08:00";
    const duration = Number(g.duration_min) > 0 ? Number(g.duration_min) : 30;
    const end = endTimeFrom(start, duration);
    const { error } = await sb.from("goals").insert({
      room_id: roomId,
      owner_id: userId,
      title,
      scope: "day",
      due_date: due,
      start_time: start,
      end_time: end,
      duration_min: duration,
      done: false,
      is_shared: false,
    });
    if (error) errors.push(error.message || "insert failed");
    else created.push(title);
  }
  return { created, error: created.length ? undefined : (errors[0] || "Couldn’t add goal") };
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
  const { data: notion } = await sb.from("notion_accounts").select("workspace_name").eq("user_id", userId).maybeSingle();
  const { data: gcal } = await sb.from("google_calendar_accounts").select("email").eq("user_id", userId).maybeSingle();
  let gcalEvents: Array<{ google_event_id?: string; title?: string; starts_at?: string }> = [];
  try {
    const { data } = await sb
      .from("google_calendar_events")
      .select("google_event_id, title, starts_at, ends_at, html_link")
      .eq("user_id", userId)
      .gte("starts_at", new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .order("starts_at")
      .limit(12);
    gcalEvents = data || [];
  } catch {
    gcalEvents = [];
  }
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
    notion: {
      connected: !!notion,
      workspace: notion?.workspace_name || null,
    },
    google_calendar: {
      connected: !!gcal,
      email: gcal?.email || null,
      upcoming: (gcalEvents || []).map((ev) => ({
        id: ev.google_event_id,
        title: ev.title,
        starts_at: ev.starts_at,
      })),
    },
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

async function invokeUserFn(name: string, userId: string, payload: Record<string, unknown>) {
  const url = `${(Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "")}/functions/v1/${name}`;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${service}`,
      apikey: service,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ...payload, acting_user_id: userId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String((data as { error?: string })?.error || `${name} failed`));
  }
  return data as Record<string, unknown>;
}

function linkLabel(title: string, url?: string | null) {
  const t = String(title || "item").slice(0, 80);
  if (url) return `${t}\n${url}`;
  return t;
}

export async function runNotionActions(userId: string, actions: Array<Record<string, unknown>>) {
  const results: string[] = [];
  for (const a of (actions || []).slice(0, 5)) {
    const op = String(a.op || a.action || "").toLowerCase();
    try {
      if (op === "list" || op === "search") {
        const data = await invokeUserFn("notion", userId, {
          action: op === "search" ? "search" : "list_pages",
          query: a.query || "",
          limit: Number(a.limit) || 12,
        });
        const pages = (data.pages as Array<{ title?: string; url?: string; object?: string }> | undefined) || [];
        if (!pages.length) {
          results.push(
            (a.query
              ? `No Notion pages matched “${a.query}”.\n\n`
              : `Notion is connected, but Mylo can’t see any pages yet.\n\n`) +
              `In the app: You → Integrations → reconnect Notion and select pages.`,
          );
        } else {
          const lines = pages.slice(0, 12).map((p) =>
            `• ${p.title || "Untitled"}${p.object === "database" ? " (db)" : ""}${p.url ? `\n  ${p.url}` : ""}`
          );
          results.push(`Notion pages${a.query ? ` for “${a.query}”` : ""}:\n${lines.join("\n")}`);
        }
        continue;
      }
      if (op === "read") {
        const data = await invokeUserFn("notion", userId, {
          action: "read_page",
          page_id: a.page_id,
          query: a.query || a.title,
        });
        const preview = ((data.preview as string[]) || []).slice(0, 12);
        const page = data.page as { title?: string; url?: string } | undefined;
        const titled = linkLabel(page?.title || String(a.query || "page"), page?.url);
        results.push(preview.length ? `Notion ${titled}:\n${preview.join("\n")}` : `Opened Notion ${titled} (empty).`);
        continue;
      }
      if (op === "append" || op === "append_todo") {
        const data = await invokeUserFn("notion", userId, {
          action: op === "append_todo" || a.as_todo ? "append_todo" : "append",
          page_id: a.page_id,
          query: a.query || a.page_title,
          content: a.content || a.text || a.title,
          title: a.title,
          as_todo: !!a.as_todo,
          items: a.items,
        });
        results.push(`Updated Notion ${linkLabel(String(data.title || a.query || "page"), data.url as string)}.`);
        continue;
      }
      if (op === "rename") {
        const data = await invokeUserFn("notion", userId, {
          action: "rename_page",
          page_id: a.page_id,
          query: a.query,
          title: a.title,
        });
        results.push(`Renamed Notion page to ${linkLabel(String(data.title || a.title), data.url as string)}.`);
        continue;
      }
      if (op === "push_today") {
        const data = await invokeUserFn("notion", userId, { action: "push_today" });
        results.push(
          `Pushed Today to Notion as ${linkLabel(String(data.title || "Mylo · Today"), data.url as string)} (${data.count || 0} items).`,
        );
        continue;
      }
      if (op === "create") {
        const data = await invokeUserFn("notion", userId, {
          action: "create_page",
          title: a.title || "Mylo note",
          content: a.content || a.text || `Added by Mylo · ${todayIso()}`,
        });
        results.push(`Added ${linkLabel(String(data.title || a.title), data.url as string)} in Notion.`);
        continue;
      }
    } catch (e) {
      results.push(`Notion: ${String((e as Error)?.message || e)}`);
    }
  }
  return results.join("\n\n") || "";
}

export async function runCalendarActions(userId: string, actions: Array<Record<string, unknown>>) {
  const results: string[] = [];
  let cached: Array<{ id?: string; title?: string; starts_at?: string }> = [];

  const findEvent = (query: string) => {
    const q = String(query || "").toLowerCase().trim();
    if (!q) return null;
    return cached.find((ev) => String(ev.title || "").toLowerCase().includes(q)) || null;
  };

  for (const a of (actions || []).slice(0, 5)) {
    const op = String(a.op || a.action || "").toLowerCase();
    try {
      if (op === "list") {
        const data = await invokeUserFn("google-calendar", userId, {
          action: "list_events",
          days: Number(a.days) || 14,
        });
        const events = (data.events as Array<{ id?: string; title?: string; starts_at?: string }>) || [];
        cached = events;
        if (!events.length) results.push("Nothing upcoming on Google Calendar.");
        else {
          const lines = events.slice(0, 12).map((ev) => {
            const when = ev.starts_at
              ? new Date(ev.starts_at).toLocaleString("en-GB", {
                timeZone: "Africa/Lagos",
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
              : "sometime";
            return `• ${ev.title || "(No title)"} · ${when}`;
          });
          results.push(`Google Calendar upcoming:\n${lines.join("\n")}`);
        }
        continue;
      }
      if (op === "create") {
        const data = await invokeUserFn("google-calendar", userId, {
          action: "create_event",
          title: a.title,
          date: a.date || todayIso(),
          start_time: a.start_time || "09:00",
          duration_min: a.duration_min || 60,
          description: a.description || "Added by Mylo on Telegram",
        });
        const ev = data.event as { title?: string } | undefined;
        results.push(
          `Added to Google Calendar: ${ev?.title || a.title} · ${a.date || todayIso()} ${String(a.start_time || "").slice(0, 5)}`,
        );
        continue;
      }
      if (op === "update" || op === "delete") {
        let eventId = String(a.event_id || "").trim();
        if (!eventId && a.query) {
          if (!cached.length) {
            const listed = await invokeUserFn("google-calendar", userId, { action: "list_events", days: 21 });
            cached = (listed.events as typeof cached) || [];
          }
          eventId = findEvent(String(a.query))?.id || "";
        }
        if (!eventId) {
          results.push(`Couldn’t find that Google event to ${op}.`);
          continue;
        }
        if (op === "delete") {
          await invokeUserFn("google-calendar", userId, { action: "delete_event", event_id: eventId });
          results.push("Removed from Google Calendar.");
        } else {
          const data = await invokeUserFn("google-calendar", userId, {
            action: "update_event",
            event_id: eventId,
            title: a.title,
            date: a.date,
            start_time: a.start_time,
            duration_min: a.duration_min,
          });
          const ev = data.event as { title?: string } | undefined;
          results.push(`Updated Google event: ${ev?.title || a.title || "event"}`);
        }
        continue;
      }
    } catch (e) {
      results.push(`Google Calendar: ${String((e as Error)?.message || e)}`);
    }
  }
  return results.join("\n\n") || "";
}

export async function chatWithGemini(text: string, context: Record<string, unknown>, apiKey: string) {
  const prompt = `You are Mylo, a calm friend — not a child, not a coach, not corporate. The user is messaging you on Telegram.
Voice: warm, short, sure. Lowercase is fine. No hype. Never say "lock in" or "solid".
Today is ${context.today}.
User context JSON:
${JSON.stringify(context).slice(0, 3200)}

User message:
"""${String(text).slice(0, 800)}"""

Reply as Mylo in plain text (no markdown tables). Keep under 500 characters.
Return ONLY valid JSON:
{
  "reply": "short calm message",
  "goals": [],
  "calendar_actions": [],
  "notion_actions": []
}
Rules:
- Default goals / calendar_actions / notion_actions to [].
- Only fill goals when they clearly ask to add a Mylo Today task.
- goals schema: title, due_date, start_time, duration_min.
- If google_calendar.connected AND they ask to list/add/edit/delete Google Calendar events, fill calendar_actions:
  {"op":"list","days":14}
  {"op":"create","title":"...","date":"YYYY-MM-DD","start_time":"HH:MM","duration_min":60}
  {"op":"update","query":"event title fragment","title":"...","date":"YYYY-MM-DD","start_time":"HH:MM","duration_min":60}
  {"op":"delete","query":"event title fragment"}
- If Notion is connected AND they ask to use Notion (list/search/read/append/create/push today), fill notion_actions:
  {"op":"list"}
  {"op":"search","query":"..."}
  {"op":"read","query":"page title"}
  {"op":"create","title":"...","content":"..."}
  {"op":"append","query":"page title","content":"..."}
  {"op":"append_todo","query":"page title","title":"todo text"}
  {"op":"rename","query":"old","title":"new"}
  {"op":"push_today"}
- If they ask for Notion/Calendar but it is not connected, tell them to connect it in Mylo → You → Integrations (leave actions empty).
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
      const calendar_actions = (Array.isArray(parsed.calendar_actions) ? parsed.calendar_actions : [])
        .slice(0, 5)
        .filter((a: unknown) => a && typeof a === "object");
      const notion_actions = (Array.isArray(parsed.notion_actions) ? parsed.notion_actions : [])
        .slice(0, 5)
        .filter((a: unknown) => a && typeof a === "object");
      return {
        reply: String(parsed.reply || "I’m here.").slice(0, 900),
        goals: Array.isArray(parsed.goals) ? parsed.goals.slice(0, 5) : [],
        calendar_actions: calendar_actions as Array<Record<string, unknown>>,
        notion_actions: notion_actions as Array<Record<string, unknown>>,
      };
    } catch {
      return { reply: String(raw).slice(0, 900), goals: [], calendar_actions: [], notion_actions: [] };
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
  if (/help|what can you do|commands?/.test(lower) || lower === "/help") {
    return `I’m Mylo on Telegram.\n• Voice notes work\n• Notion + Google Calendar (if connected in the app)\n• “Remind me in 5 min to stretch”\n• “What’s left today?”\n• “Add gym today at 7 for 1 hour”\n• “What’s on my calendar?”\n• “Push today to Notion”\n\n/today — list Today\n/reminders on|off\n/unlink`;
  }
  if (/what('?s| is) left|today|list (my )?(goals|tasks)/.test(lower) || lower === "/today") {
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
