'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { streak, useStore, type Item } from './store';
import type { Tone } from './parse';
import { addDays, fromIso, iso, todayIso } from './dates';

/* The goals area's own saved state, next to lib/store.tsx. The store keeps
   what a person has (a goal, a system, a task); this keeps what the goals
   screens add on top: repeat rules, steps, check-ins, notes, the journal and
   which daily moments have been seen. Keyed by the store item's id. Every
   account starts with nothing here.

   Shared between every component on the page (one copy in memory, written
   through to localStorage), so a sheet and the screen under it never
   disagree. */
function shared<T>(key: string, initial: T) {
  let value: T = initial;
  let loaded = false;
  const subs = new Set<() => void>();
  const load = () => {
    if (loaded || typeof window === 'undefined') return;
    loaded = true;
    try { const raw = localStorage.getItem(key); if (raw) value = JSON.parse(raw) as T; } catch { /* blocked */ }
  };
  const subscribe = (fn: () => void) => {
    subs.add(fn);
    const onStorage = (e: StorageEvent) => { if (e.key === key) { loaded = false; load(); subs.forEach(s => s()); } };
    window.addEventListener('storage', onStorage);
    return () => { subs.delete(fn); window.removeEventListener('storage', onStorage); };
  };
  const get = () => { load(); return value; };
  const set = (next: T | ((prev: T) => T)) => {
    load();
    value = typeof next === 'function' ? (next as (p: T) => T)(value) : next;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
    subs.forEach(s => s());
  };
  return function useShared() {
    const v = useSyncExternalStore(subscribe, get, () => initial);
    return [v, set] as const;
  };
}

/* ── Goal details ───────────────────────────────────────────────────────── */
export type Repeat = 'once' | 'daily' | 'days';
export type Step = { id: string; title: string; done: boolean };
export type Tag = { label: string; tone: Tone };
export type Meta = {
  title?: string; tag?: Tag; time?: string; minutes?: number; date?: string;
  repeat?: Repeat; days?: number[];            // 0 = Monday … 6 = Sunday
  room?: boolean; parent?: string; remind?: boolean;
  steps?: Step[]; log?: string[];               // days it was done, YYYY-MM-DD
  note?: string; hidden?: boolean;
  smaller?: { title: string; time?: string; minutes?: number; until: string };
};
const EMPTY_META: Record<string, Meta> = {};
const useMetaStore = shared<Record<string, Meta>>('mylo.goals.meta.v1', EMPTY_META);

export function useMeta() {
  const [all, setAll] = useMetaStore();
  const patch = useCallback((id: string, p: Meta | ((m: Meta) => Meta)) =>
    setAll(a => ({ ...a, [id]: { ...a[id], ...(typeof p === 'function' ? p(a[id] ?? {}) : p) } })), [setAll]);
  return { all, patch };
}

export type Goal = Omit<Item, 'tag'> & Meta & { tag?: Tag; repeat: Repeat; days: number[]; steps: Step[]; log: string[] };
export function merge(item: Item, m: Meta = {}): Goal {
  const smaller = m.smaller && m.smaller.until >= todayIso() ? m.smaller : undefined;
  return {
    ...item, ...m,
    title: smaller?.title ?? m.title ?? item.title,
    time: smaller?.time ?? m.time ?? item.time,
    minutes: smaller?.minutes ?? m.minutes ?? item.minutes,
    tag: m.tag ?? item.tag,
    date: m.date ?? item.date,
    repeat: m.repeat ?? (item.kind === 'system' ? 'daily' : 'once'),
    days: m.days ?? [], steps: m.steps ?? [], log: m.log ?? []
  };
}

/* Goals and systems a person has, merged with their details, minus hidden. */
export function goalsOf(items: Item[], all: Record<string, Meta>) {
  return items.filter(i => (i.kind === 'goal' || i.kind === 'system') && !all[i.id]?.hidden).map(i => merge(i, all[i.id]));
}

/* ── What is on a day ───────────────────────────────────────────────────────
   The one answer every screen gives: Today (C2, DT2), the tick toast, the
   moments (C1, C6, C10), the calendar (E3) and plan another day (N7). The
   store's tasks, to-dos and one-off goals dated that day, plus every system
   planned for it from the day it started. */
