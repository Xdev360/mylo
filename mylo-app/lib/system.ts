'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { goBack, stampNav } from '@/components/NavMotion';

/* The system area's saved state and helpers: settings, privacy, blocked and
   muted people, hidden words, the signed-in person, device data export, the
   install prompt and the network state. Every list starts empty. */

export const KEYS = {
  prefs: 'mylo.system.prefs.v1',
  privacy: 'mylo.system.privacy.v1',
  blocked: 'mylo.system.blocked.v1',
  muted: 'mylo.system.muted.v1',
  words: 'mylo.system.words.v1'
} as const;

export type Prefs = {
  haptics: boolean; sounds: boolean; language: string; timezone?: string;
  reminders: { task: boolean; evening: boolean; quiet: boolean; friends: boolean };
};
export const PREFS: Prefs = {
  haptics: true, sounds: false, language: 'English (UK)',
  reminders: { task: true, evening: true, quiet: true, friends: false }
};

export type Privacy = {
  profile: 'Friends' | 'Rooms' | 'Anyone on Mylo';
  message: 'Friends' | 'Rooms' | 'Nobody';
  online: boolean; receipts: boolean; findByPhone: boolean;
};
export const PRIVACY: Privacy = { profile: 'Friends', message: 'Friends', online: true, receipts: true, findByPhone: false };

/* Someone blocked or muted. Other areas add to these lists (profile "More"
   menu) with the same shape; `at` is an ISO date. */
export type Person = { id: string; name: string; at: string };

export const LANGUAGES = [
  { label: 'English (UK)', lang: 'en-GB' }, { label: 'English (US)', lang: 'en-US' },
  { label: 'Français', lang: 'fr' }, { label: 'Español', lang: 'es' }, { label: 'Português', lang: 'pt' },
  { label: 'Deutsch', lang: 'de' }, { label: 'Italiano', lang: 'it' }, { label: 'Türkçe', lang: 'tr' },
  { label: 'Kiswahili', lang: 'sw' }, { label: 'Yorùbá', lang: 'yo' }
];

/* Stamps the page language, so screen readers and spelling follow ST4. */
export function setDocLang(lang: string) { document.documentElement.lang = lang; }

export const VERSION = '1.0';
export const BUILD = '120';
export const SITE = 'https://www.staymylo.com';
export const SUPPORT_EMAIL = 'hello@staymylo.com';

/* ── Saved state shared by every screen that reads the same key ───────────
   Like useLocal, but every component using a key sees the same value at
   once (ST1 and DT8 are both mounted; one shows per width). Pass a constant
   `initial` (module level), not a fresh literal. Before hydration it gives
   `initial`, so nothing saved renders on the server. */
const subs = new Map<string, Set<() => void>>();
const cache = new Map<string, { raw: string | null; value: unknown }>();
function readKey<T>(key: string, initial: T): T {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { /* blocked */ }
  const c = cache.get(key);
  if (c && c.raw === raw) return c.value as T;
  let value = initial;
  if (raw) { try { value = JSON.parse(raw) as T; } catch { /* keep initial */ } }
  cache.set(key, { raw, value });
  return value;
}
function emit(key: string) { subs.get(key)?.forEach(f => f()); }
export function useShared<T>(key: string, initial: T) {
  const subscribe = useCallback((cb: () => void) => {
      if (!subs.has(key)) subs.set(key, new Set());
      subs.get(key)!.add(cb);
      const onStorage = (e: StorageEvent) => { if (e.key === key || e.key === null) cb(); };
      window.addEventListener('storage', onStorage);
      return () => { subs.get(key)?.delete(cb); window.removeEventListener('storage', onStorage); };
  }, [key]);
  const value = useSyncExternalStore(subscribe, () => readKey(key, initial), () => initial);
  const set = (next: T | ((prev: T) => T)) => {
    const prev = readKey(key, initial);
    const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
    const raw = JSON.stringify(v);
    try { localStorage.setItem(key, raw); } catch { /* storage blocked */ }
    cache.set(key, { raw, value: v });
    emit(key);
  };
  return [value, set] as const;
}

