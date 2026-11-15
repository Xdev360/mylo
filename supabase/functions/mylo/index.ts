import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type GoalDraft = {
  title: string;
  scope: "day" | "week" | "month" | "year";
  due_date: string | null;
  start_time: string | null;
  duration_min: number | null;
  is_shared: boolean;
  category_name: string | null;
};

const CAT_HINTS: { name: string; words: RegExp }[] = [
  { name: "Fitness", words: /\b(gym|workout|work\s*out|run|running|lift|lifting|exercise|fitness|cardio|walk|walking|bike|cycling|yoga|stretch|weights?|squat|deadlift|hiit)\b/i },
  { name: "Study", words: /\b(study|studying|read|reading|homework|exam|learn|learning|school|class|revise|revision|assignment|essay|lecture|course|code|coding|programming)\b/i },
  { name: "Prayer", words: /\b(prayer|pray|fajr|dhuhr|asr|maghrib|isha|salah|namaz|mosque|church|worship|quran|bible)\b/i },
  { name: "Health", words: /\b(health|doctor|meds?|medicine|therapy|mental|meditat|sleep|hydrate|water|vitamins?|dentist)\b/i },
  { name: "Food", words: /\b(cook|cooking|meal|meals|eat|eating|food|grocery|groceries|breakfast|lunch|dinner|prep|recipe)\b/i },
  { name: "Work", words: /\b(work|job|office|meeting|deadline|client|email|emails|deep\s*work|career|business)\b/i },
  { name: "Creative", words: /\b(draw|drawing|paint|design|write|writing|music|practice|create|creative|edit|film|photo)\b/i },
  { name: "Chores", words: /\b(clean|cleaning|laundry|dishes|chores?|tidy|errands?|trash|vacuum)\b/i },
  { name: "Social", words: /\b(call|hangout|friends?|family|date|visit|meet\s*up|social)\b/i },
  { name: "Finance", words: /\b(budget|money|bills?|save|saving|invest|finance|pay|invoice)\b/i },
];

function inferCategory(title: string, blob: string, existing: string[]): string | null {
  const text = `${title} ${blob}`;
  for (const name of existing) {
    if (!name) continue;
    try {
      if (new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text)) {
        return name;
      }
    } catch {
      /* skip bad name */
    }
  }
  for (const h of CAT_HINTS) {
    if (h.words.test(text)) return h.name;
  }
  return null;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function isoFromDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDaysIso(iso: string, n: number) {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return isoFromDate(d);
}
function minsToTime(total: number) {
  const n = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
}