export type DayThing = { id: string; kind: Item['kind']; title: string; time?: string; minutes?: number; with?: string; tag?: Item['tag']; done: boolean; repeat: boolean; room?: boolean };

export function dayThings(items: Item[], all: Record<string, Meta>, day: string): DayThing[] {
  const out: DayThing[] = [];
  for (const i of items) {
    const m = all[i.id];
    if (m?.hidden) continue;
    const g = merge(i, m);
    if (g.repeat === 'once') {
      if (g.date === day) out.push({ id: g.id, kind: g.kind, title: g.title, time: g.time, minutes: g.minutes, with: g.with, tag: g.tag, done: g.done, repeat: false, room: g.room });
    } else if (!g.done && g.date <= day && isPlanned(g, fromIso(day))) {
      out.push({ id: g.id, kind: g.kind, title: g.title, time: g.time, minutes: g.minutes, with: g.with, tag: g.tag, done: g.log.includes(day), repeat: true, room: g.room });
    }
  }
  return out.sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
}

/* Days a system was checked in on: they count toward the streak like ticks. */
export function checkinDays(all: Record<string, Meta>) {
  const days: string[] = [];
  for (const id in all) if (!all[id].hidden) days.push(...(all[id].log ?? []));
  return days;
}

/* The streak every screen shows: ticked days plus system check-ins. */
export function useStreak() {
  const { items } = useStore();
  const { all } = useMeta();
  return streak(items, checkinDays(all));
}

/* ── Weeks, repeats and progress ────────────────────────────────────────── */
export const weekday = (d: Date) => (d.getDay() + 6) % 7;
export function weekOf(d = new Date()) {
  const monday = addDays(d, -weekday(d));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}
export const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DAY_LONG = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'];

export const plannedDays = (g: Goal) => g.repeat === 'daily' ? [0, 1, 2, 3, 4, 5, 6] : g.repeat === 'days' ? [...g.days].sort() : [];
export const isPlanned = (g: Goal, d: Date) => g.repeat === 'once' ? iso(d) === g.date : plannedDays(g).includes(weekday(d));
export const doneOn = (g: Goal, day: string) => g.repeat === 'once' ? g.done && (!g.doneAt || iso(new Date(g.doneAt)) === day) : g.log.includes(day);

/* "Mon, Wed, Fri 07:00", "Every day 06:30", "Once": how DT4 writes a rhythm. */
export function rhythm(g: Goal) {
  const when = g.repeat === 'daily' ? 'Every day' : g.repeat === 'days' ? plannedDays(g).map(d => DAY_SHORT[d]).join(', ') : null;
  return [when, g.time].filter(Boolean).join(' ');
}

export function progress(g: Goal, now = new Date()) {
  if (g.repeat !== 'once') {
    const week = weekOf(now).map(iso);
    const total = plannedDays(g).length || 7;
    const done = Math.min(total, g.log.filter(d => week.includes(d)).length);
    return { done, total, pct: Math.round((done / total) * 100) };
  }
  if (g.steps.length) {
    const done = g.steps.filter(s => s.done).length;
    return { done, total: g.steps.length, pct: Math.round((done / g.steps.length) * 100) };
  }
  return { done: g.done ? 1 : 0, total: 1, pct: g.done ? 100 : 0 };
}

