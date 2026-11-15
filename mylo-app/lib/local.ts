'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';

/* A small piece of saved state, kept on the device under its own key, the
   same way lib/store.tsx keeps Today. Every screen starts empty; nothing here
   is sample data. Moves to Supabase with the rest once sign-in carries data.

   const [rooms, setRooms] = useLocal<Room[]>('mylo.rooms.v1', []);         */
const noop = () => () => {};
export function useLocal<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initial;
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : initial; } catch { return initial; }
  });
  const set = useCallback((next: T | ((prev: T) => T)) => {
    setValue(prev => {
      const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
      try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage blocked */ }
      return v;
    });
  }, [key]);
  return [value, set] as const;
}

/* False on the server and during hydration, true after: render nothing that
   depends on saved state until it is true. */
export function useHydrated() {
  return useSyncExternalStore(noop, () => true, () => false);
}
