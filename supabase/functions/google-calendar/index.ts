import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
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

/** JWT user, or service-role acting as a Mylo user (Telegram bot). */
async function resolveUser(req: Request, body: Record<string, unknown>): Promise<{ id: string; viaJwt: boolean } | null> {
  const jwtUser = await userFromAuth(req);
  if (jwtUser?.id) return { id: jwtUser.id, viaJwt: true };
  const auth = req.headers.get("Authorization") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!service || auth !== `Bearer ${service}`) return null;
  const uid = String(body.acting_user_id || "").trim();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uid)) return null;
  return { id: uid, viaJwt: false };
}

function b64url(bytes: Uint8Array) {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function signState(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const body = b64url(new TextEncoder().encode(payload));
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

async function verifyState(state: string, secret: string) {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = b64url(new Uint8Array(
    await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)),
  ));
  if (expected !== sig) return null;
  const pad = "=".repeat((4 - (body.length % 4)) % 4);
  const jsonStr = atob(body.replace(/-/g, "+").replace(/_/g, "/") + pad);
  try {
    return JSON.parse(jsonStr) as { uid: string; origin: string; exp: number };
  } catch {
    return null;
  }
}

function callbackUrl() {
  const base = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
  return `${base}/functions/v1/google-calendar?action=callback`;
}

async function exchangeCode(code: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: callbackUrl(),
      grant_type: "authorization_code",
    }),
  });
  return await res.json();
}

async function refreshAccess(refreshToken: string, clientId: string, clientSecret: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  return await res.json();
}