function parseClock(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  let m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

function daypartDefault(part: string) {
  if (part === "morning") return 8 * 60;
  if (part === "afternoon") return 13 * 60;
  if (part === "night" || part === "evening") return 19 * 60;
  return 9 * 60;
}

function parseDuration(chunk: string): number | null {
  const lower = chunk.toLowerCase();
  let m = lower.match(/(\d+(?:\.\d+)?)\s*h(?:ou)?rs?/);
  if (m) return Math.round(Number(m[1]) * 60);
  m = lower.match(/(\d+)\s*mins?/);
  if (m) return Number(m[1]);
  m = lower.match(/for\s+(\d+)\s*m\b/);
  if (m) return Number(m[1]);
  if (/\bhalf\s*an?\s*hour\b/.test(lower)) return 30;
  if (/\ban?\s*hour\b/.test(lower)) return 60;
  return null;
}

function cleanTitle(chunk: string) {
  let t = chunk
    .replace(/\b(today|tomorrow|tonight|this\s+week|next\s+week|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/gi, " ")
    .replace(/\b(morning|afternoon|evening|night)\b/gi, " ")
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?/gi, " ")
    .replace(/\bfor\s+\d+(?:\.\d+)?\s*(h(?:ou)?rs?|mins?|m)\b/gi, " ")
    .replace(/\b(shared|together|with\s+(the\s+)?(crew|pod|team|friends?|everyone))\b/gi, " ")
    .replace(/\b(i\s+want\s+to|i'd\s+like\s+to|i\s+need\s+to|lets?|let's|gonna|going\s+to|please|can\s+you|mylo|milo)\b/gi, " ")
    .replace(/[^a-zA-Z0-9 &'+/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) t = "Goal";
  return t.slice(0, 80).replace(/^\w/, (c) => c.toUpperCase());
}

function splitChunks(text: string): string[] {
  return text
    .split(/\n+|,\s*(?=[a-zA-Z])|\band\s+then\b|\bthen\b|\balso\b|;/i)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

function parseLocal(
  text: string,
  todayIso: string,
  existingCats: string[] = [],
): { reply: string; goals: GoalDraft[]; engine: string } {
  const chunks = splitChunks(text);
  const goals: GoalDraft[] = [];

  for (const chunk of chunks) {
    const lower = chunk.toLowerCase();
    let due = todayIso;
    let scope: GoalDraft["scope"] = "day";
    if (/\btomorrow\b/.test(lower)) due = addDaysIso(todayIso, 1);
    else if (/\btonight\b/.test(lower)) due = todayIso;
    else if (/\bthis\s+week\b/.test(lower)) scope = "week";
    else if (/\bthis\s+month\b/.test(lower)) scope = "month";
    else if (/\bthis\s+year\b/.test(lower)) {
      scope = "year";
      due = null as unknown as string;
    }

    let startMins: number | null = null;
    const timeMatch = lower.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (timeMatch) startMins = parseClock(timeMatch[1]);
    if (startMins == null) {
      if (/\bmorning\b/.test(lower)) startMins = daypartDefault("morning");
      else if (/\bafternoon\b/.test(lower)) startMins = daypartDefault("afternoon");
      else if (/\b(night|evening|tonight)\b/.test(lower)) startMins = daypartDefault("night");
    }
    if (startMins == null && scope === "day") startMins = daypartDefault("morning");

    let duration = parseDuration(lower) || (scope === "year" ? null : 30);
    const is_shared = /\b(shared|together|with\s+(the\s+)?(crew|pod|team|friends?|everyone)|as\s+a\s+group)\b/i.test(lower);
    const title = cleanTitle(chunk);
    if (title.length < 2) continue;
    const category_name = inferCategory(title, chunk, existingCats);

    goals.push({
      title,
      scope,
      due_date: scope === "year" ? null : due,
      start_time: scope === "year" || startMins == null ? null : minsToTime(startMins),
      duration_min: duration,
      is_shared,
      category_name,
    });
  }

  if (!goals.length) {
    return {
      engine: "local",
      reply: "Tell me what you want to lock in — e.g. “Gym today at 7 for 1 hour, study tomorrow afternoon.”",
      goals: [],
    };
  }

  const summary = goals
    .map((g) => {
      const when = g.due_date || "someday";
      const time = g.start_time ? ` ${g.start_time}` : "";
      const dur = g.duration_min ? ` · ${g.duration_min}m` : "";
      const cat = g.category_name ? ` · ${g.category_name}` : "";
      return `• ${g.title} (${when}${time}${dur}${cat}${g.is_shared ? " · shared" : ""})`;
    })
    .join("\n");

  return {
    engine: "local",
    reply: `I drafted ${goals.length} goal${goals.length === 1 ? "" : "s"} for your pod:\n${summary}\n\nAdd them?`,
    goals,
  };
}

async function parseWithGemini(
  text: string,
  todayIso: string,
  apiKey: string,
  existingCats: string[],
): Promise<{ reply: string; goals: GoalDraft[]; engine: string } | null> {
  const catList = existingCats.length
    ? existingCats.slice(0, 40).join(", ")
    : "Fitness, Study, Prayer, Health, Food, Work, Creative, Chores, Social, Finance";
  const prompt = `You are Mylo, a calm friend inside a goals app — not a child, not a coach, not corporate.
Voice: warm, short, sure. Like someone already in the room. Lowercase is fine. No hype. Never say "lock in" or "solid". Quiet smile energy.
Today's date is ${todayIso} (YYYY-MM-DD).
Existing categories in this room: ${catList}
User message:
"""${text.slice(0, 1200)}"""

Extract 0-8 concrete goals. Return ONLY valid JSON (no markdown):
{
  "reply": "short calm confirmation asking to add",
  "goals": [
    {
      "title": "short title",
      "scope": "day"|"week"|"month"|"year",
      "due_date": "YYYY-MM-DD"|null,
      "start_time": "HH:MM"|null,
      "duration_min": number|null,
      "is_shared": boolean,
      "category_name": "short category"|null
    }
  ]
}
Rules:
- Prefer scope day when they say today/tomorrow/tonight.
- If morning/afternoon/night with no clock: start_time 08:00 / 13:00 / 19:00.
- Default duration_min 30 when missing (unless year).
- is_shared true only if they clearly mean the whole crew.
- Titles max 80 chars, action-oriented.
- category_name: reuse an existing category name when it fits; otherwise invent a short one (Fitness, Study, etc). null only if truly unclear.
- reply stays short and calm — no cheerleading.`;

  const models = [
    "gemini-flash-latest",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
    "gemini-2.0-flash-lite",
  ];
  let raw = "";
  for (const model of models) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, responseMimeType: "application/json" },
      }),
    });
    if (!res.ok) continue;
    const data = await res.json();
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (raw) break;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const goals = (Array.isArray(parsed.goals) ? parsed.goals : [])
      .slice(0, 8)
      .map((g: Record<string, unknown>) => {
        const title = String(g.title || "Goal").slice(0, 80);
        const category_name = g.category_name
          ? String(g.category_name).slice(0, 24)
          : inferCategory(title, text, existingCats);
        return {
          title,
          scope: (["day", "week", "month", "year"].includes(String(g.scope))
            ? g.scope
            : "day") as GoalDraft["scope"],
          due_date: g.due_date ? String(g.due_date).slice(0, 10) : todayIso,
          start_time: g.start_time ? String(g.start_time).slice(0, 5) : "08:00",
          duration_min: Number(g.duration_min) > 0 ? Number(g.duration_min) : 30,
          is_shared: !!g.is_shared,
          category_name,
        };
      });
    goals.forEach((g: GoalDraft) => {
      if (g.scope === "year") {
        g.due_date = null;
        g.start_time = null;
        g.duration_min = null;
      }
    });
    return {
      engine: "gemini",
      reply: String(parsed.reply || "Add these goals?"),
      goals,
    };
  } catch {
    return null;
  }
}

