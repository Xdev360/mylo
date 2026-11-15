'use client';

import { useCallback, useSyncExternalStore } from 'react';

/* Social, on the device. Posts, friends and the rest are kept under their own
   `mylo.social.*` keys in the same JSON form `useLocal` writes, but through one
   shared cache: the feed, a post card and its sheets all read and write the
   same posts, so a reaction made in a sheet shows on the card at once (and in
   another tab, through the storage event). Every account starts empty. */

/* ── A shared, subscribable piece of saved state ─────────────────────────── */
const cache = new Map<string, unknown>();
const subs = new Map<string, Set<() => void>>();
function read<T>(key: string, initial: T): T {
  if (cache.has(key)) return cache.get(key) as T;
  let v: T = initial;
  try { const raw = localStorage.getItem(key); if (raw) v = JSON.parse(raw) as T; } catch { /* blocked */ }
  cache.set(key, v);
  return v;
}
function emit(key: string) { subs.get(key)?.forEach(f => f()); }
if (typeof window !== 'undefined') {
  window.addEventListener('storage', e => { if (e.key && cache.has(e.key)) { cache.delete(e.key); emit(e.key); } });
}
/* Writes the value; false when the device has no room left for it. */
export function writeShared<T>(key: string, next: T | ((prev: T) => T), initial: T): boolean {
  const prev = read(key, initial);
  const v = typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
  let ok = true;
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { ok = false; }
  if (ok) { cache.set(key, v); emit(key); }
  return ok;
}
/* Drops the cached copies so the next read comes from storage (pull to refresh). */
export function refreshShared(...keys: string[]) { keys.forEach(k => { cache.delete(k); emit(k); }); }

export function useShared<T>(key: string, initial: T) {
  const value = useSyncExternalStore(
    useCallback((f: () => void) => {
      if (!subs.has(key)) subs.set(key, new Set());
      subs.get(key)!.add(f);
      return () => { subs.get(key)?.delete(f); };
    }, [key]),
    () => read(key, initial),
    () => initial
  );
  const set = useCallback((next: T | ((prev: T) => T)) => writeShared(key, next, initial), [key, initial]);
  return [value, set] as const;
}

/* ── Shapes ──────────────────────────────────────────────────────────────── */
export type Person = { name: string; handle: string };
export type ReactionKey = 'love' | 'laughing' | 'proud' | 'letsgo' | 'shocked' | 'sad';
export type QuoteTone = 'amber' | 'green' | 'red' | 'grey' | 'ink';
export type QuoteSize = 'Small' | 'Medium' | 'Large';
export type PhotoFilter = 'Normal' | 'Warm' | 'Calm' | 'Mono' | 'Film';
export type Crop = 'Original' | 'Square' | 'Portrait';
export type Comment = { id: string; by: Person; text: string; at: number; likes: string[] };
export type Post = {
  id: string; kind: 'thought' | 'quote' | 'photo'; by: Person; at: number; audience: 'Friends';
  text: string;
  saidBy?: string; tone?: QuoteTone; size?: QuoteSize;              // quotes
  photos?: string[]; filter?: PhotoFilter; crop?: Crop; sticker?: ReactionKey; // photos (and a thought's sticker)
  reactions: Record<string, ReactionKey>; comments: Comment[]; reposts: string[];
};
export type Friend = Person & { addedAt: number; loved?: boolean };
export type Report = { target: string; kind: 'post' | 'person'; reason: string; at: number };

export const K = {
  posts: 'mylo.social.posts.v1',
  friends: 'mylo.social.friends.v1',
  saved: 'mylo.social.saved.v1',
  hidden: 'mylo.social.hidden.v1',
  muted: 'mylo.social.muted.v1',
  blocked: 'mylo.social.blocked.v1',
  reports: 'mylo.social.reports.v1',
  sent: 'mylo.social.sent.v1',
  cheers: 'mylo.social.cheers.v1',
  seen: 'mylo.social.visibility.v1',
  me: 'mylo.social.me.v1'
} as const;