async function googleFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function ensureAccessToken(userId: string, clientId: string, clientSecret: string) {
  const sb = adminClient();
  const { data: acc } = await sb.from("google_calendar_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (!acc?.refresh_token) return null;

  const expires = acc.token_expires_at ? new Date(acc.token_expires_at).getTime() : 0;
  if (acc.access_token && expires > Date.now() + 60_000) {
    return { accessToken: acc.access_token as string, calendarId: acc.calendar_id || "primary", acc };
  }

  const refreshed = await refreshAccess(acc.refresh_token, clientId, clientSecret);
  if (!refreshed.access_token) return null;
  const tokenExpires = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString();
  await sb.from("google_calendar_accounts").update({
    access_token: refreshed.access_token,
    token_expires_at: tokenExpires,
    refresh_token: refreshed.refresh_token || acc.refresh_token,
  }).eq("user_id", userId);

  return {
    accessToken: refreshed.access_token as string,
    calendarId: acc.calendar_id || "primary",
    acc: { ...acc, access_token: refreshed.access_token, token_expires_at: tokenExpires },
  };
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

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function localDateTime(date: string, time: string) {
  // date YYYY-MM-DD, time HH:MM or HH:MM:SS
  const t = (time || "09:00").slice(0, 5);
  return `${date}T${t}:00`;
}

function addMinutesLocal(date: string, time: string, mins: number) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = (time || "09:00").slice(0, 5).split(":").map(Number);
  const dt = new Date(y, m - 1, d, hh, mm || 0, 0);
  dt.setMinutes(dt.getMinutes() + (mins > 0 ? mins : 30));
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}:00`;
}

async function syncForUser(userId: string, clientId: string, clientSecret: string) {
  if (!(await planOk(userId))) {
    return { ok: false, error: "Google Calendar requires Pro or Pod" };
  }
  const tok = await ensureAccessToken(userId, clientId, clientSecret);
  if (!tok) return { ok: false, error: "Connect Google Calendar first" };

  const sb = adminClient();
  const accessToken = tok.accessToken;
  const calendarId = encodeURIComponent(tok.calendarId || "primary");

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const to = new Date();
  to.setDate(to.getDate() + 31);
  const fromIso = from.toISOString().slice(0, 10);
  const toIso = to.toISOString().slice(0, 10);

  // --- Push goals → Google ---
  const { data: goals } = await sb
    .from("goals")
    .select("id, title, due_date, start_time, end_time, duration_min, google_event_id, done, scope")
    .eq("owner_id", userId)
    .eq("scope", "day")
    .not("due_date", "is", null)
    .not("start_time", "is", null)
    .gte("due_date", fromIso)
    .lte("due_date", toIso);

  let pushed = 0;
  for (const g of goals || []) {
    const start = localDateTime(g.due_date, String(g.start_time).slice(0, 8));
    let end: string;
    if (g.end_time) end = localDateTime(g.due_date, String(g.end_time).slice(0, 8));
    else end = addMinutesLocal(g.due_date, String(g.start_time).slice(0, 8), Number(g.duration_min) || 30);

    const body = {
      summary: g.title + (g.done ? " ✓" : ""),
      description: "Synced from Mylo",
      start: { dateTime: start, timeZone: "Africa/Lagos" },
      end: { dateTime: end, timeZone: "Africa/Lagos" },
    };

    if (g.google_event_id) {
      const upd = await googleFetch(
        accessToken,
        `/calendars/${calendarId}/events/${encodeURIComponent(g.google_event_id)}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );
      if (upd.ok) pushed++;
      else if (upd.status === 404) {
        const created = await googleFetch(
          accessToken,
          `/calendars/${calendarId}/events`,
          { method: "POST", body: JSON.stringify(body) },
        );
        const eid = (created.data as { id?: string })?.id;
        if (created.ok && eid) {
          await sb.from("goals").update({ google_event_id: eid }).eq("id", g.id);
          pushed++;
        }
      }
    } else {
      const created = await googleFetch(
        accessToken,
        `/calendars/${calendarId}/events`,
        { method: "POST", body: JSON.stringify(body) },
      );
      const eid = (created.data as { id?: string })?.id;
      if (created.ok && eid) {
        await sb.from("goals").update({ google_event_id: eid }).eq("id", g.id);
        pushed++;
      }
    }
  }

  // Delete Google events for goals that no longer qualify (had id but out of set)
  // Skip aggressive deletes in v1 — only clear when goal deleted via app later.

  // --- Pull Google → cache ---
  const timeMin = new Date(fromIso + "T00:00:00Z").toISOString();
  const timeMax = new Date(toIso + "T23:59:59Z").toISOString();
  const list = await googleFetch(
    accessToken,
    `/calendars/${calendarId}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&maxResults=250`,
  );

  const items = ((list.data as { items?: unknown[] })?.items || []) as Array<{
    id: string;
    summary?: string;
    htmlLink?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
  }>;

  // Drop previous cache window for user
  await sb.from("google_calendar_events").delete().eq("user_id", userId);

  // Skip events that originated from our push (description) optionally keep them —
  // still show pulled events; Mylo goals already show separately.
  const rows = items.filter((ev) => ev.id).map((ev) => {
    const allDay = !ev.start?.dateTime && !!ev.start?.date;
    return {
      user_id: userId,
      google_event_id: ev.id,
      title: ev.summary || "(No title)",
      starts_at: ev.start?.dateTime || (ev.start?.date ? `${ev.start.date}T00:00:00Z` : null),
      ends_at: ev.end?.dateTime || (ev.end?.date ? `${ev.end.date}T00:00:00Z` : null),
      all_day: allDay,
      html_link: ev.htmlLink || null,
      synced_at: new Date().toISOString(),
    };
  });

  if (rows.length) {
    await sb.from("google_calendar_events").upsert(rows, { onConflict: "user_id,google_event_id" });
  }

  await sb.from("google_calendar_accounts").update({
    last_sync_at: new Date().toISOString(),
  }).eq("user_id", userId);

  return { ok: true, pushed, pulled: rows.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = new URL(req.url);
  let action = url.searchParams.get("action") || "";
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
    if (!action) action = String(body.action || "sync");
  }
  if (!action && req.method === "GET") action = "callback";

  const clientId = await loadSecret("GOOGLE_CLIENT_ID");
  const clientSecret = await loadSecret("GOOGLE_CLIENT_SECRET");
  const stateSecret = (await loadSecret("GCAL_STATE_SECRET")) || clientSecret || "mylo-gcal";

  // OAuth callback (no JWT)
  if (action === "callback") {
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const err = url.searchParams.get("error");
    const parsed = await verifyState(state, stateSecret);
    const origin = (parsed?.origin || "https://app.staymylo.com").replace(/\/$/, "");
    if (err || !code || !parsed?.uid || parsed.exp < Date.now()) {
      return Response.redirect(`${origin}/?gcal=err`, 302);
    }
    if (!clientId || !clientSecret) {
      return Response.redirect(`${origin}/?gcal=noconfig`, 302);
    }
    const token = await exchangeCode(code, clientId, clientSecret);
    if (!token.refresh_token && !token.access_token) {
      return Response.redirect(`${origin}/?gcal=err`, 302);
    }

    let email = "";
    if (token.access_token) {
      const ui = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (ui.ok) {
        const u = await ui.json();
        email = String(u.email || "");
      }
    }

    const sb = adminClient();
    const { data: existing } = await sb.from("google_calendar_accounts").select("refresh_token").eq("user_id", parsed.uid).maybeSingle();
    const refresh = token.refresh_token || existing?.refresh_token;
    if (!refresh) {
      return Response.redirect(`${origin}/?gcal=err`, 302);
    }

    await sb.from("google_calendar_accounts").upsert({
      user_id: parsed.uid,
      refresh_token: refresh,
      access_token: token.access_token || null,
      token_expires_at: token.expires_in
        ? new Date(Date.now() + Number(token.expires_in) * 1000).toISOString()
        : null,
      calendar_id: "primary",
      email: email || null,
      connected_at: new Date().toISOString(),
    });

    // Initial sync (best-effort)
    try { await syncForUser(parsed.uid, clientId, clientSecret); } catch (_) { /* ignore */ }

    return Response.redirect(`${origin}/?gcal=1`, 302);
  }

  if (!clientId || !clientSecret) {
    return json({ error: "Google Calendar is not configured yet", configured: false }, 503);
  }

  const resolved = await resolveUser(req, body);
  if (!resolved) return json({ error: "sign in required" }, 401);
  const user = { id: resolved.id };

  if (action === "connect") {
    if (!resolved.viaJwt) return json({ error: "sign in required" }, 401);
    if (!(await planOk(user.id))) {
      return json({ error: "Google Calendar requires Pro or Pod", plan_ok: false }, 403);
    }
    const origin = String(body.callback_origin || "https://app.staymylo.com").replace(/\/$/, "");
    const state = await signState(JSON.stringify({
      uid: user.id,
      origin,
      exp: Date.now() + 15 * 60 * 1000,
    }), stateSecret);
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", callbackUrl());
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", SCOPES);
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
    authUrl.searchParams.set("state", state);
    return json({ ok: true, url: authUrl.toString() });
  }

  if (action === "status") {
    const sb = adminClient();
    const { data: acc } = await sb.from("google_calendar_accounts").select("email, last_sync_at, connected_at").eq("user_id", user.id).maybeSingle();
    return json({
      ok: true,
      configured: true,
      connected: !!acc,
      plan_ok: await planOk(user.id),
      email: acc?.email || null,
      last_sync_at: acc?.last_sync_at || null,
    });
  }

  if (action === "sync") {
    const result = await syncForUser(user.id, clientId, clientSecret);
    if (!result.ok) return json(result, result.error?.includes("Pro") ? 403 : 400);
    return json(result);
  }

  if (action === "create_event" || action === "update_event" || action === "delete_event" || action === "list_events") {
    if (!(await planOk(user.id))) {
      return json({ error: "Google Calendar requires Pro or Pod", plan_ok: false }, 403);
    }
    const tok = await ensureAccessToken(user.id, clientId, clientSecret);
    if (!tok) return json({ error: "Connect Google Calendar first" }, 400);
    const accessToken = tok.accessToken;
    const calendarId = encodeURIComponent(tok.calendarId || "primary");
    const sb = adminClient();

    if (action === "list_events") {
      const days = Math.min(60, Math.max(1, Number(body.days) || 14));
      const from = new Date();
      const to = new Date();
      to.setDate(to.getDate() + days);
      const list = await googleFetch(
        accessToken,
        `/calendars/${calendarId}/events?singleEvents=true&orderBy=startTime&timeMin=${encodeURIComponent(from.toISOString())}&timeMax=${encodeURIComponent(to.toISOString())}&maxResults=40`,
      );
      if (!list.ok) return json({ error: "Could not list Google events", detail: list.data }, 400);
      const items = ((list.data as { items?: unknown[] })?.items || []) as Array<{
        id: string;
        summary?: string;
        htmlLink?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
      const events = items.filter((ev) => ev.id).map((ev) => ({
        id: ev.id,
        title: ev.summary || "(No title)",
        starts_at: ev.start?.dateTime || ev.start?.date || null,
        ends_at: ev.end?.dateTime || ev.end?.date || null,
        html_link: ev.htmlLink || null,
        all_day: !ev.start?.dateTime && !!ev.start?.date,
      }));
      return json({ ok: true, events });
    }

    if (action === "delete_event") {
      const eventId = String(body.event_id || "").trim();
      if (!eventId) return json({ error: "missing event_id" }, 400);
      const del = await googleFetch(
        accessToken,
        `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
        { method: "DELETE" },
      );
      if (!del.ok && del.status !== 404 && del.status !== 410) {
        return json({ error: "Could not delete event", detail: del.data }, 400);
      }
      await sb.from("google_calendar_events").delete().eq("user_id", user.id).eq("google_event_id", eventId);
      await sb.from("goals").update({ google_event_id: null }).eq("owner_id", user.id).eq("google_event_id", eventId);
      return json({ ok: true, deleted: eventId });
    }

    const title = String(body.title || "").trim().slice(0, 200);
    const date = String(body.date || "").slice(0, 10);
    const startTime = String(body.start_time || "09:00").slice(0, 5);
    const durationMin = Number(body.duration_min) > 0 ? Number(body.duration_min) : 60;
    const description = String(body.description || "Added by Mylo on Mylo").slice(0, 500);

    if (action === "create_event") {
      if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return json({ error: "Need title and date (YYYY-MM-DD)" }, 400);
      }
      const start = localDateTime(date, startTime);
      const end = addMinutesLocal(date, startTime, durationMin);
      const created = await googleFetch(
        accessToken,
        `/calendars/${calendarId}/events`,
        {
          method: "POST",
          body: JSON.stringify({
            summary: title,
            description,
            start: { dateTime: start, timeZone: "Africa/Lagos" },
            end: { dateTime: end, timeZone: "Africa/Lagos" },
          }),
        },
      );
      const eid = (created.data as { id?: string; htmlLink?: string })?.id;
      if (!created.ok || !eid) return json({ error: "Could not create event", detail: created.data }, 400);
      await sb.from("google_calendar_events").upsert({
        user_id: user.id,
        google_event_id: eid,
        title,
        starts_at: new Date(start + "+01:00").toISOString(),
        ends_at: new Date(end + "+01:00").toISOString(),
        all_day: false,
        html_link: (created.data as { htmlLink?: string })?.htmlLink || null,
        synced_at: new Date().toISOString(),
      }, { onConflict: "user_id,google_event_id" });
      return json({
        ok: true,
        event: {
          id: eid,
          title,
          date,
          start_time: startTime,
          duration_min: durationMin,
          html_link: (created.data as { htmlLink?: string })?.htmlLink || null,
        },
      });
    }

    // update_event
    const eventId = String(body.event_id || "").trim();
    if (!eventId) return json({ error: "missing event_id" }, 400);
    const patch: Record<string, unknown> = {};
    if (title) patch.summary = title;
    if (description) patch.description = description;
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const start = localDateTime(date, startTime);
      const end = addMinutesLocal(date, startTime, durationMin);
      patch.start = { dateTime: start, timeZone: "Africa/Lagos" };
      patch.end = { dateTime: end, timeZone: "Africa/Lagos" };
    }
    const upd = await googleFetch(
      accessToken,
      `/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    if (!upd.ok) return json({ error: "Could not update event", detail: upd.data }, 400);
    const ud = upd.data as { id?: string; summary?: string; htmlLink?: string; start?: { dateTime?: string }; end?: { dateTime?: string } };
    await sb.from("google_calendar_events").upsert({
      user_id: user.id,
      google_event_id: eventId,
      title: ud.summary || title || "Event",
      starts_at: ud.start?.dateTime || null,
      ends_at: ud.end?.dateTime || null,
      all_day: false,
      html_link: ud.htmlLink || null,
      synced_at: new Date().toISOString(),
    }, { onConflict: "user_id,google_event_id" });
    return json({ ok: true, event: { id: eventId, title: ud.summary || title, html_link: ud.htmlLink || null } });
  }

  if (action === "disconnect") {
    if (!resolved.viaJwt) return json({ error: "sign in required" }, 401);
    const sb = adminClient();
    const tok = await ensureAccessToken(user.id, clientId, clientSecret);
    if (tok?.accessToken) {
      try {
        await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(tok.accessToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        });
      } catch (_) { /* ignore */ }
    }
    await sb.from("google_calendar_events").delete().eq("user_id", user.id);
    await sb.from("goals").update({ google_event_id: null }).eq("owner_id", user.id);
    await sb.from("google_calendar_accounts").delete().eq("user_id", user.id);
    return json({ ok: true, disconnected: true });
  }

  return json({ error: "unknown action" }, 400);
});
