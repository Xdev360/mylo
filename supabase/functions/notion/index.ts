import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_VERSION = "2022-06-28";

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
  return `${base}/functions/v1/notion?action=callback`;
}

function basicAuth(clientId: string, clientSecret: string) {
  return `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
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

async function notionFetch(accessToken: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  return { ok: res.ok, status: res.status, data };
}

async function searchNotion(accessToken: string, opts: { query?: string; pageSize?: number } = {}) {
  // No object filter — OAuth users often share a database, and older filters can miss items.
  return notionFetch(accessToken, "/search", {
    method: "POST",
    body: JSON.stringify({
      query: opts.query || undefined,
      page_size: Math.min(25, Math.max(5, opts.pageSize || 12)),
      sort: { direction: "descending", timestamp: "last_edited_time" },
    }),
  });
}

function itemTitle(item: { object?: string; properties?: Record<string, unknown>; title?: Array<{ plain_text?: string }> }) {
  if (item.object === "database") {
    const t = (item.title || []).map((x) => x.plain_text || "").join("").trim();
    return t || "Untitled database";
  }
  return pageTitleFromProps(item.properties);
}

async function ensureParentPage(accessToken: string, userId: string, storedParent: string | null) {
  if (storedParent) {
    const check = await notionFetch(accessToken, `/pages/${storedParent}`);
    if (check.ok) return storedParent;
  }
  const search = await searchNotion(accessToken, { pageSize: 20 });
  const results = ((search.data as { results?: Array<{ id: string; object?: string; properties?: Record<string, unknown>; title?: Array<{ plain_text?: string }> }> })?.results) || [];
  const pages = results.filter((r) => r.object === "page" || !r.object);
  if (!pages.length) return null;

  // Prefer a page titled Mylo
  for (const p of pages) {
    const title = itemTitle(p).toLowerCase();
    if (title === "mylo") {
      await adminClient().from("notion_accounts").update({ parent_page_id: p.id }).eq("user_id", userId);
      return p.id;
    }
  }

  const parentId = pages[0].id;
  // Create a Mylo hub page under first shared page
  const created = await notionFetch(accessToken, "/pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { page_id: parentId },
      properties: {
        title: { title: [{ type: "text", text: { content: "Mylo" } }] },
      },
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: "Pages Mylo adds from your lock-in pod land here." } }],
          },
        },
      ],
    }),
  });
  const hubId = (created.data as { id?: string })?.id || parentId;
  await adminClient().from("notion_accounts").update({ parent_page_id: hubId }).eq("user_id", userId);
  return hubId;
}

function todoBlocks(items: Array<{ title: string; done?: boolean }>) {
  return items.slice(0, 40).map((it) => ({
    object: "block",
    type: "to_do",
    to_do: {
      rich_text: [{ type: "text", text: { content: String(it.title || "Task").slice(0, 2000) } }],
      checked: !!it.done,
    },
  }));
}

function pageTitleFromProps(properties: Record<string, unknown> | undefined) {
  if (!properties) return "Untitled";
  for (const val of Object.values(properties)) {
    const v = val as { type?: string; title?: Array<{ plain_text?: string }> };
    if (v?.type === "title") {
      const t = (v.title || []).map((x) => x.plain_text || "").join("").trim();
      return t || "Untitled";
    }
  }
  return "Untitled";
}

async function findPageByQuery(accessToken: string, query: string) {
  const q = String(query || "").trim();
  if (!q) return null;
  const search = await notionFetch(accessToken, "/search", {
    method: "POST",
    body: JSON.stringify({
      query: q,
      filter: { property: "object", value: "page" },
      page_size: 10,
    }),
  });
  const results = ((search.data as { results?: Array<{ id: string; url?: string; properties?: Record<string, unknown> }> })?.results) || [];
  if (!results.length) return null;
  const lower = q.toLowerCase();
  const exact = results.find((p) => pageTitleFromProps(p.properties).toLowerCase() === lower);
  const hit = exact || results[0];
  return {
    id: hit.id,
    url: hit.url || null,
    title: pageTitleFromProps(hit.properties),
  };
}

async function requireNotionAccount(userId: string) {
  if (!(await planOk(userId))) {
    return { error: json({ error: "Notion requires Pro or Pod", plan_ok: false }, 403) };
  }
  const sb = adminClient();
  const { data: acc } = await sb.from("notion_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (!acc?.access_token) {
    return { error: json({ error: "Connect Notion first" }, 400) };
  }
  return { acc, sb };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
  const url = new URL(req.url);
  let action = url.searchParams.get("action") || "";
  let body: Record<string, unknown> = {};
  if (req.method === "POST") {
    try { body = await req.json(); } catch { body = {}; }
    if (!action) action = String(body.action || "status");
  }
  if (!action && req.method === "GET") action = "callback";

  const clientId = await loadSecret("NOTION_CLIENT_ID");
  const clientSecret = await loadSecret("NOTION_CLIENT_SECRET");
  const stateSecret = (await loadSecret("NOTION_STATE_SECRET")) || clientSecret || "mylo-notion";

  if (action === "callback") {
    const code = url.searchParams.get("code") || "";
    const state = url.searchParams.get("state") || "";
    const err = url.searchParams.get("error");
    const parsed = await verifyState(state, stateSecret);
    const origin = (parsed?.origin || "https://app.staymylo.com").replace(/\/$/, "");
    if (err || !code || !parsed?.uid || parsed.exp < Date.now()) {
      return Response.redirect(`${origin}/?notion=err`, 302);
    }
    if (!clientId || !clientSecret) {
      return Response.redirect(`${origin}/?notion=noconfig`, 302);
    }

    const tokenRes = await fetch("https://api.notion.com/v1/oauth/token", {
      method: "POST",
      headers: {
        Authorization: basicAuth(clientId, clientSecret),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackUrl(),
      }),
    });
    const token = await tokenRes.json();
    if (!tokenRes.ok || !token.access_token) {
      return Response.redirect(`${origin}/?notion=err`, 302);
    }

    const sb = adminClient();
    await sb.from("notion_accounts").upsert({
      user_id: parsed.uid,
      access_token: token.access_token,
      workspace_id: token.workspace_id || null,
      workspace_name: token.workspace_name || null,
      bot_id: token.bot_id || null,
      connected_at: new Date().toISOString(),
    });

    let hasPages = false;
    try {
      const parent = await ensureParentPage(token.access_token, parsed.uid, null);
      hasPages = !!parent;
      if (!hasPages) {
        const probe = await searchNotion(token.access_token, { pageSize: 5 });
        const n = ((probe.data as { results?: unknown[] })?.results || []).length;
        hasPages = n > 0;
      }
    } catch (_) { /* ignore */ }

    return Response.redirect(`${origin}/?notion=${hasPages ? "1" : "nopages"}`, 302);
  }

  if (!clientId || !clientSecret) {
    return json({ error: "Notion is not configured yet", configured: false }, 503);
  }

  const resolved = await resolveUser(req, body);
  if (!resolved) return json({ error: "sign in required" }, 401);
  const user = { id: resolved.id };

  if (action === "connect") {
    if (!resolved.viaJwt) return json({ error: "sign in required" }, 401);
    if (!(await planOk(user.id))) {
      return json({ error: "Notion requires Pro or Pod", plan_ok: false }, 403);
    }
    const origin = String(body.callback_origin || "https://app.staymylo.com").replace(/\/$/, "");
    const state = await signState(JSON.stringify({
      uid: user.id,
      origin,
      exp: Date.now() + 15 * 60 * 1000,
    }), stateSecret);
    const authUrl = new URL("https://api.notion.com/v1/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("owner", "user");
    authUrl.searchParams.set("redirect_uri", callbackUrl());
    authUrl.searchParams.set("state", state);
    return json({ ok: true, url: authUrl.toString() });
  }

  if (action === "status") {
    const sb = adminClient();
    const { data: acc } = await sb.from("notion_accounts")
      .select("workspace_name, parent_page_id, last_sync_at, connected_at")
      .eq("user_id", user.id)
      .maybeSingle();
    return json({
      ok: true,
      configured: true,
      connected: !!acc,
      plan_ok: await planOk(user.id),
      workspace_name: acc?.workspace_name || null,
      parent_page_id: acc?.parent_page_id || null,
      last_sync_at: acc?.last_sync_at || null,
    });
  }

  if (action === "disconnect") {
    if (!resolved.viaJwt) return json({ error: "sign in required" }, 401);
    const sb = adminClient();
    await sb.from("notion_accounts").delete().eq("user_id", user.id);
    return json({ ok: true, disconnected: true });
  }

  if (action === "search" || action === "list_pages") {
    const gate = await requireNotionAccount(user.id);
    if (gate.error) return gate.error;
    const { acc, sb } = gate;
    const query = String(body.query || "").trim();
    const search = await searchNotion(acc.access_token, {
      query,
      pageSize: Number(body.limit) || 12,
    });
    if (!search.ok) {
      const detail = search.data as { message?: string; code?: string } | null;
      return json({
        error: detail?.message || "Could not search Notion. Reconnect Notion and pick pages in the allow screen.",
        detail: search.data,
      }, 400);
    }
    const results = ((search.data as {
      results?: Array<{
        id: string;
        object?: string;
        url?: string;
        properties?: Record<string, unknown>;
        title?: Array<{ plain_text?: string }>;
        last_edited_time?: string;
      }>;
    })?.results) || [];
    const pages = results.map((p) => ({
      id: p.id,
      object: p.object || "page",
      title: itemTitle(p),
      url: p.url || null,
      last_edited_time: p.last_edited_time || null,
    }));
    // If we found pages but never stored a parent hub, pin one now
    if (pages.some((p) => p.object === "page") && !acc.parent_page_id) {
      try {
        await ensureParentPage(acc.access_token, user.id, null);
      } catch (_) { /* ignore */ }
    }
    await sb.from("notion_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
    return json({
      ok: true,
      pages,
      page_count: pages.length,
      hint: pages.length ? null :
        "Notion is connected, but no pages were shared with Mylo. Disconnect → Connect Notion again, then select pages in Notion’s allow screen (or open a page → ••• → Connections → Add connection → Mylo).",
    });
  }

  if (action === "read_page") {
    const gate = await requireNotionAccount(user.id);
    if (gate.error) return gate.error;
    const { acc } = gate;
    let pageId = String(body.page_id || "").trim();
    const query = String(body.query || body.title || "").trim();
    if (!pageId && query) {
      const found = await findPageByQuery(acc.access_token, query);
      if (!found) return json({ error: `Couldn’t find Notion page “${query}”` }, 404);
      pageId = found.id;
    }
    if (!pageId) return json({ error: "Need page_id or query" }, 400);

    const pageRes = await notionFetch(acc.access_token, `/pages/${pageId}`);
    if (!pageRes.ok) return json({ error: "Could not read page", detail: pageRes.data }, 400);
    const blocksRes = await notionFetch(acc.access_token, `/blocks/${pageId}/children?page_size=30`);
    const blocks = ((blocksRes.data as { results?: Array<Record<string, unknown>> })?.results) || [];
    const lines = blocks.map((b) => {
      const type = String(b.type || "");
      const node = b[type] as { rich_text?: Array<{ plain_text?: string }>; checked?: boolean } | undefined;
      const text = (node?.rich_text || []).map((t) => t.plain_text || "").join("").trim();
      if (!text) return null;
      if (type === "to_do") return `${node?.checked ? "✓" : "○"} ${text}`;
      return `• ${text}`;
    }).filter(Boolean);
    const page = pageRes.data as { id?: string; url?: string; properties?: Record<string, unknown> };
    return json({
      ok: true,
      page: {
        id: page.id,
        url: page.url || null,
        title: pageTitleFromProps(page.properties),
      },
      preview: lines.slice(0, 20),
    });
  }

  if (action === "append" || action === "append_todo") {
    const gate = await requireNotionAccount(user.id);
    if (gate.error) return gate.error;
    const { acc, sb } = gate;
    let pageId = String(body.page_id || "").trim();
    const query = String(body.query || body.page_title || "").trim();
    if (!pageId) {
      if (query) {
        const found = await findPageByQuery(acc.access_token, query);
        if (!found) return json({ error: `Couldn’t find Notion page “${query}”` }, 404);
        pageId = found.id;
      } else {
        pageId = await ensureParentPage(acc.access_token, user.id, acc.parent_page_id) || "";
      }
    }
    if (!pageId) {
      return json({ error: "Share at least one Notion page with Mylo, then try again." }, 400);
    }

    let children: unknown[] = [];
    if (action === "append_todo" || body.as_todo) {
      const items = Array.isArray(body.items)
        ? (body.items as Array<{ title?: string; done?: boolean }>)
        : [{ title: String(body.content || body.title || "Task"), done: false }];
      children = todoBlocks(items.map((it) => ({ title: String(it.title || "Task"), done: !!it.done })));
    } else {
      const content = String(body.content || body.text || "").trim().slice(0, 4000);
      if (!content) return json({ error: "Nothing to append" }, 400);
      children = [{
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content } }] },
      }];
    }

    const appended = await notionFetch(acc.access_token, `/blocks/${pageId}/children`, {
      method: "PATCH",
      body: JSON.stringify({ children }),
    });
    if (!appended.ok) return json({ error: "Could not edit Notion page", detail: appended.data }, 400);
    await sb.from("notion_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
    const pageRes = await notionFetch(acc.access_token, `/pages/${pageId}`);
    const page = pageRes.data as { url?: string; properties?: Record<string, unknown> };
    return json({
      ok: true,
      page_id: pageId,
      url: page?.url || null,
      title: pageTitleFromProps(page?.properties),
      appended: children.length,
    });
  }

  if (action === "rename_page") {
    const gate = await requireNotionAccount(user.id);
    if (gate.error) return gate.error;
    const { acc, sb } = gate;
    let pageId = String(body.page_id || "").trim();
    const query = String(body.query || "").trim();
    const newTitle = String(body.title || "").trim().slice(0, 200);
    if (!newTitle) return json({ error: "Need a new title" }, 400);
    if (!pageId && query) {
      const found = await findPageByQuery(acc.access_token, query);
      if (!found) return json({ error: `Couldn’t find Notion page “${query}”` }, 404);
      pageId = found.id;
    }
    if (!pageId) return json({ error: "Need page_id or query" }, 400);

    // Find title property key
    const pageRes = await notionFetch(acc.access_token, `/pages/${pageId}`);
    if (!pageRes.ok) return json({ error: "Could not read page", detail: pageRes.data }, 400);
    const props = (pageRes.data as { properties?: Record<string, unknown> }).properties || {};
    let titleKey = "title";
    for (const [k, val] of Object.entries(props)) {
      if ((val as { type?: string })?.type === "title") { titleKey = k; break; }
    }
    const upd = await notionFetch(acc.access_token, `/pages/${pageId}`, {
      method: "PATCH",
      body: JSON.stringify({
        properties: {
          [titleKey]: { title: [{ type: "text", text: { content: newTitle } }] },
        },
      }),
    });
    if (!upd.ok) return json({ error: "Could not rename Notion page", detail: upd.data }, 400);
    await sb.from("notion_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
    const page = upd.data as { id?: string; url?: string };
    return json({ ok: true, page_id: page.id || pageId, url: page.url || null, title: newTitle });
  }

  if (action === "push_today" || action === "create_page") {
    const gate = await requireNotionAccount(user.id);
    if (gate.error) return gate.error;
    const { acc, sb } = gate;

    const parent = await ensureParentPage(acc.access_token, user.id, acc.parent_page_id);
    if (!parent) {
      return json({
        error: "Share at least one Notion page with Mylo (in the Notion allow screen), then try again.",
      }, 400);
    }

    let items: Array<{ title: string; done?: boolean }> = [];
    if (action === "push_today") {
      const today = String(body.today || new Date().toISOString().slice(0, 10)).slice(0, 10);
      const roomId = body.room_id ? String(body.room_id) : null;
      let q = sb.from("goals")
        .select("title, done, scope, due_date, owner_id")
        .eq("owner_id", user.id)
        .eq("scope", "day")
        .eq("due_date", today);
      if (roomId) q = q.eq("room_id", roomId);
      const { data: goals } = await q.order("created_at");
      items = (goals || []).map((g) => ({ title: g.title, done: !!g.done }));
      if (!items.length && Array.isArray(body.items)) {
        items = (body.items as Array<{ title?: string; done?: boolean }>).map((it) => ({
          title: String(it.title || "Task"),
          done: !!it.done,
        }));
      }
      if (!items.length) {
        return json({ error: "Nothing on Today to push" }, 400);
      }

      const title = `Mylo · Today ${today}`;
      const created = await notionFetch(acc.access_token, "/pages", {
        method: "POST",
        body: JSON.stringify({
          parent: { page_id: parent },
          properties: {
            title: { title: [{ type: "text", text: { content: title } }] },
          },
          children: [
            {
              object: "block",
              type: "paragraph",
              paragraph: {
                rich_text: [{ type: "text", text: { content: "Synced from Mylo (not a full live sync)." } }],
              },
            },
            ...todoBlocks(items),
          ],
        }),
      });
      if (!created.ok) return json({ error: "Could not create Notion page", detail: created.data }, 400);
      await sb.from("notion_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
      const page = created.data as { id?: string; url?: string };
      return json({ ok: true, page_id: page.id, url: page.url, title, count: items.length });
    }

    // create_page — single note/task page
    const title = String(body.title || "Mylo note").slice(0, 200);
    const content = String(body.content || "").slice(0, 4000);
    const children = content
      ? [{
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ type: "text", text: { content } }] },
      }]
      : todoBlocks([{ title, done: false }]);

    const created = await notionFetch(acc.access_token, "/pages", {
      method: "POST",
      body: JSON.stringify({
        parent: { page_id: parent },
        properties: {
          title: { title: [{ type: "text", text: { content: title } }] },
        },
        children,
      }),
    });
    if (!created.ok) return json({ error: "Could not create Notion page", detail: created.data }, 400);
    await sb.from("notion_accounts").update({ last_sync_at: new Date().toISOString() }).eq("user_id", user.id);
    const page = created.data as { id?: string; url?: string };
    return json({ ok: true, page_id: page.id, url: page.url, title });
  }

  return json({ error: "unknown action" }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e || "Notion failed") }, 500);
  }
});