/* Stable empty values, so a snapshot never changes identity on its own. */
const NO_POSTS: Post[] = []; const NO_FRIENDS: Friend[] = []; const NO_IDS: string[] = []; const NO_REPORTS: Report[] = [];
const NO_MAP: Record<string, number> = {};
export const usePosts = () => useShared<Post[]>(K.posts, NO_POSTS);
export const useFriends = () => useShared<Friend[]>(K.friends, NO_FRIENDS);
export const useSaved = () => useShared<string[]>(K.saved, NO_IDS);
export const useHidden = () => useShared<string[]>(K.hidden, NO_IDS);
export const useMuted = () => useShared<string[]>(K.muted, NO_IDS);
export const useBlocked = () => useShared<string[]>(K.blocked, NO_IDS);
export const useReports = () => useShared<Report[]>(K.reports, NO_REPORTS);
export const useSent = () => useShared<string[]>(K.sent, NO_IDS);
export const useCheers = () => useShared<Record<string, number>>(K.cheers, NO_MAP);

export type Seen = { tasks: boolean; names: boolean; focus: boolean; streak: boolean };
const SEEN: Seen = { tasks: true, names: true, focus: true, streak: false };
export const useSeen = () => useShared<Seen>(K.seen, SEEN);

/* Who is posting: the name and username from the profile area
   (mylo.profile.v1). Until there is one, the person is "You". */
const ME_FALLBACK: Person = { name: 'You', handle: 'you' };
let meRaw: string | null = null;
let meCache: Person = ME_FALLBACK;
function readMe(): Person {
  let raw: string | null = null;
  try { raw = localStorage.getItem('mylo.profile.v1'); } catch { /* blocked */ }
  if (raw === meRaw) return meCache;
  meRaw = raw;
  try {
    const v = JSON.parse(raw ?? 'null');
    const username = typeof v?.username === 'string' ? cleanHandle(v.username) : '';
    const name = typeof v?.name === 'string' && v.name.trim() ? v.name.trim() : username;
    meCache = name ? { name, handle: username || cleanHandle(name) || 'you' } : ME_FALLBACK;
  } catch { meCache = ME_FALLBACK; }
  return meCache;
}
const noSub = () => () => {};
export function useMe(): Person {
  return useSyncExternalStore(noSub, readMe, () => ME_FALLBACK);
}
export const isMe = (p: Person, me: Person) => p.handle === me.handle;

/* ── Rooms, read from the rooms area (mylo.rooms.list.v1) ──────────────── */
/* `members` are the others in the room, by name; `size` counts you too. */
export type RoomLite = { id: string; name: string; members: string[]; size: number; goals: { title: string; period?: string }[] };
export const ROOMS_KEY = 'mylo.rooms.list.v1';
/* Read straight from storage each time (the rooms area keeps its own copy and
   writes it there), parsed once per change. */
let roomsRaw: string | null | undefined;
let roomsCache: RoomLite[] = [];
const NO_ROOMS: RoomLite[] = [];
function readRooms(): RoomLite[] {
  let raw: string | null = null;
  try { raw = localStorage.getItem(ROOMS_KEY); } catch { /* blocked */ }
  if (raw === roomsRaw) return roomsCache;
  roomsRaw = raw;
  try { roomsCache = parseRooms(JSON.parse(raw ?? '[]')); } catch { roomsCache = []; }
  return roomsCache;
}
const onStorage = (f: () => void) => { window.addEventListener('storage', f); return () => window.removeEventListener('storage', f); };
export function useRooms(): RoomLite[] {
  return useSyncExternalStore(onStorage, readRooms, () => NO_ROOMS);
}
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
function parseRooms(raw: unknown): RoomLite[] {
  if (!Array.isArray(raw)) return [];
  const out: RoomLite[] = [];
  for (const r of raw) {
    if (!r || typeof r !== 'object') continue;
    const o = r as Record<string, unknown>;
    const id = typeof o.id === 'string' || typeof o.id === 'number' ? String(o.id) : null;
    const name = str(o.name) ?? str(o.title);
    if (!id || !name || o.asked === true) continue;
    const list = Array.isArray(o.members) ? o.members : [];
    const members: string[] = [];
    let size = 0;
    for (const m of list) {
      const mo = m && typeof m === 'object' ? m as Record<string, unknown> : null;
      const mName = typeof m === 'string' ? str(m) : mo ? str(mo.name) ?? str(mo.displayName) : null;
      if (!mName) continue;
      size++;
      if (mo?.id === 'me') continue;
      members.push(mName);
    }
    const goals: RoomLite['goals'] = [];
    for (const g of Array.isArray(o.goals) ? o.goals : []) {
      const go = g && typeof g === 'object' ? g as Record<string, unknown> : null;
      const title = typeof g === 'string' ? str(g) : go ? str(go.title) : null;
      if (title) goals.push({ title, period: (go && str(go.period)) || undefined });
    }
    out.push({ id, name, members, size: Math.max(size, members.length + 1), goals });
  }
  return out;
}