/* E1's right-hand line: "Ahead of plan", "On track", "Due Nov 15" or a count. */
export function status(g: Goal, now = new Date()) {
  const p = progress(g, now);
  if (g.done) return 'Done';
  if (g.repeat !== 'once') {
    const soFar = weekOf(now).filter(d => d <= now && isPlanned(g, d)).length;
    if (p.done > soFar) return 'Ahead of plan';
    if (p.done === soFar) return 'On track';
    return `${p.done} of ${p.total}`;
  }
  if (g.date > todayIso()) return `Due ${fromIso(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  return `${p.done} of ${p.total}`;
}

/* The next time it is on: "Sat 07:00", or the first open step. */
export function nextUp(g: Goal, now = new Date()) {
  const open = g.steps.find(s => !s.done);
  if (open) return [open.title, g.time].filter(Boolean).join(', ');
  if (g.repeat === 'once') return g.done ? null : [g.date === todayIso() ? 'Today' : DAY_SHORT[weekday(fromIso(g.date))], g.time].filter(Boolean).join(' ');
  for (let i = 0; i < 8; i++) {
    const d = addDays(now, i);
    if (isPlanned(g, d) && !g.log.includes(iso(d))) return [i === 0 ? 'Today' : DAY_SHORT[weekday(d)], g.time].filter(Boolean).join(' ');
  }
  return null;
}

/* Weeks in a row with at least one check-in, and the last few weeks' counts. */
export function weeksInRow(g: Goal, now = new Date()) {
  let n = 0; let d = now;
  const has = (w: Date[]) => w.some(x => g.log.includes(iso(x)) || (g.done && g.doneAt && iso(new Date(g.doneAt)) === iso(x)));
  if (!has(weekOf(d))) d = addDays(d, -7);
  while (has(weekOf(d)) && n < 520) { n++; d = addDays(d, -7); }
  return n;
}
export function lastWeeks(g: Goal, count = 5, now = new Date()) {
  return Array.from({ length: count }, (_, i) => {
    const w = weekOf(addDays(now, -7 * (count - 1 - i))).map(iso);
    return g.log.filter(d => w.includes(d)).length;
  });
}

export const TONE = {
  green: { tint: 'var(--tint-green)', ink: 'var(--green)' },
  amber: { tint: 'var(--tint-amber)', ink: 'var(--amber)' },
  blue: { tint: 'var(--tint-blue)', ink: 'var(--blue)' },
  red: { tint: 'var(--tint-red)', ink: 'var(--red)' }
} as const;
export const TYPES: Tag[] = [
  { label: 'Health', tone: 'green' }, { label: 'Mind', tone: 'amber' },
  { label: 'Work', tone: 'blue' }, { label: 'Money', tone: 'red' }
];
export const BOARD: Record<Tone, string> = {
  green: '/figma/goals/board-gym.svg', amber: '/figma/goals/board-reading.svg',
  blue: '/figma/goals/board-shipping.svg', red: '/figma/goals/board-shipping.svg'
};

export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));

/* ── Journal ────────────────────────────────────────────────────────────── */
export type Mood = 'rough' | 'tired' | 'okay' | 'good' | 'great';
export const MOODS: { id: Mood; label: string }[] = [
  { id: 'rough', label: 'Rough' }, { id: 'tired', label: 'Tired' }, { id: 'okay', label: 'Okay' },
  { id: 'good', label: 'Good' }, { id: 'great', label: 'Great' }
];
export const JOURNAL_TAGS = ['Gym', 'Friends', 'Work', 'Sleep', 'Food', 'Weather', 'Family'];
export type Entry = { mood?: Mood; tags: string[]; line: string; photo?: string; at: string };
const EMPTY_JOURNAL: Record<string, Entry> = {};
export const useJournal = shared<Record<string, Entry>>('mylo.goals.journal.v1', EMPTY_JOURNAL);

/* Nights in a row with an entry, up to today or yesterday. */
export function nightsInRow(j: Record<string, Entry>, now = new Date()) {
  let d = now; if (!j[iso(d)]) d = addDays(d, -1);
  let n = 0; while (j[iso(d)]) { n++; d = addDays(d, -1); }
  return n;
}

export type Lock = { on: boolean; pin?: string; cred?: string };
export const useLock = shared<Lock>('mylo.goals.lock.v1', { on: false });

/* ── Daily moments ──────────────────────────────────────────────────────── */
export type Moments = { lastOpen?: string; morning?: string; evening?: string; perfect?: string; back?: string };
export const useMoments = shared<Moments>('mylo.goals.moments.v1', {});
/* Set when a moment was opened over the screen you were on, so leaving it
   goes back there instead of stacking another Today on the history. */
const momentNav = { over: false };
export const momentOver = (over?: boolean) => { if (over !== undefined) momentNav.over = over; return momentNav.over; };

/* Quick to-dos added through N4 today, for its "2 of 5" line. */
export const QUICK_LIMIT = 5;
