'use client';

import { useSyncExternalStore } from 'react';
import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { addDays, fromIso, iso, thisWeek, todayIso } from './dates';
import type { Tone } from './parse';
import type { Item, Kind } from './store';

/* Mylo AI, the real one: the `mylo` edge function in supabase/functions/mylo.
   It takes { mode: 'goals' | 'chat', text, today, categories, context,
   history } and answers { reply, goals: GoalDraft[], chips?, engine }. It
   only asks for a Bearer token, so it runs with the signed-in person's
   session when there is one and the project's publishable key when there is
   not; a 401 still sends the person to /signin. Nothing it drafts is saved
   until the person taps Add (handoff rule). */

/* ── Categories: AI7's colour set ─────────────────────────────────────── */
export const CATS = ['Fitness', 'Growth', 'Work', 'Health', 'Social'] as const;
export type Cat = (typeof CATS)[number];
export const CAT_LOOK: Record<Cat, { icon: string; tint: string; tone: Tone }> = {
  Fitness: { icon: 'workout', tint: 'var(--tint-green)', tone: 'green' },
  Growth: { icon: 'book', tint: 'var(--tint-amber)', tone: 'amber' },
  Work: { icon: 'briefcase', tint: 'var(--tint-red)', tone: 'red' },
  Health: { icon: 'heart', tint: 'var(--tint-green)', tone: 'green' },
  Social: { icon: 'user', tint: 'var(--tint-amber)', tone: 'amber' }
};
/* The server may name its own category; fold it into the five colours. */
const CAT_WORDS: [RegExp, Cat][] = [
  [/^(fitness|sport|exercise|gym|run|workout)/i, 'Fitness'],
  [/^(growth|study|learn|read|creative|prayer|faith|mind|school|skill)/i, 'Growth'],
  [/^(work|career|business|finance|money|chores|admin|errand)/i, 'Work'],
  [/^(health|food|sleep|wellness|self)/i, 'Health'],
  [/^(social|family|friends|people|life|love)/i, 'Social']
];
export function toCat(name?: string | null): Cat | null {
  if (!name) return null;
  const hit = CAT_WORDS.find(([re]) => re.test(name.trim()));
  return hit ? hit[1] : null;
}
/* An item already on Today carries a tag; read its colour back. */
export const catOfTag = (tag?: Item['tag']) => toCat(tag?.label) ?? (tag?.label === 'Mind' ? 'Growth' : tag?.label === 'Family' ? 'Social' : null);

/* ── Drafts ─────────────────────────────────────────────────────────────── */
export type GoalDraft = {
  title: string; scope: 'day' | 'week' | 'month' | 'year'; due_date: string | null;
  start_time: string | null; duration_min: number | null; is_shared: boolean; category_name: string | null;
};
export type Draft = {
  id: string; title: string; scope: GoalDraft['scope']; date: string; time?: string; minutes?: number;
  shared: boolean; cat: Cat | null; repeat: number[]; remind: boolean; on: boolean;
};
export const fromGoal = (g: GoalDraft): Draft => ({
  id: crypto.randomUUID(),
  title: String(g.title || '').slice(0, 80) || 'Goal',
  scope: g.scope ?? 'day',
  date: g.due_date || todayIso(),
  time: g.start_time || undefined,
  minutes: g.duration_min || undefined,
  shared: !!g.is_shared,
  cat: toCat(g.category_name),
  repeat: [],
  remind: false,
  on: true
});

/* A day thing is a task on Today; a thing on repeat is a system; anything
   wider than a day is a goal. Repeat days and the reminder ride along on the
   item (lib/store.tsx keeps whatever it is given) until Item names them. */
export function toItem(d: Draft): Omit<Item, 'id' | 'done'> {
  const kind: Kind = d.repeat.length ? 'system' : d.scope === 'day' ? 'task' : 'goal';
  const item = {
    kind, title: d.title.trim() || 'Goal', date: d.date, time: d.time, minutes: d.minutes,
    tag: d.cat ? { label: d.cat, tone: CAT_LOOK[d.cat].tone } : undefined,
    repeat: d.repeat.length ? d.repeat : undefined,
    remind: d.remind && d.time ? 15 : undefined
  };
  return item;
}