async function loadGeminiKey(): Promise<string> {
  const fromEnv = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GOOGLE_API_KEY") || "";
  if (fromEnv) return fromEnv;
  const url = Deno.env.get("SUPABASE_URL") || "";
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !service) return "";
  try {
    const res = await fetch(
      `${url}/rest/v1/app_secrets?key=eq.GEMINI_API_KEY&select=value&limit=1`,
      {
        headers: {
          apikey: service,
          Authorization: `Bearer ${service}`,
        },
      },
    );
    if (!res.ok) return "";
    const rows = await res.json();
    return String(rows?.[0]?.value || "");
  } catch {
    return "";
  }
}

async function chatWithGemini(
  text: string,
  todayIso: string,
  apiKey: string,
  context: Record<string, unknown>,
  history: { role: string; text: string }[],
  existingCats: string[],
): Promise<{ reply: string; goals: GoalDraft[]; chips: { label: string; send: string }[]; engine: string } | null> {
  const ctx = JSON.stringify(context || {}).slice(0, 3500);
  const hist = (history || [])
    .slice(-10)
    .map((h) => `${h.role === "user" ? "User" : "Mylo"}: ${String(h.text || "").slice(0, 240)}`)
    .join("\n");
  const prompt = `You are Mylo, a calm friend inside a goals app — not a child, not a coach, not corporate.
Voice: warm, short, sure. Like someone already in the room. Lowercase is fine. No hype. Never say "lock in" or "solid". Quiet smile energy.
Today is ${todayIso}.
User context JSON:
${ctx}

Recent chat:
${hist || "(none)"}

Latest user message:
"""${text.slice(0, 800)}"""

Reply as Mylo. You know their name, room, Today goals, routines, and Google Calendar status from context.
Return ONLY valid JSON:
{
  "reply": "short calm message, use newlines sparingly",
  "chips": [{"label":"short","send":"what user would type"}],
  "goals": [],
  "calendar_actions": [],
  "notion_actions": []
}
Rules:
- Default to conversation. Do NOT invent goals for random chat, confusion, questions, or greetings.
- When the user wants to add a goal or routine but details are missing (time, duration, steps), ASK one short clarifying question in reply. Leave goals as [].
- Never invent a duration or start time the user did not say. Never assume they want it added yet — the app will show a review card and wait for confirm.
- Only fill goals when the user already gave a complete ask (title + time + duration) AND is clearly ready — still keep reply as a short confirmation, not "added".
- goals schema when needed: title, scope, due_date, start_time, duration_min, is_shared, category_name — otherwise goals must be [].
- If context.google_calendar.connected is true AND the user asks to add/edit/delete/list Google Calendar events, fill calendar_actions (do not invent goals for that).
- calendar_actions ops:
  - {"op":"create","title":"...","date":"YYYY-MM-DD","start_time":"HH:MM","duration_min":60}
  - {"op":"update","query":"event title fragment","title":"...","date":"YYYY-MM-DD","start_time":"HH:MM","duration_min":60}
  - {"op":"delete","query":"event title fragment"}
  - {"op":"list","days":14}
- If Google Calendar is not connected and they ask for calendar changes, tell them to connect it in You → Integrations (leave calendar_actions empty).
- If context.notion.connected is true AND the user asks to use/edit Notion, fill notion_actions (do not invent goals for that).
- notion_actions ops:
  - {"op":"list"}
  - {"op":"search","query":"page title fragment"}
  - {"op":"read","query":"page title fragment"}
  - {"op":"create","title":"...","content":"..."}
  - {"op":"append","query":"page title","content":"text to add"}
  - {"op":"append_todo","query":"page title","title":"todo text"}
  - {"op":"rename","query":"old title fragment","title":"new title"}
  - {"op":"push_today"}
- If Notion is not connected and they ask for Notion changes, tell them to Connect Notion under You → Integrations (leave notion_actions empty).
- Always include 2-4 chips for next actions (What's left today?, Add a goal, What's on my Google Calendar?, List my Notion pages, Push today to Notion, Help, etc).
- Prefer existing category names: ${existingCats.slice(0, 20).join(", ") || "Fitness, Study, Work"}.
- Keep reply under 420 characters. Stay calm and direct — no cheerleading, no coach voice.`;

  const models = ["gemini-flash-latest", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-lite-latest"];
  let raw = "";
  for (const model of models) {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
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
    raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    if (raw) break;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    const goals = (Array.isArray(parsed.goals) ? parsed.goals : [])
      .slice(0, 8)
      .map((g: Record<string, unknown>) => {
        const title = String(g.title || "Goal").slice(0, 80);
        return {
          title,
          scope: (["day", "week", "month", "year"].includes(String(g.scope))
            ? g.scope
            : "day") as GoalDraft["scope"],
          due_date: g.due_date ? String(g.due_date).slice(0, 10) : todayIso,
          start_time: g.start_time ? String(g.start_time).slice(0, 5) : "08:00",
          duration_min: Number(g.duration_min) > 0 ? Number(g.duration_min) : 30,
          is_shared: !!g.is_shared,
          category_name: g.category_name
            ? String(g.category_name).slice(0, 24)
            : inferCategory(title, text, existingCats),
        };
      });
    const chips = (Array.isArray(parsed.chips) ? parsed.chips : [])
      .slice(0, 5)
      .map((c: Record<string, unknown>) => ({
        label: String(c.label || "OK").slice(0, 24),
        send: String(c.send || c.label || "").slice(0, 120),
      }))
      .filter((c: { label: string; send: string }) => c.send);
    const calendar_actions = (Array.isArray(parsed.calendar_actions) ? parsed.calendar_actions : [])
      .slice(0, 5)
      .map((a: Record<string, unknown>) => ({
        op: String(a.op || "").toLowerCase(),
        title: a.title ? String(a.title).slice(0, 200) : undefined,
        date: a.date ? String(a.date).slice(0, 10) : undefined,
        start_time: a.start_time ? String(a.start_time).slice(0, 5) : undefined,
        duration_min: Number(a.duration_min) > 0 ? Number(a.duration_min) : undefined,
        query: a.query ? String(a.query).slice(0, 120) : undefined,
        event_id: a.event_id ? String(a.event_id).slice(0, 200) : undefined,
        days: Number(a.days) > 0 ? Number(a.days) : undefined,
        description: a.description ? String(a.description).slice(0, 500) : undefined,
      }))
      .filter((a: { op: string }) => ["create", "update", "delete", "list"].includes(a.op));
    const notion_actions = (Array.isArray(parsed.notion_actions) ? parsed.notion_actions : [])
      .slice(0, 5)
      .map((a: Record<string, unknown>) => ({
        op: String(a.op || "").toLowerCase(),
        title: a.title ? String(a.title).slice(0, 200) : undefined,
        content: a.content ? String(a.content).slice(0, 4000) : (a.text ? String(a.text).slice(0, 4000) : undefined),
        query: a.query ? String(a.query).slice(0, 120) : undefined,
        page_id: a.page_id ? String(a.page_id).slice(0, 80) : undefined,
        page_title: a.page_title ? String(a.page_title).slice(0, 120) : undefined,
        as_todo: !!a.as_todo,
        limit: Number(a.limit) > 0 ? Number(a.limit) : undefined,
      }))
      .filter((a: { op: string }) =>
        ["list", "search", "read", "create", "append", "append_todo", "rename", "push_today"].includes(a.op)
      );
    return {
      engine: "gemini",
      reply: String(parsed.reply || "I’m here.").slice(0, 800),
      goals,
      chips,
      calendar_actions,
      notion_actions,
    };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const auth = req.headers.get("Authorization") || "";
    if (!auth.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const mode = String(body.mode || "goals");
    const text = String(body.text || "").trim();
    const todayIso = String(body.today || "").slice(0, 10) || isoFromDate(new Date());
    const existingCats = Array.isArray(body.categories)
      ? body.categories.map((c: unknown) => String(c || "").trim()).filter(Boolean).slice(0, 40)
      : [];
    if (!text) {
      return new Response(JSON.stringify({ error: "Say something." }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const key = await loadGeminiKey();

    if (mode === "chat") {
      const context = (body.context && typeof body.context === "object") ? body.context as Record<string, unknown> : {};
      const history = Array.isArray(body.history) ? body.history : [];
      let result = key
        ? await chatWithGemini(text, todayIso, key, context, history, existingCats)
        : null;
      if (!result) {
        result = {
          engine: "local",
          reply: "I’m with you — try “What’s left today?”, “How’s today?”, or lock in a goal like “Gym at 7 for 1 hour”.",
          goals: [],
          chips: [
            { label: "What’s left", send: "What's left today?" },
            { label: "Progress", send: "How's today?" },
            { label: "Add a goal", send: "I want to add a goal" },
            { label: "Help", send: "Help" },
          ],
        };
      }
      return new Response(JSON.stringify(result), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let result = key ? await parseWithGemini(text, todayIso, key, existingCats) : null;
    if (!result) result = parseLocal(text, todayIso, existingCats);

    return new Response(JSON.stringify(result), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