/* ── Small helpers ───────────────────────────────────────────────────────── */
export const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));
export const cleanHandle = (s: string) => s.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9._]/g, '').slice(0, 24);
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/* The four soft tints the feed draws avatars in, picked from the name. */
const TINTS = ['var(--tint-red)', 'var(--tint-green)', 'var(--tint-amber)', 'var(--tint-blue)'];
/* And the room's solid ones (RP1). */
const SOLIDS = ['#E8A23A', '#2B3150', '#D9644E', '#5B8DEF'];
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
export const tintFor = (key: string) => TINTS[hash(key) % TINTS.length];
export const solidFor = (key: string) => SOLIDS[hash(key) % SOLIDS.length];

export function ago(at: number, now = Date.now()) {
  const s = Math.max(0, (now - at) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  const d = new Date(at), today = new Date(now);
  if (d.toDateString() === today.toDateString()) return `${Math.floor(s / 3600)}h`;
  const y = new Date(now); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export const KIND_LABEL = { thought: 'Thought', quote: 'Quote', photo: 'Photo' } as const;

export const REACTIONS: { key: ReactionKey; label: string; art: string }[] = [
  { key: 'love', label: 'Love', art: '/figma/social/r-love.svg' },
  { key: 'laughing', label: 'Laughing', art: '/figma/social/r-laughing.svg' },
  { key: 'proud', label: 'Proud', art: '/figma/social/r-proud.svg' },
  { key: 'letsgo', label: 'Let’s go', art: '/figma/social/r-letsgo.svg' },
  { key: 'shocked', label: 'Shocked', art: '/figma/social/r-shocked.svg' },
  { key: 'sad', label: 'Sad', art: '/figma/social/r-sad.svg' }
];
export const reactionArt = (k: ReactionKey) => REACTIONS.find(r => r.key === k)!.art;

/* The quote card colours (VF7), in both themes. */
export const QUOTE_TONES: { key: QuoteTone; bg: string; ink: string; sub: string }[] = [
  { key: 'amber', bg: 'var(--tint-amber)', ink: 'var(--ink)', sub: 'var(--text-2)' },
  { key: 'green', bg: 'var(--tint-green)', ink: 'var(--ink)', sub: 'var(--text-2)' },
  { key: 'red', bg: 'var(--tint-red)', ink: 'var(--ink)', sub: 'var(--text-2)' },
  { key: 'grey', bg: 'var(--surface-2)', ink: 'var(--ink)', sub: 'var(--text-2)' },
  /* The ink card turns over with the theme, as the dark frames draw it. */
  { key: 'ink', bg: 'var(--primary)', ink: 'var(--on-primary)', sub: 'color-mix(in srgb, var(--on-primary) 60%, transparent)' }
];
export const toneOf = (t?: QuoteTone) => QUOTE_TONES.find(q => q.key === t) ?? QUOTE_TONES[0];

/* Photo filters (VF9), drawn with CSS so they stay the same everywhere. */
export const FILTERS: Record<PhotoFilter, string> = {
  Normal: 'none',
  Warm: 'sepia(.22) saturate(1.25) hue-rotate(-8deg) brightness(1.03)',
  Calm: 'saturate(.8) hue-rotate(8deg) brightness(1.04) contrast(.95)',
  Mono: 'grayscale(1) contrast(1.05)',
  Film: 'sepia(.35) contrast(1.1) brightness(.95) saturate(.9)'
};
export const CROPS: Record<Crop, number | null> = { Original: null, Square: 1, Portrait: 4 / 5 };

export const postUrl = (id: string) => (typeof window !== 'undefined' ? window.location.origin : 'https://mylo.vercel.app') + `/feed/${id}`;
export const inviteUrl = (handle: string) => (typeof window !== 'undefined' ? window.location.origin : 'https://mylo.vercel.app') + `/friends/add?u=${encodeURIComponent(handle)}`;

export async function copyText(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try {
      const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
    } catch { return false; }
  }
}
/* Web Share where the device has it, else the link is copied. */
export async function shareLink(url: string, title: string, text?: string): Promise<'shared' | 'copied' | 'failed'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try { await navigator.share({ url, title, text }); return 'shared'; } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'failed';
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

/* A picked photo, shrunk to at most 1080 on its long side and kept as a JPEG
   data URL, so a few of them fit in the device's storage. */
export async function fileToDataUrl(file: File, max = 1080): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}