const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
/* AI1's second line: "Every night at 22:00 · Growth", "Mon, Wed, Fri at 19:00 · Fitness". */
export function whenLine(d: Draft) {
  let when: string;
  if (d.repeat.length === 7) when = d.time && d.time >= '20:00' ? 'Every night' : 'Every day';
  else if (d.repeat.length) when = [...d.repeat].sort().map(i => DAY_SHORT[i]).join(', ');
  else if (d.scope !== 'day') when = d.scope === 'week' ? 'This week' : d.scope === 'month' ? 'This month' : 'This year';
  else if (d.date === todayIso()) when = 'Today';
  else if (d.date === iso(addDays(new Date(), 1))) when = 'Tomorrow';
  else when = fromIso(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return [d.time ? `${when} at ${d.time}` : when, d.cat].filter(Boolean).join(' · ');
}
/* AI5's second line: "Fitness · Shared", "Health · 15 min". */
export const planLine = (d: Draft) => [d.cat, d.shared ? 'Shared' : d.minutes ? `${d.minutes} min` : null].filter(Boolean).join(' · ');

/* ── Chats, kept on the device ─────────────────────────────────────────── */
export type Chip = { label: string; send: string };
export type Msg =
  | { id: string; role: 'me'; text: string; at: string; voice?: { secs: number; bars: number[] }; status: 'sending' | 'sent' | 'failed'; why?: Fail }
  | { id: string; role: 'mylo'; text: string; at: string; drafts?: Draft[]; chips?: Chip[]; added?: boolean; signin?: boolean };
export type Chat = { id: string; title: string; at: string; msgs: Msg[] };
export const CHATS_KEY = 'mylo.ai.chats.v1';

/* "Now", "14:05", "Mon", "Last week", as DT6's Recent list reads. */
export function ago(at: string, now: number) {
  const t = new Date(at).getTime();
  const mins = (now - t) / 60000;
  if (mins < 5) return 'Now';
  const d = new Date(t);
  if (iso(d) === iso(new Date(now))) return d.toTimeString().slice(0, 5);
  const days = (fromIso(iso(new Date(now))).getTime() - fromIso(iso(d)).getTime()) / 86400000;
  if (days < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  if (days < 14) return 'Last week';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/* ── 10 free messages a day ────────────────────────────────────────────── */
export const DAILY = 10;
export const USAGE_KEY = 'mylo.ai.usage.v1';
export type Usage = { day: string; n: number };
export const usedToday = (u: Usage, today: string) => (u.day === today ? u.n : 0);

/* ── A clock for countdowns and "Now", without reading time in render ─── */
let tick = 0;
const clockSubs = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
function subClock(cb: () => void) {
  clockSubs.add(cb);
  if (!timer) { tick = Date.now(); timer = setInterval(() => { tick = Date.now(); clockSubs.forEach(f => f()); }, 20000); }
  return () => { clockSubs.delete(cb); if (!clockSubs.size && timer) { clearInterval(timer); timer = null; } };
}
export const useNow = () => useSyncExternalStore(subClock, () => tick || (tick = Date.now()), () => 0);

/* "Resets in 2h 41m": to the person's next midnight. */
export function untilMidnight(now: number) {
  const next = new Date(now); next.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.ceil((next.getTime() - now) / 60000));
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/* ── Asking Mylo ───────────────────────────────────────────────────────── */
export type Fail = 'offline' | 'signin' | 'failed';
export class AiError extends Error { constructor(public why: Fail) { super(why); } }
export type Reply = { reply: string; goals: GoalDraft[]; chips: Chip[]; engine: string };

/* Plans come from "goals" mode, which drafts; questions and talk go to
   "chat" mode, which answers and suggests next steps. */
const TIMEY = /\b(at \d|\d{1,2}(:\d{2})?\s?(am|pm)|\d{1,2}:\d{2}|\d+\s?(min|mins|minutes|h|hr|hrs|hours?)|an hour|half an hour|morning|afternoon|evening|tonight|night|before bed|after work|every (day|night|morning|week)|daily)\b/i;
const ASKY = /^(what|why|how|when|who|where|which|is|are|am|do|does|did|should|could|would|can you tell|tell me|help)\b/i;
const DOEY = /\b(add|remind|schedule|book|block|draft|plan|set up|put)\b/i;
export function pickMode(text: string): 'goals' | 'chat' {
  const t = text.trim();
  if (ASKY.test(t) && !TIMEY.test(t)) return 'chat';
  if (TIMEY.test(t)) return 'goals';
  if (DOEY.test(t) && /,|\band\b|\bthen\b/i.test(t)) return 'goals';
  return 'chat';
}

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new AiError('failed')), ms))]);