const NO_PEOPLE: Person[] = [];
const NO_WORDS: string[] = [];
export function usePrefs() {
  const [raw, set] = useShared<Partial<Prefs>>(KEYS.prefs, PREFS);
  const prefs: Prefs = { ...PREFS, ...raw, reminders: { ...PREFS.reminders, ...raw.reminders } };
  return [prefs, (patch: Partial<Prefs>) => set(p => ({ ...PREFS, ...p, ...patch }))] as const;
}
export function usePrivacy() {
  const [raw, set] = useShared<Partial<Privacy>>(KEYS.privacy, PRIVACY);
  const v: Privacy = { ...PRIVACY, ...raw };
  return [v, (patch: Partial<Privacy>) => set(p => ({ ...PRIVACY, ...p, ...patch }))] as const;
}
export function usePeople(list: 'blocked' | 'muted') { return useShared<Person[]>(KEYS[list], NO_PEOPLE); }
export function useWords() { return useShared<string[]>(KEYS.words, NO_WORDS); }

/* Read the saved prefs outside React (for haptics and sounds anywhere). */
export function readPrefs(): Prefs {
  try { return { ...PREFS, ...JSON.parse(localStorage.getItem(KEYS.prefs) ?? '{}') }; } catch { return PREFS; }
}

/* A short buzz on tap when Haptics is on and the device can. */
export function haptic(ms = 10) {
  if (typeof navigator === 'undefined' || !readPrefs().haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

/* ── The signed-in person ──────────────────────────────────────────────── */
export type Session = { ready: boolean; user: User | null };
export function useSession(): Session {
  const [s, setS] = useState<Session>({ ready: false, user: null });
  useEffect(() => {
    const sb = supabase();
    let live = true;
    sb.auth.getSession().then(({ data }) => { if (live) setS({ ready: true, user: data.session?.user ?? null }); })
      .catch(() => { if (live) setS({ ready: true, user: null }); });
    const { data } = sb.auth.onAuthStateChange((_e, session) => { if (live) setS({ ready: true, user: session?.user ?? null }); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  return s;
}

export type Profile = { username?: string | null; display_name?: string | null; phone?: string | null };
export function useProfile(user: User | null) {
  const [p, setP] = useState<Profile | null>(null);
  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase().from('profiles').select('username, display_name').eq('id', user.id).maybeSingle()
      .then(({ data }) => { if (live) setP((data as Profile) ?? {}); }, () => {});
    return () => { live = false; };
  }, [user]);
  return user ? p : null;
}

/* What to call the person and their initial. */
export function whoIs(user: User | null, profile: Profile | null) {
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const name = profile?.display_name || meta.display_name || meta.full_name || meta.name || profile?.username || user?.email?.split('@')[0] || '';
  const handle = profile?.username || meta.username || '';
  return { name, handle, initial: (name || '?').trim().charAt(0).toUpperCase() };
}

/* "ola@…": the start of the address, as ST1 shortens it. */
export function shortEmail(email?: string | null) {
  if (!email) return '';
  const [local] = email.split('@');
  return email.length > 14 ? `${local.slice(0, 6)}@…` : email;
}

/* ── Device data (ST13) ────────────────────────────────────────────────── */
export function deviceData() {
  const data: Record<string, unknown> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('mylo.')) continue;
      const raw = localStorage.getItem(k);
      try { data[k] = raw === null ? null : JSON.parse(raw); } catch { data[k] = raw; }
    }
  } catch { /* storage blocked */ }
  return data;
}

/* Saves every `mylo.*` key on this device as one JSON file. */
export function downloadDeviceData(extra?: Record<string, unknown>) {
  const body = { app: 'Mylo', version: VERSION, exportedAt: new Date().toISOString(), ...extra, device: deviceData() };
  const blob = new Blob([JSON.stringify(body, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `mylo-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Removes saved keys that start with `prefix` (all of Mylo with 'mylo.'). */
export function clearDevice(prefix = 'mylo.') {
  try {
    const gone: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(prefix)) gone.push(k); }
    gone.forEach(k => localStorage.removeItem(k));
    return gone.length;
  } catch { return 0; }
}

/* ── Network ───────────────────────────────────────────────────────────── */
function subscribeOnline(cb: () => void) {
  window.addEventListener('online', cb); window.addEventListener('offline', cb);
  return () => { window.removeEventListener('online', cb); window.removeEventListener('offline', cb); };
}
/* True while the browser says it is online; true on the server. */
export function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

/* ── Install (S10, S11) ────────────────────────────────────────────────── */
type PromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
let deferred: PromptEvent | null = null;
let installed = false;
const installSubs = new Set<() => void>();
const ping = () => installSubs.forEach(f => f());
/* Call once, as early as possible (the browser fires the event soon after
   load). `InstallCapture` does it for the app shell; /install does it too. */
export function captureInstall() {
  if (typeof window === 'undefined' || (window as unknown as { __myloInstall?: boolean }).__myloInstall) return;
  (window as unknown as { __myloInstall?: boolean }).__myloInstall = true;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e as PromptEvent; ping(); });
  window.addEventListener('appinstalled', () => { installed = true; deferred = null; ping(); });
}
function subscribeInstall(cb: () => void) { installSubs.add(cb); return () => { installSubs.delete(cb); }; }
export function useInstallPrompt() {
  const canPrompt = useSyncExternalStore(subscribeInstall, () => !!deferred, () => false);
  const done = useSyncExternalStore(subscribeInstall, () => installed, () => false);
  return {
    canPrompt, installed: done,
    prompt: async () => {
      const e = deferred; if (!e) return 'unavailable' as const;
      await e.prompt();
      const { outcome } = await e.userChoice;
      deferred = null; ping();
      return outcome;
    }
  };
}

export type Platform = 'ios' | 'android' | 'other';
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

/* "2 weeks ago", "in March": when someone was blocked. */
export function since(isoDate: string) {
  const d = new Date(isoDate); const now = new Date();
  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 31) { const w = Math.floor(days / 7); return w === 1 ? 'a week ago' : `${w} weeks ago`; }
  return `in ${d.toLocaleString('en-GB', { month: 'long' })}${d.getFullYear() !== now.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

/* ── Moving between screens from code ─────────────────────────────────────
   Links get their direction from NavMotion as they are tapped; a screen that
   moves on its own (after a save, a sign out) says which way it goes, so the
   page slides the right way. `leave` is the back button's logic: back to the
   screen before, or to `fallback` (sliding back) when this one was opened
   directly. */
type Nav = { back: () => void; push: (href: string) => void; replace: (href: string) => void };
export function go(router: Nav, href: string, dir: 'push' | 'pop' | 'tab' = 'push', replace = false) {
  stampNav(dir);
  if (replace) router.replace(href); else router.push(href);
}
export function leave(router: Nav, fallback: string) {
  if (typeof window !== 'undefined' && window.history.length > 1) goBack(router);
  else go(router, fallback, 'pop', true);
}

/* ── A message that outlives the screen that sent it ──────────────────────
   "Password changed" is said by the screen the person lands on: the form
   calls flash(), goes back, and the screen it returns to shows it with
   useFlash(show). Kept for this tab only. */
const FLASH = 'mylo.flash';
export function flash(msg: string) {
  try { sessionStorage.setItem(FLASH, msg); } catch { /* storage blocked */ }
}
export function useFlash(show: (msg: string) => void) {
  const ref = useRef(show);
  useEffect(() => { ref.current = show; }, [show]);
  useEffect(() => {
    let msg: string | null = null;
    try { msg = sessionStorage.getItem(FLASH); } catch { /* blocked */ }
    if (!msg) return;
    // After the page has slid in, so the toast is seen landing. It is taken
    // off the shelf only when shown (an effect may run twice in development).
    const t = setTimeout(() => {
      try { sessionStorage.removeItem(FLASH); } catch { /* blocked */ }
      ref.current(msg!);
    }, 260);
    return () => clearTimeout(t);
  }, []);
}

/* ── Something that animates out before it leaves ─────────────────────────
   const { mounted, shown } = usePresence(open, 240)
   Render while `mounted`; put the "in" class on while `shown`. It mounts
   first and turns `shown` on a frame later (so it can transition in), and
   turns `shown` off `ms` before unmounting (so it can transition out). */
export function usePresence(open: boolean, ms = 240) {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);
  // Opening mounts at once (state adjusted while rendering, not in an effect).
  if (open && !mounted) setMounted(true);
  useEffect(() => {
    if (open) {
      let b = 0;
      const a = requestAnimationFrame(() => { b = requestAnimationFrame(() => setShown(true)); });
      return () => { cancelAnimationFrame(a); cancelAnimationFrame(b); };
    }
    const t = setTimeout(() => { setShown(false); setMounted(false); }, ms);
    return () => clearTimeout(t);
  }, [open, ms]);
  return { mounted: mounted || open, shown: shown && open };
}

/* ── A small saved draft for this tab ─────────────────────────────────────
   A form half filled in survives a reload, and is gone once saved or
   dropped. */
export function readDraft<T>(key: string): T | null {
  try { const raw = sessionStorage.getItem(key); return raw ? JSON.parse(raw) as T : null; } catch { return null; }
}
export function writeDraft(key: string, value: unknown) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* blocked */ }
}
