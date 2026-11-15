'use client';

import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { addDays, iso, todayIso } from './dates';
import type { Tone } from './parse';

/* What a person has, and nothing else: an account starts empty, which is
   what O17 "Today · empty (day one)" is for. Kept on the device for now and
   moved to Supabase with sign-in (X1 to X4); the shape stays the same. XP,
   levels and keys are the server's to decide, so they are not kept here. */
export type Kind = 'task' | 'todo' | 'goal' | 'system';
export type Item = {
  id: string; kind: Kind; title: string; date: string;
  time?: string; minutes?: number; with?: string; tag?: { label: string; tone: Tone };
  done: boolean; doneAt?: string;
};

type Store = {
  ready: boolean;
  items: Item[];
  add: (item: Omit<Item, 'id' | 'done'>) => string;
  update: (id: string, patch: Partial<Omit<Item, 'id'>>) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  captureOpen: boolean;
  openCapture: () => void;
  closeCapture: () => void;
};

const KEY = 'mylo.app.v1';
const noop = () => () => {};
function load(): Item[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}').items ?? []; } catch { return []; }
}
const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Read once on the device. The server has nothing, so until hydration is
  // over `ready` stays false and the screens show nothing rather than guess.
  const [items, setItems] = useState<Item[]>(load);
  const ready = useSyncExternalStore(noop, () => true, () => false);
  const [captureOpen, setCaptureOpen] = useState(false);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify({ items })); } catch { /* storage full or blocked */ }
  }, [items, ready]);

  const value = useMemo<Store>(() => ({
    ready, items, captureOpen,
    add: item => { const id = crypto.randomUUID(); setItems(all => [...all, { ...item, id, done: false }]); return id; },
    update: (id, patch) => setItems(all => all.map(i => i.id === id ? { ...i, ...patch } : i)),
    remove: id => setItems(all => all.filter(i => i.id !== id)),
    toggle: id => setItems(all => all.map(i => i.id === id ? { ...i, done: !i.done, doneAt: !i.done ? new Date().toISOString() : undefined } : i)),
    openCapture: () => setCaptureOpen(true),
    closeCapture: () => setCaptureOpen(false)
  }), [ready, items, captureOpen]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside StoreProvider');
  return s;
}

/* The day's things: tasks and to-dos dated today. */
export const onDay = (items: Item[], day: string) => items.filter(i => (i.kind === 'task' || i.kind === 'todo') && i.date === day);

/* Days in a row with at least one thing done, up to today or yesterday. */
export function streak(items: Item[]) {
  const doneDays = new Set(items.filter(i => i.done && i.doneAt).map(i => iso(new Date(i.doneAt!))));
  let d = new Date(); if (!doneDays.has(iso(d))) d = addDays(d, -1);
  let n = 0; while (doneDays.has(iso(d))) { n++; d = addDays(d, -1); }
  return n;
}

export const isToday = (day: string) => day === todayIso();