export async function askMylo(body: {
  mode: 'goals' | 'chat'; text: string; context?: Record<string, unknown>; history?: { role: string; text: string }[];
}): Promise<Reply> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new AiError('offline');
  const sb = supabase();
  // supabase-js sends the session's access token when someone is signed in,
  // and the publishable key otherwise. Reading the session first refreshes
  // an expired token before the call.
  await sb.auth.getSession().catch(() => null);
  let res: Awaited<ReturnType<typeof sb.functions.invoke>>;
  try {
    res = await withTimeout(sb.functions.invoke('mylo', {
      body: { ...body, today: todayIso(), categories: [...CATS], history: body.history ?? [], context: body.context ?? {} }
    }), 45000);
  } catch (e) {
    if (e instanceof AiError) throw e;
    throw new AiError(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed');
  }
  const { data, error } = res;
  if (error) {
    if (error instanceof FunctionsHttpError && (error.context as Response | undefined)?.status === 401) throw new AiError('signin');
    if (error instanceof FunctionsFetchError) throw new AiError(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'failed');
    if (error instanceof FunctionsRelayError) throw new AiError('failed');
    throw new AiError('failed');
  }
  const d = (typeof data === 'string' ? safeJson(data) : data) as Partial<Reply> & { error?: string } | null;
  if (!d || d.error || typeof d.reply !== 'string') throw new AiError('failed');
  return {
    reply: d.reply.trim(),
    goals: Array.isArray(d.goals) ? d.goals : [],
    chips: Array.isArray(d.chips) ? d.chips.filter(c => c && c.label && c.send).slice(0, 4) : [],
    engine: String(d.engine || '')
  };
}
function safeJson(s: string) { try { return JSON.parse(s); } catch { return null; } }

/* ── The week, read from the person's own Today ────────────────────────── */
export type Slip = { key: string; title: string; missed: number; days: string[]; cat: Cat | null; last: Item };
export function readWeek(items: Item[], now: Date) {
  const days = thisWeek(now).map(iso);
  const today = iso(now);
  const inWeek = items.filter(i => (i.kind === 'task' || i.kind === 'todo') && days.includes(i.date));
  const done = inWeek.filter(i => i.done);
  const missed = inWeek.filter(i => !i.done && i.date < today);
  const onTime = done.filter(i => i.doneAt && iso(new Date(i.doneAt)) <= i.date).length;
  const groups = new Map<string, Slip>();
  for (const m of missed.sort((a, b) => a.date.localeCompare(b.date))) {
    const key = m.title.trim().toLowerCase();
    const g = groups.get(key) ?? { key, title: m.title.trim(), missed: 0, days: [], cat: catOfTag(m.tag), last: m };
    g.missed++; g.last = m;
    const day = DAY_SHORT[(fromIso(m.date).getDay() + 6) % 7];
    if (!g.days.includes(day)) g.days.push(day);
    groups.set(key, g);
  }
  const slips = [...groups.values()].sort((a, b) => b.missed - a.missed);
  return { start: days[0], end: days[6], done: done.length, missed: missed.length, onTime: done.length ? Math.round((onTime / done.length) * 100) : null, slips };
}
/* "Oct 17 to 23", or "Oct 30 to Nov 5" across a month. */
export function weekRange(start: string, end: string) {
  const a = fromIso(start), b = fromIso(end);
  const m = (d: Date) => d.toLocaleDateString('en-US', { month: 'short' });
  return a.getMonth() === b.getMonth() ? `${m(a)} ${a.getDate()} to ${b.getDate()}` : `${m(a)} ${a.getDate()} to ${m(b)} ${b.getDate()}`;
}

/* What the person said got in the way (AI9), and Mylo's fix (AI10). */
export const REASONS = [
  { label: 'Too early', icon: 'sunrise' },
  { label: 'Too tired', icon: 'moon' },
  { label: 'Too long', icon: 'timer' },
  { label: 'I forgot', icon: 'bell-s' },
  { label: 'Not a priority now', icon: 'flag' },
  { label: 'Something else', icon: 'pencil' }
] as const;
export type SlipNote = { reason?: string; fix?: Draft; note?: string; applied?: boolean };
export const SLIPS_KEY = 'mylo.ai.slips.v1';
export const slipId = (weekStart: string, key: string) => `${weekStart}:${key}`;
