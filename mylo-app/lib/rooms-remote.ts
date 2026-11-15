'use client';

import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  CHAT_COLOURS, CHEERS, ME, SCENES, STICKERS, cheer, quoteText, sticker,
  type CheerId, type Cover, type JoinRequest, type Member, type Message, type Notify,
  type Role, type Room, type SceneId, type StickerId, type WallpaperId
} from './rooms-core';

/* Rooms on the real Mylo backend, the same tables, RPCs, bucket and
   append-only conventions the current app (js/app.js) uses, so a room made
   here opens there and the other way round. Nothing here changes the schema.

   The model, as the current app has it:
   - A room is a `rooms` row of kind 'space'. create_room also makes its chat,
     a kind 'group' row (parent_room_id = the space, and the space's
     group_room_id points back). Everyone in the room is a member of both.
   - Chat messages live in `messages` on the group: kind is one of text,
     sticker, cheer, poll, mood, task_card, spin, chance, note; photos and
     voice notes are kind 'text' with payload.image / payload.voice; a reply
     rides in payload.reply = { id, from_id, text }.
   - RLS allows INSERT only (no UPDATE or DELETE from a client), so changes
     are append-only rows on the SPACE, told apart by payload.msg_kind:
       msgdel   { ref, scope: 'all' | 'me', by }  a deleted message
       seenonce { ref, n }                         a view once photo opened
       read     { room: <chat id>, ref }           how far someone has read
       chatpref { chat: <chat id>, key, value }    personal: mute, pin, …
   - Poll votes go through vote_poll, which rewrites the poll row.
   - Photos and voice notes go to the `avatars` bucket under <uid>/chat/.

   Ids: the signed-in person is ME everywhere a screen sees an id. */

/* ── Row shapes ─────────────────────────────────────────────────────────── */
type Json = Record<string, unknown>;
type Row = {
  id: string; room_id: string; from_id: string; kind: string | null; body: string | null;
  payload: unknown; created_at: string; _pending?: boolean; _preview?: { src?: string; clip?: string };
};
type RoomRow = {
  id: string; code: string | null; kind: string | null; title: string | null; avatar_url: string | null;
  created_at: string; parent_room_id: string | null; group_room_id: string | null; created_by: string | null;
  discoverable?: boolean | null; blurb?: string | null; category?: string | null; open_slots?: number | null;
};
type MemberRow = { room_id: string; user_id: string; role: string | null; joined_at: string | null; archived_at: string | null };
type Profile = { id: string; username?: string | null; display_name?: string | null; character?: string | null };
type Peek = { id: string; title?: string | null; blurb?: string | null; category?: string | null; avatar_url?: string | null; member_count?: number | null; faces?: string[] | null; open_slots?: number | null; created_at?: string | null; code?: string };
type Prefs = { colour?: string; wallpaper?: WallpaperId | null; notify?: Notify; readReceipts?: boolean; pinned?: string[] };

export type Status = 'loading' | 'ready' | 'error';
export type Snapshot = {
  uid: string | null;
  status: 'idle' | Status;
  error: string | null;
  rooms: Room[];
  peeks: Record<string, Room>;
  peekStatus: Record<string, Status>;
  directory: Record<string, { status: Status; ids: string[]; error?: string }>;
  messages: Record<string, Message[]>;
  roomStatus: Record<string, Status>;
  roomError: Record<string, string>;
  more: Record<string, boolean>;
  older: Record<string, boolean>;
  spaceOf: Record<string, string>;
  recent: StickerId[];
};

const META = ['msgdel', 'seenonce', 'read', 'chatpref'];
const PAGE = 50;
const BUCKET = 'avatars';
/* Where a Mylo room picture lives when the admin picks one of the scenes:
   the room picture is a URL, so it points at the app's own copy. */
const SCENE_HOST = 'https://beta.staymylo.com';
const PREFS = 'mylo.rooms.prefs.v1';
const RECENT = 'mylo.rooms.recent-stickers.v1';

/* Old-app stickers drawn with the nearest Mylo face. */
const OLD_STICKERS: Record<string, StickerId> = {
  plain: 'hi', happy: 'love', 'happy-2': 'wink', 'happy-3': 'laughing', 'happy-4': 'party',
  laughing: 'laughing', 'laughing-1': 'laughing', sad: 'sad', 'sad-1': 'sad', angry: 'angry', zzz: 'sleepy'
};

/* ── State ──────────────────────────────────────────────────────────────── */
const EMPTY: Snapshot = {
  uid: null, status: 'idle', error: null, rooms: [], peeks: {}, peekStatus: {}, directory: {},
  messages: {}, roomStatus: {}, roomError: {}, more: {}, older: {}, spaceOf: {}, recent: []
};
let snap: Snapshot = EMPTY;
const listeners = new Set<() => void>();

let uid: string | null = null;
let gen = 0;                                   // bumps on every sign-in change; stale answers are dropped
let spaces = new Map<string, RoomRow>();       // my rooms (kind 'space'), not archived
let myRole = new Map<string, Role>();
let chatOf = new Map<string, string>();        // space id → chat (group) id
let spaceOfChat = new Map<string, string>();   // chat id → space id
let membersBy = new Map<string, MemberRow[]>();
let profiles = new Map<string, Profile>();
let requestsBy = new Map<string, JoinRequest[]>();
let rows = new Map<string, Row[]>();           // chat rows per space, oldest first
let meta = new Map<string, Row[]>();           // msgdel / seenonce / read / chatpref per space
let myReq = new Map<string, string>();         // room id → my join request status
let peekRows = new Map<string, Peek>();
let channel: RealtimeChannel | null = null;
let channelKey = '';
let prefs: Record<string, Prefs> = {};
let recent: StickerId[] = [];
let openedOnce = new Set<string>();
let lastRead = new Map<string, { ref: string; at: number }>();

function readLocal<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function writeLocal(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full or blocked */ }
}

export function subscribe(cb: () => void) { listeners.add(cb); return () => { listeners.delete(cb); }; }
export const snapshot = () => snap;
export const serverSnapshot = () => EMPTY;
function emit(patch: Partial<Snapshot> = {}) {
  snap = { ...snap, ...patch, rooms: buildRooms(), peeks: buildPeeks(), messages: buildMessages(), recent, spaceOf: Object.fromEntries(spaceOfChat) };
  listeners.forEach(l => l());
}
function setStatus(patch: Partial<Snapshot>) { snap = { ...snap, ...patch }; listeners.forEach(l => l()); }

/* ── Small helpers ──────────────────────────────────────────────────────── */
const sb = () => supabase();
const pl = (r: { payload?: unknown } | null | undefined): Json => {
  const p = r?.payload;
  if (!p) return {};
  if (typeof p === 'string') { try { return JSON.parse(p) as Json; } catch { return {}; } }
  return p as Json;
};
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const asId = (id: string) => (id === uid ? ME : id);
const toId = (id: string) => (id === ME ? uid ?? id : id);
const nameOf = (id: string) => { const p = profiles.get(id); return p?.display_name || p?.username || 'Someone'; };
const roleOf = (r: string | null | undefined): Role => (r === 'owner' || r === 'admin' ? r : 'member');
const byTime = (a: { created_at: string }, b: { created_at: string }) => Date.parse(a.created_at) - Date.parse(b.created_at);

export function errText(e: unknown): string {
  const raw = e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e ?? '');
  if (/room_limit/i.test(raw)) return 'Room limit reached';
  if (/failed to fetch|network/i.test(raw)) return 'No connection. Try again.';
  return raw.replace(/^error:\s*/i, '') || 'Something went wrong';
}
function fail(error: unknown): never { throw new Error(errText(error)); }

function sceneOf(id: string): SceneId {
  let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SCENES[h % SCENES.length].id;
}
/* A room picture URL may carry how it was framed: #z=1.4&x=10&y=-5. */
function coverOf(id: string, url: string | null | undefined): Cover {
  if (!url) return { kind: 'scene', scene: sceneOf(id) };
  const [src, frag = ''] = url.split('#');
  const q = new URLSearchParams(frag);
  const n = (k: string) => { const v = Number(q.get(k)); return Number.isFinite(v) && q.has(k) ? v : undefined; };
  const scene = /\/figma\/rooms\/scene-([a-z]+)\.svg$/.exec(src)?.[1];
  if (scene && SCENES.some(s => s.id === scene)) return { kind: 'scene', scene: scene as SceneId, zoom: n('z'), x: n('x'), y: n('y') };
  return { kind: 'photo', src, zoom: n('z'), x: n('x'), y: n('y') };
}
function framed(src: string, c: { zoom?: number; x?: number; y?: number }) {
  const q = new URLSearchParams();
  if (c.zoom && c.zoom !== 1) q.set('z', c.zoom.toFixed(2));
  if (c.x) q.set('x', c.x.toFixed(1));
  if (c.y) q.set('y', c.y.toFixed(1));
  const f = q.toString();
  return f ? `${src.split('#')[0]}#${f}` : src.split('#')[0];
}

/* ── Building what the screens see ──────────────────────────────────────── */
function chatpref(spaceId: string, key: string): unknown {
  const chat = chatOf.get(spaceId) ?? spaceId;
  let v: unknown;
  for (const r of meta.get(spaceId) ?? []) {
    const p = pl(r);
    if (p.msg_kind === 'chatpref' && r.from_id === uid && p.chat === chat && p.key === key) v = p.value;
  }
  return v;
}

function buildRoom(s: RoomRow): Room {
  const list = (membersBy.get(s.id) ?? []).filter(m => !m.archived_at);
  const members: Member[] = list.map(m => ({ id: asId(m.user_id), name: nameOf(m.user_id), role: roleOf(m.role), joinedAt: m.joined_at ?? s.created_at }));
  if (!members.some(m => m.id === ME)) members.unshift({ id: ME, name: uid ? nameOf(uid) : 'You', role: myRole.get(s.id) ?? 'member', joinedAt: s.created_at });
  const p = prefs[s.id] ?? {};
  const n = members.length;
  return {
    id: s.id, name: s.title || 'Room', about: s.blurb ?? '', code: s.code ?? '', createdAt: s.created_at,
    cover: coverOf(s.id, s.avatar_url), category: s.category ?? undefined,
    members, requests: requestsBy.get(s.id) ?? [], capacity: n < 5 ? 5 : n + 1,
    joinPolicy: 'Ask to join', findable: !!s.discoverable,
    colour: p.colour ?? CHAT_COLOURS[0], wallpaper: p.wallpaper ?? null, notify: p.notify ?? 'All messages',
    muted: !!chatpref(s.id, 'mute'), readReceipts: p.readReceipts ?? true, disappear: 'Off',
    pinned: p.pinned ?? []
  };
}
function buildRooms(): Room[] {
  return [...spaces.values()].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).map(buildRoom);
}

function peekRoom(p: Peek): Room {
  const count = Math.max(0, Number(p.member_count) || 0);
  const faces = (p.faces ?? []).filter(Boolean);
  const members: Member[] = Array.from({ length: count }, (_, i) => ({
    id: `peek-${p.id}-${i}`, name: faces[i] ? faces[i]![0].toUpperCase() + faces[i]!.slice(1) : '', role: 'member', joinedAt: ''
  }));
  return {
    id: p.id, name: p.title || 'Room', about: p.blurb ?? '', code: p.code ?? '', createdAt: p.created_at ?? '',
    cover: coverOf(p.id, p.avatar_url), category: p.category ?? undefined,
    members, requests: [], capacity: p.open_slots ? count + p.open_slots : Math.max(5, count),
    joinPolicy: 'Ask to join', findable: true, colour: CHAT_COLOURS[0], wallpaper: null,
    notify: 'All messages', muted: false, readReceipts: true, disappear: 'Off', pinned: [],
    asked: myReq.get(p.id) === 'pending', peek: true
  };
}
function buildPeeks() {
  const out: Record<string, Room> = {};
  for (const [id, p] of peekRows) out[id] = peekRoom(p);
  return out;
}

function toMessage(r: Row, spaceId: string, del: { all: Set<string>; mine: Set<string> }, seen: Map<string, Set<string>>): Message | null {
  const p = pl(r);
  if (p.msg_kind || p.type === 'theme_change') return null;
  const authorId = asId(r.from_id);
  const reply = p.reply && typeof p.reply === 'object' ? p.reply as Json : null;
  const base: Message = {
    id: r.id, roomId: spaceId, authorId, authorName: nameOf(r.from_id), at: r.created_at, kind: 'text',
    replyTo: reply ? str(reply.id) || undefined : undefined,
    quote: reply && str(reply.id) ? { id: str(reply.id), authorId: asId(str(reply.from_id)), text: str(reply.text) } : undefined,
    pending: r._pending || undefined
  };
  if (del.mine.has(r.id)) base.hiddenFor = [ME];
  if (del.all.has(r.id)) return { ...base, deleted: true };
  const image = p.image && typeof p.image === 'object' ? p.image as Json : null;
  if (image) {
    const once = !!(p.once || p.streak);
    const openedBy = [...(seen.get(r.id) ?? [])].filter(id => id !== r.from_id).map(asId);
    const spent = once && authorId !== ME && openedBy.includes(ME);
    return { ...base, kind: 'photo', photo: { src: spent ? '' : r._preview?.src ?? str(image.url), once, caption: str(p.caption) || undefined, openedBy } };
  }
  const voice = p.voice && typeof p.voice === 'object' ? p.voice as Json : null;
  if (voice) {
    const bars = Array.isArray(voice.bars) ? (voice.bars as unknown[]).map(Number).filter(Number.isFinite) : [];
    return { ...base, kind: 'voice', voice: { clip: r._preview?.clip ?? str(voice.url), seconds: Math.round((Number(voice.ms) || 0) / 100) / 10, bars } };
  }
  const kind = r.kind || 'text';
  if (kind === 'sticker') {
    const sid = str(p.sticker);
    const id = (STICKERS.some(s => s.id === sid) ? sid : OLD_STICKERS[sid] ?? 'hi') as StickerId;
    return { ...base, kind: 'sticker', sticker: id };
  }
  if (kind === 'cheer') {
    const cid = str(p.cheer);
    return { ...base, kind: 'cheer', cheer: (CHEERS.some(c => c.id === cid) ? cid : 'proud') as CheerId };
  }
  if (kind === 'poll') {
    const opts = Array.isArray(p.options) ? p.options as Json[] : [];
    return {
      ...base, kind: 'poll',
      poll: {
        question: str(p.question) || r.body || '',
        options: opts.map(o => ({ id: str(o.id) || undefined, label: str(o.label), votes: (Array.isArray(o.votes) ? o.votes as string[] : []).map(asId) })),
        closesAt: str(p.closes_at)
      }
    };
  }
  if (kind === 'mood') return { ...base, text: `Feeling ${r.body || str(p.mood)}` };
  return { ...base, text: r.body || 'Message' };
}

function buildMessages(): Record<string, Message[]> {
  const out: Record<string, Message[]> = {};
  for (const [spaceId, list] of rows) {
    const del = { all: new Set<string>(), mine: new Set<string>() };
    const seen = new Map<string, Set<string>>();
    const reads = new Map<string, number>();
    const chat = chatOf.get(spaceId) ?? spaceId;
    const authors = new Map(list.map(r => [r.id, r.from_id]));
    for (const m of meta.get(spaceId) ?? []) {
      const p = pl(m); const ref = str(p.ref);
      if (p.msg_kind === 'msgdel' && ref) {
        if (p.scope === 'all') {
          const by = str(p.by) || m.from_id;
          if (by === m.from_id && (!authors.has(ref) || authors.get(ref) === m.from_id)) del.all.add(ref);
        } else if (m.from_id === uid) del.mine.add(ref);
      } else if (p.msg_kind === 'seenonce' && ref) {
        if (!seen.has(ref)) seen.set(ref, new Set());
        seen.get(ref)!.add(m.from_id);
      } else if (p.msg_kind === 'read' && p.room === chat && m.from_id !== uid) {
        reads.set(m.from_id, Math.max(reads.get(m.from_id) ?? 0, Date.parse(m.created_at)));
      }
    }
    out[spaceId] = list.map(r => {
      const m = toMessage(r, spaceId, del, seen);
      if (m && m.authorId === ME && !m.pending) {
        const t = Date.parse(m.at);
        m.seenBy = [...reads].filter(([, at]) => at >= t).map(([id]) => nameOf(id));
      }
      return m;
    }).filter((m): m is Message => !!m);
  }
  return out;
}

/* ── Loading ────────────────────────────────────────────────────────────── */
function resetAll() {
  spaces = new Map(); myRole = new Map(); chatOf = new Map(); spaceOfChat = new Map(); membersBy = new Map();
  profiles = new Map(); requestsBy = new Map(); rows = new Map(); meta = new Map(); myReq = new Map();
  peekRows = new Map(); openedOnce = new Set(); lastRead = new Map();
  readTimer.forEach(t => clearTimeout(t)); readTimer.clear();
  if (channel) { sb().removeChannel(channel); channel = null; channelKey = ''; }
}

/* Called by every rooms hook with the signed-in user (or null). */
export function attach(next: string | null) {
  if (next === uid && snap.uid === next) return;
  uid = next; gen++;
  resetAll();
  prefs = readLocal(PREFS, {});
  recent = readLocal(RECENT, []);
  snap = { ...EMPTY, uid: next, status: next ? 'loading' : 'idle', recent };
  listeners.forEach(l => l());
  if (next) { listen(); void loadList(); }
}

export function reload() { if (uid) { setStatus({ status: 'loading', error: null }); void loadList(); } }

async function loadProfiles(ids: string[]) {
  const need = [...new Set(ids)].filter(id => id && !profiles.has(id));
  if (!need.length) return;
  const { data } = await sb().from('profiles').select('id, username, display_name, character').in('id', need);
  for (const p of (data ?? []) as Profile[]) profiles.set(p.id, p);
}

async function loadMembers(spaceIds: string[]) {
  if (!spaceIds.length) return;
  const { data, error } = await sb().from('room_members').select('room_id, user_id, role, joined_at, archived_at').in('room_id', spaceIds);
  if (error) throw error;
  const by = new Map<string, MemberRow[]>();
  for (const m of (data ?? []) as MemberRow[]) { if (!by.has(m.room_id)) by.set(m.room_id, []); by.get(m.room_id)!.push(m); }
  for (const id of spaceIds) membersBy.set(id, (by.get(id) ?? []).sort((a, b) => Date.parse(a.joined_at ?? '') - Date.parse(b.joined_at ?? '')));
  await loadProfiles((data ?? []).map(m => (m as MemberRow).user_id));
}

async function loadMeta(spaceIds: string[]) {
  if (!spaceIds.length) return;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  const cols = 'id, room_id, from_id, kind, body, payload, created_at';
  const [del, eph, read] = await Promise.all([
    sb().from('messages').select(cols).in('room_id', spaceIds).eq('payload->>msg_kind', 'msgdel').order('created_at', { ascending: true }).limit(2000),
    sb().from('messages').select(cols).in('room_id', spaceIds).in('payload->>msg_kind', ['seenonce', 'chatpref']).gte('created_at', since).order('created_at', { ascending: true }).limit(2000),
    sb().from('messages').select(cols).in('room_id', spaceIds).eq('payload->>msg_kind', 'read').gte('created_at', since).order('created_at', { ascending: false }).limit(1000)
  ]);
  const all = [...(del.data ?? []), ...(eph.data ?? []), ...(read.data ?? [])] as Row[];
  for (const id of spaceIds) meta.set(id, (meta.get(id) ?? []).filter(r => r._pending));
  for (const r of all.sort(byTime)) addMeta(r);
}
function addMeta(r: Row) {
  const list = meta.get(r.room_id) ?? [];
  if (list.some(x => x.id === r.id)) return;
  meta.set(r.room_id, [...list, r]);
}

function mergeRows(spaceId: string, incoming: Row[]) {
  const have = rows.get(spaceId) ?? [];
  const ids = new Set(incoming.map(r => r.id));
  const keep = have.filter(r => !ids.has(r.id));
  rows.set(spaceId, [...keep, ...incoming].sort(byTime));
}

async function loadList() {
  const g = gen;
  try {
    const { data, error } = await sb()
      .from('room_members')
      .select('room_id, role, archived_at, joined_at, rooms(*)')
      .eq('user_id', uid!);
    if (error) throw error;
    if (g !== gen) return;
    type M = { room_id: string; role: string | null; archived_at: string | null; joined_at: string | null; rooms: RoomRow | RoomRow[] | null };
    const mine = ((data ?? []) as unknown as M[]).map(m => ({ ...m, room: Array.isArray(m.rooms) ? m.rooms[0] : m.rooms })).filter(m => m.room?.id);
    const nextSpaces = new Map<string, RoomRow>();
    const groups = new Map<string, { row: RoomRow; archived: boolean }>();
    myRole = new Map();
    for (const m of mine) {
      const r = m.room!;
      if (r.kind === 'space' && !m.archived_at) { nextSpaces.set(r.id, r); myRole.set(r.id, roleOf(m.role)); }
      if (r.kind === 'group') groups.set(r.id, { row: r, archived: !!m.archived_at });
    }
    spaces = nextSpaces;
    chatOf = new Map(); spaceOfChat = new Map();
    for (const s of spaces.values()) {
      const kids = [...groups.values()].filter(x => x.row.id === s.group_room_id || x.row.parent_room_id === s.id);
      const pick = kids.find(x => x.row.id === s.group_room_id && !x.archived) ?? kids.find(x => !x.archived) ?? kids[0];
      const chat = pick?.row.id ?? s.id;
      chatOf.set(s.id, chat);
      spaceOfChat.set(chat, s.id);
    }
    const ids = [...spaces.keys()];
    const chats = [...chatOf.values()];
    await Promise.all([
      loadMembers(ids),
      loadMeta(ids),
      loadMyRequests(),
      (async () => {
        if (!chats.length) return;
        const { data: msgs } = await sb().from('messages').select('*').in('room_id', chats)
          .order('created_at', { ascending: false }).limit(Math.max(80, chats.length * 8));
        const by = new Map<string, Row[]>();
        for (const r of (msgs ?? []) as Row[]) {
          const s = spaceOfChat.get(r.room_id); if (!s) continue;
          if (pl(r).msg_kind) continue;
          if (!by.has(s)) by.set(s, []); by.get(s)!.push(r);
        }
        for (const [s, list] of by) mergeRows(s, list);
        await loadProfiles([...by.values()].flat().map(r => r.from_id));
      })()
    ]);
    if (g !== gen) return;
    for (const id of [...rows.keys()]) if (!spaces.has(id)) rows.delete(id);
    listen();
    emit({ status: 'ready', error: null });
  } catch (e) {
    if (g !== gen) return;
    // A refresh that fails (the phone waking offline) keeps what is on screen.
    if (snap.status !== 'ready') setStatus({ status: 'error', error: errText(e) });
  }
}

async function loadMyRequests() {
  const { data, error } = await sb().rpc('my_join_requests');
  if (error) return;
  myReq = new Map(((data ?? []) as { room_id: string; status: string; title?: string; avatar_url?: string; category?: string }[]).map(r => [r.room_id, r.status]));
  for (const r of (data ?? []) as { room_id: string; title?: string; avatar_url?: string; category?: string }[]) {
    if (!peekRows.has(r.room_id)) peekRows.set(r.room_id, { id: r.room_id, title: r.title, avatar_url: r.avatar_url, category: r.category });
  }
}

/* One room open: its members, requests (admins), and the newest page. */
const opening = new Map<string, Promise<void>>();
export function openRoom(spaceId: string) {
  if (!uid || !spaces.has(spaceId)) return;
  if (opening.has(spaceId)) return;
  const g = gen;
  const first = snap.roomStatus[spaceId] !== 'ready';
  if (first) setStatus({ roomStatus: { ...snap.roomStatus, [spaceId]: 'loading' } });
  const job = (async () => {
    try {
      const chat = chatOf.get(spaceId) ?? spaceId;
      const [{ data, error }] = await Promise.all([
        sb().from('messages').select('*').eq('room_id', chat).order('created_at', { ascending: false }).limit(PAGE),
        loadMembers([spaceId]),
        myRole.get(spaceId) !== 'member' ? loadRequests(spaceId) : Promise.resolve()
      ]);
      if (error) throw error;
      if (g !== gen) return;
      const got = ((data ?? []) as Row[]).filter(r => !pl(r).msg_kind);
      await loadProfiles(got.map(r => r.from_id));
      mergeRows(spaceId, got);
      const more = first ? (data ?? []).length === PAGE : snap.more[spaceId] ?? (data ?? []).length === PAGE;
      emit({ roomStatus: { ...snap.roomStatus, [spaceId]: 'ready' }, more: { ...snap.more, [spaceId]: more } });
    } catch (e) {
      if (g !== gen) return;
      if (first) setStatus({ roomStatus: { ...snap.roomStatus, [spaceId]: 'error' }, roomError: { ...snap.roomError, [spaceId]: errText(e) } });
    } finally { opening.delete(spaceId); }
  })();
  opening.set(spaceId, job);
}
export function retryRoom(spaceId: string) {
  const s = { ...snap.roomStatus }; delete s[spaceId];
  snap = { ...snap, roomStatus: s };
  openRoom(spaceId);
}

export async function loadOlder(spaceId: string) {
  if (!uid || snap.older[spaceId] || snap.more[spaceId] === false) return;
  const list = (rows.get(spaceId) ?? []).filter(r => !r._pending);
  const oldest = list[0];
  if (!oldest) return;
  const g = gen;
  setStatus({ older: { ...snap.older, [spaceId]: true } });
  try {
    const chat = chatOf.get(spaceId) ?? spaceId;
    const { data, error } = await sb().from('messages').select('*').eq('room_id', chat)
      .lt('created_at', oldest.created_at).order('created_at', { ascending: false }).limit(PAGE);
    if (error) throw error;
    if (g !== gen) return;
    const got = ((data ?? []) as Row[]).filter(r => !pl(r).msg_kind);
    await loadProfiles(got.map(r => r.from_id));
    mergeRows(spaceId, got);
    emit({ older: { ...snap.older, [spaceId]: false }, more: { ...snap.more, [spaceId]: (data ?? []).length === PAGE } });
  } catch {
    if (g === gen) setStatus({ older: { ...snap.older, [spaceId]: false } });
  }
}

async function loadRequests(spaceId: string) {
  const { data, error } = await sb().rpc('list_join_requests', { p_room_id: spaceId });
  if (error) return;
  requestsBy.set(spaceId, ((data ?? []) as { id: string; username?: string | null; created_at: string }[])
    .map(r => ({ id: r.id, name: r.username || 'Someone', via: 'code' as const, at: r.created_at })));
}
export async function refreshRequests(spaceId: string) {
  if (!uid || !spaces.has(spaceId) || myRole.get(spaceId) === 'member') return;
  await loadRequests(spaceId);
  emit();
}

/* ── Find a room, and rooms known by their public face ──────────────────── */
export async function browse(category: string | null) {
  if (!uid) return;
  const key = category ?? 'All';
  const g = gen;
  setStatus({ directory: { ...snap.directory, [key]: { status: 'loading', ids: snap.directory[key]?.ids ?? [] } } });
  const { data, error } = await sb().rpc('browse_rooms', { p_category: category, p_limit: 40 });
  if (g !== gen) return;
  if (error) { setStatus({ directory: { ...snap.directory, [key]: { status: 'error', ids: [], error: errText(error) } } }); return; }
  const list = (data ?? []) as Peek[];
  for (const p of list) peekRows.set(p.id, p);
  emit({ directory: { ...snap.directory, [key]: { status: 'ready', ids: list.map(p => p.id) } } });
}

export async function peek(id: string) {
  if (!uid || spaces.has(id) || spaceOfChat.has(id) || snap.peekStatus[id] === 'loading') return;
  const g = gen;
  setStatus({ peekStatus: { ...snap.peekStatus, [id]: 'loading' } });
  try {
    if (!peekRows.has(id)) {
      const { data } = await sb().rpc('browse_rooms', { p_category: null, p_limit: 100 });
      for (const p of (data ?? []) as Peek[]) peekRows.set(p.id, p);
    }
    if (!peekRows.has(id)) await loadMyRequests();
    if (g !== gen) return;
    emit({ peekStatus: { ...snap.peekStatus, [id]: 'ready' } });
  } catch {
    if (g === gen) setStatus({ peekStatus: { ...snap.peekStatus, [id]: 'error' } });
  }
}

/* B4: look a code up before asking. Returns the room's id, or null. */
export async function peekCode(code: string): Promise<string | null> {
  if (!uid) return null;
  const { data, error } = await sb().rpc('peek_room_by_code', { p_code: code });
  if (error) fail(error);
  const row = (Array.isArray(data) ? data[0] : data) as Peek | null;
  if (!row?.id) return null;
  peekRows.set(row.id, { ...peekRows.get(row.id), ...row, code });
  emit();
  return row.id;
}

/* ── Rooms: create, join, leave, settings, people ───────────────────────── */
export async function create(title: string): Promise<string> {
  if (!uid) throw new Error('Sign in first');
  const { data: gate, error: gateErr } = await sb().rpc('can_create_room');
  if (gateErr) fail(gateErr);
  if (gate && (gate as { ok?: boolean }).ok === false) throw new Error('Room limit reached');
  const { data, error } = await sb().rpc('create_room', { p_title: title.trim(), p_public: false, p_blurb: null, p_category: null });
  if (error) fail(error);
  const row = (Array.isArray(data) ? data[0] : data) as RoomRow | null;
  if (!row?.id) throw new Error('Room was not created');
  await loadList();
  return row.id;
}

/* request_join leaves a pending request; someone already in (or who left)
   goes back in through join_room, as the current app does. */
export async function joinByCode(code: string): Promise<{ status: 'joined' | 'pending'; id: string }> {
  if (!uid) throw new Error('Sign in first');
  const clean = code.trim().toUpperCase();
  const { data, error } = await sb().rpc('request_join', { p_code: clean });
  if (error) {
    if (/already a member/i.test(error.message || '')) {
      const again = await sb().rpc('join_room', { p_code: clean });
      if (again.error) fail(again.error);
      const r = (Array.isArray(again.data) ? again.data[0] : again.data) as RoomRow | null;
      await loadList();
      return { status: 'joined', id: r?.id ?? '' };
    }
    fail(error);
  }
  const req = (Array.isArray(data) ? data[0] : data) as { room_id: string; status: string } | null;
  if (req?.status === 'approved') { await loadList(); return { status: 'joined', id: req.room_id }; }
  if (req?.room_id) { myReq.set(req.room_id, 'pending'); emit(); }
  return { status: 'pending', id: req?.room_id ?? '' };
}

export async function requestById(id: string) {
  if (!uid) throw new Error('Sign in first');
  const { error } = await sb().rpc('request_join_room', { p_room_id: id });
  if (error) fail(error);
  myReq.set(id, 'pending');
  emit();
}

/* Leaving archives your membership (archive_room), the current app's way of
   stepping out of a room; the code brings you back in. */
export async function leave(spaceId: string) {
  const { error } = await sb().rpc('archive_room', { p_room_id: spaceId });
  if (error) fail(error);
  spaces.delete(spaceId); rows.delete(spaceId);
  emit();
  void loadList();
}

export async function rename(spaceId: string, title: string) {
  const { data, error } = await sb().rpc('rename_room', { p_room_id: spaceId, p_title: title.trim() });
  if (error) fail(error);
  const s = spaces.get(spaceId);
  const row = (Array.isArray(data) ? data[0] : data) as RoomRow | null;
  if (s) spaces.set(spaceId, { ...s, ...(row && row.id === spaceId ? row : {}), title: row?.title ?? title.trim() });
  emit();
}

/* The description and the Find a room switch share one RPC, which rewrites
   blurb, category and open slots together, so the others ride along as they are. */
export async function setListing(spaceId: string, patch: { about?: string; findable?: boolean }) {
  const s = spaces.get(spaceId); if (!s) return;
  const on = patch.findable ?? !!s.discoverable;
  const blurb = (patch.about ?? s.blurb ?? '').trim();
  const { error } = await sb().rpc('set_room_discoverable', {
    p_room_id: spaceId, p_on: on, p_blurb: blurb || null, p_category: s.category ?? null, p_open_slots: s.open_slots ?? null
  });
  if (error) fail(error);
  spaces.set(spaceId, { ...s, discoverable: on, blurb: blurb || null });
  emit();
}

async function upload(blob: Blob, path: string, contentType: string) {
  const { error } = await sb().storage.from(BUCKET).upload(path, blob, { contentType, upsert: true });
  if (error) fail(error);
  return sb().storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
const stampName = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function setCover(spaceId: string, cover: Cover) {
  const s = spaces.get(spaceId); if (!s || !uid) return;
  let url: string;
  if (cover.kind === 'scene') url = framed(`${SCENE_HOST}/figma/rooms/scene-${cover.scene}.svg`, cover);
  else if (cover.kind === 'photo') {
    let src = cover.src;
    if (src.startsWith('data:') || src.startsWith('blob:')) {
      const blob = await (await fetch(src)).blob();
      src = await upload(blob, `${uid}/rooms/${spaceId}/${stampName()}.jpg`, blob.type || 'image/jpeg');
    }
    url = framed(src, cover);
  } else throw new Error('Pick a photo or a Mylo room');
  const { error } = await sb().rpc('set_room_avatar', { p_room_id: spaceId, p_avatar_url: url });
  if (error) fail(error);
  const chat = chatOf.get(spaceId);
  if (chat && chat !== spaceId) await sb().rpc('set_room_avatar', { p_room_id: chat, p_avatar_url: url });
  spaces.set(spaceId, { ...s, avatar_url: url });
  emit();
}

export async function setRole(spaceId: string, memberId: string, role: Role) {
  const { error } = await sb().rpc('set_member_role', { p_room_id: spaceId, p_user_id: toId(memberId), p_role: role });
  if (error) fail(error);
  await loadMembers([spaceId]);
  emit();
}
export async function removeMember(spaceId: string, memberId: string) {
  const { error } = await sb().rpc('kick_member', { p_room_id: spaceId, p_user_id: toId(memberId) });
  if (error) fail(error);
  await loadMembers([spaceId]);
  emit();
}
export async function decide(spaceId: string, requestId: string, letIn: boolean) {
  const { error } = await sb().rpc(letIn ? 'approve_join_request' : 'decline_join_request', { p_request_id: requestId });
  if (error) fail(error);
  requestsBy.set(spaceId, (requestsBy.get(spaceId) ?? []).filter(r => r.id !== requestId));
  emit();
  await Promise.all([loadRequests(spaceId), letIn ? loadMembers([spaceId]) : Promise.resolve()]);
  emit();
}

/* Personal and device-only: chat colour, wallpaper, notifications, read
   receipts and pinned messages have no shared column. */
export function setPrefs(spaceId: string, patch: Prefs | ((p: Prefs) => Prefs)) {
  const cur = prefs[spaceId] ?? {};
  prefs = { ...prefs, [spaceId]: { ...cur, ...(typeof patch === 'function' ? patch(cur) : patch) } };
  writeLocal(PREFS, prefs);
  emit();
}

/* ── Messages ───────────────────────────────────────────────────────────── */
async function metaInsert(spaceId: string, payload: Json) {
  if (!uid) throw new Error('Sign in first');
  const temp: Row = { id: `tmp-${stampName()}`, room_id: spaceId, from_id: uid, kind: 'text', body: '·', payload, created_at: new Date().toISOString(), _pending: true };
  meta.set(spaceId, [...(meta.get(spaceId) ?? []), temp]);
  emit();
  const { data, error } = await sb().from('messages').insert({ room_id: spaceId, from_id: uid, kind: 'text', body: '·', payload }).select().single();
  meta.set(spaceId, (meta.get(spaceId) ?? []).filter(r => r.id !== temp.id));
  if (error) { emit(); fail(error); }
  addMeta(data as Row);
  emit();
}

export async function setMuted(spaceId: string, on: boolean) {
  await metaInsert(spaceId, { msg_kind: 'chatpref', chat: chatOf.get(spaceId) ?? spaceId, key: 'mute', value: on ? '1' : '' });
}

type Outgoing = Omit<Message, 'id' | 'roomId' | 'authorId' | 'authorName' | 'at'>;
function dims(src: string): Promise<{ w: number; h: number }> {
  return new Promise(res => { const i = new Image(); i.onload = () => res({ w: i.naturalWidth, h: i.naturalHeight }); i.onerror = () => res({ w: 0, h: 0 }); i.src = src; });
}

export async function send(spaceId: string, m: Outgoing, blob?: Blob) {
  if (!uid) throw new Error('Sign in first');
  const chat = chatOf.get(spaceId);
  if (!chat) throw new Error('Open a room first');
  const all = rows.get(spaceId) ?? [];
  let reply: Json | undefined;
  if (m.replyTo) {
    const q = all.find(r => r.id === m.replyTo);
    const qm = q ? buildMessages()[spaceId]?.find(x => x.id === q.id) : undefined;
    if (q && !q._pending) reply = { id: q.id, from_id: q.from_id, text: qm ? quoteText(qm) : q.body ?? '' };
  }
  let kind = 'text'; let body = ''; let payload: Json = {};
  if (m.kind === 'text') { body = m.text ?? ''; }
  else if (m.kind === 'sticker') { const s = sticker(m.sticker!); kind = 'sticker'; body = s.label; payload = { sticker: s.id, label: s.label }; }
  else if (m.kind === 'cheer') { const c = cheer(m.cheer!); kind = 'cheer'; body = c.label; payload = { cheer: c.id, note: c.label }; }
  else if (m.kind === 'poll') {
    kind = 'poll'; body = m.poll!.question;
    payload = { question: m.poll!.question, options: m.poll!.options.map((o, i) => ({ id: String.fromCharCode(97 + i), label: o.label, votes: [] })), closes_at: m.poll!.closesAt };
  } else if (m.kind === 'photo') { body = m.photo!.caption || 'Photo'; payload = { image: { url: '' }, ...(m.photo!.caption ? { caption: m.photo!.caption } : {}), ...(m.photo!.once ? { once: true } : {}) }; }
  else if (m.kind === 'voice') { body = 'Voice note'; payload = { voice: { url: '', ms: Math.round(m.voice!.seconds * 1000), bars: m.voice!.bars } }; }
  if (reply) payload = { ...payload, reply };

  const temp: Row = {
    id: `tmp-${stampName()}`, room_id: chat, from_id: uid, kind, body, payload, created_at: new Date().toISOString(), _pending: true,
    _preview: m.kind === 'photo' ? { src: m.photo!.src } : m.kind === 'voice' ? { clip: m.voice!.clip } : undefined
  };
  mergeRows(spaceId, [temp]);
  if (m.kind === 'sticker' && m.sticker) { recent = [m.sticker, ...recent.filter(x => x !== m.sticker)].slice(0, 12); writeLocal(RECENT, recent); }
  emit();
  try {
    if (m.kind === 'photo') {
      const file = blob ?? await (await fetch(m.photo!.src)).blob();
      const { w, h } = await dims(m.photo!.src);
      payload = { ...payload, image: { url: await upload(file, `${uid}/chat/${stampName()}.jpg`, file.type || 'image/jpeg'), w, h } };
    } else if (m.kind === 'voice') {
      if (!blob) throw new Error('Nothing recorded');
      const type = blob.type || 'audio/webm';
      const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      payload = { ...payload, voice: { ...(payload.voice as Json), url: await upload(blob, `${uid}/chat/${stampName()}.${ext}`, type) } };
    }
    const { data, error } = await sb().from('messages').insert({ room_id: chat, from_id: uid, kind, body, payload }).select().single();
    if (error) fail(error);
    const row = data as Row;
    rows.set(spaceId, (rows.get(spaceId) ?? []).filter(r => r.id !== temp.id && r.id !== row.id));
    mergeRows(spaceId, [{ ...row, _preview: temp._preview }]);
    emit();
  } catch (e) {
    rows.set(spaceId, (rows.get(spaceId) ?? []).filter(r => r.id !== temp.id));
    emit();
    throw e instanceof Error ? e : new Error(errText(e));
  }
}

const serverId = (id: string) => !id.startsWith('tmp-');
export async function removeForEveryone(spaceId: string, id: string) {
  const r = (rows.get(spaceId) ?? []).find(x => x.id === id);
  if (!r || !serverId(id) || r.from_id !== uid) return;
  if (Date.now() - Date.parse(r.created_at) >= 10 * 60 * 1000) throw new Error('Too late to delete that for everyone');
  await metaInsert(spaceId, { msg_kind: 'msgdel', ref: id, scope: 'all', by: r.from_id });
  setPrefs(spaceId, p => ({ ...p, pinned: (p.pinned ?? []).filter(x => x !== id) }));
}
export async function removeForMe(spaceId: string, id: string) {
  if (!serverId(id)) return;
  await metaInsert(spaceId, { msg_kind: 'msgdel', ref: id, scope: 'me' });
}
export async function opened(spaceId: string, id: string) {
  if (!serverId(id) || openedOnce.has(id)) return;
  openedOnce.add(id);
  await metaInsert(spaceId, { msg_kind: 'seenonce', ref: id, n: 1 });
}

/* vote_poll moves your vote to the option you tap; there is no un-vote. */
export async function vote(spaceId: string, id: string, option: number) {
  const list = rows.get(spaceId) ?? [];
  const r = list.find(x => x.id === id);
  if (!r || !serverId(id) || !uid) return;
  const p = pl(r);
  const closes = Date.parse(str(p.closes_at));
  if (Number.isFinite(closes) && closes < Date.now()) return;
  const opts = (Array.isArray(p.options) ? p.options : []) as Json[];
  const target = opts[option]; if (!target) return;
  const oid = str(target.id) || String.fromCharCode(97 + option);
  const before = r.payload;
  const next = { ...p, options: opts.map(o => ({ ...o, votes: (str(o.id) === oid ? [...((o.votes as string[]) ?? []).filter(v => v !== uid), uid] : ((o.votes as string[]) ?? []).filter(v => v !== uid)) })) };
  rows.set(spaceId, list.map(x => x.id === id ? { ...x, payload: next } : x));
  emit();
  const { data, error } = await sb().rpc('vote_poll', { p_message_id: id, p_option_id: oid });
  if (error) {
    rows.set(spaceId, (rows.get(spaceId) ?? []).map(x => x.id === id ? { ...x, payload: before } : x));
    emit();
    fail(error);
  }
  const row = (Array.isArray(data) ? data[0] : data) as Row | null;
  if (row?.id) { mergeRows(spaceId, [row]); emit(); }
}

const readTimer = new Map<string, ReturnType<typeof setTimeout>>();
/* How far I have read, the current app's high-water mark. Written only when
   it moves, and at most every ten seconds. */
export function markRead(spaceId: string) {
  if (!uid || prefs[spaceId]?.readReceipts === false) return;
  const list = (rows.get(spaceId) ?? []).filter(r => !r._pending);
  const last = list[list.length - 1];
  if (!last) return;
  const chat = chatOf.get(spaceId) ?? spaceId;
  const mineAlready = (meta.get(spaceId) ?? []).some(r => r.from_id === uid && pl(r).msg_kind === 'read' && pl(r).room === chat && pl(r).ref === last.id);
  const prev = lastRead.get(spaceId);
  if (mineAlready || prev?.ref === last.id) return;
  if (prev && Date.now() - prev.at < 10000) {
    if (!readTimer.has(spaceId)) readTimer.set(spaceId, setTimeout(() => { readTimer.delete(spaceId); markRead(spaceId); }, 10000 - (Date.now() - prev.at)));
    return;
  }
  lastRead.set(spaceId, { ref: last.id, at: Date.now() });
  sb().from('messages').insert({ room_id: spaceId, from_id: uid, kind: 'text', body: '·', payload: { msg_kind: 'read', room: chat, ref: last.id } })
    .select().single().then(({ data }) => { if (data) { addMeta(data as Row); emit(); } }, () => {});
}

/* ── Live ───────────────────────────────────────────────────────────────── */
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
function soonRefreshMembers(spaceId: string) {
  if (refreshTimer) return;
  refreshTimer = setTimeout(() => { refreshTimer = null; void loadMembers([spaceId]).then(() => emit(), () => {}); }, 400);
}

function onInsert(row: Row) {
  if (!row?.room_id) return;
  const p = pl(row);
  if (spaces.has(row.room_id) && typeof p.msg_kind === 'string' && META.includes(p.msg_kind)) {
    meta.set(row.room_id, (meta.get(row.room_id) ?? []).filter(r => !(r._pending && r.from_id === row.from_id && JSON.stringify(r.payload) === JSON.stringify(row.payload))));
    addMeta(row); emit(); return;
  }
  if (p.msg_kind) return;
  const spaceId = spaceOfChat.get(row.room_id);
  if (!spaceId) return;
  const list = rows.get(spaceId) ?? [];
  if (list.some(r => r.id === row.id)) return;
  // The server copy of something I just sent: drop my placeholder for it.
  const temp = list.find(r => r._pending && r.from_id === row.from_id && r.kind === row.kind && r.body === row.body);
  rows.set(spaceId, list.filter(r => r !== temp));
  mergeRows(spaceId, [{ ...row, _preview: temp?._preview }]);
  if (!profiles.has(row.from_id) || !(membersBy.get(spaceId) ?? []).some(m => m.user_id === row.from_id && !m.archived_at)) soonRefreshMembers(spaceId);
  emit();
}
function onUpdate(row: Row) {
  const spaceId = row?.room_id ? spaceOfChat.get(row.room_id) : undefined;
  if (!spaceId) return;
  const list = rows.get(spaceId) ?? [];
  if (!list.some(r => r.id === row.id)) return;
  rows.set(spaceId, list.map(r => r.id === row.id ? { ...row, _preview: r._preview } : r));
  emit();
}

/* One channel for everything I am in: new messages in every chat (the list
   previews and the open room), the append-only rows on every room, and poll
   votes. Rebuilt when the set of rooms changes. */
function listen() {
  if (!uid) return;
  const chats = [...new Set(chatOf.values())];
  const all = [...new Set([...chats, ...spaces.keys()])].slice(0, 100);
  const key = all.slice().sort().join(',');
  if (key === channelKey && channel) return;
  if (channel) { sb().removeChannel(channel); channel = null; }
  channelKey = key;
  if (!all.length) return;
  channel = sb().channel(`rooms:${uid}:${Date.now()}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=in.(${all.join(',')})` }, e => onInsert(e.new as Row))
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `room_id=in.(${chats.slice(0, 100).join(',')})` }, e => onUpdate(e.new as Row))
    .subscribe();
}

/* Coming back to the app: catch up on what the socket may have missed while
   the phone slept, and on anyone who joined. */
let wired = false;
let lastWake = 0;
export function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  const wake = () => {
    if (document.visibilityState !== 'visible' || !uid || snap.status !== 'ready') return;
    if (Date.now() - lastWake < 15000) return;
    lastWake = Date.now();
    void loadList();
    for (const id of Object.keys(snap.roomStatus)) if (snap.roomStatus[id] === 'ready') openRoom(id);
  };
  document.addEventListener('visibilitychange', wake);
  window.addEventListener('focus', wake);
  /* Nothing on the server pushes a membership change, so while the app is in
     front: a request of mine still waiting is checked every 30 seconds (the
     room appears once an admin lets me in), and an admin's open rooms pick
     up new requests. */
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !uid || snap.status !== 'ready') return;
    if ([...myReq.values()].includes('pending')) {
      void loadMyRequests().then(() => {
        if ([...myReq].some(([id, st]) => st === 'approved' && !spaces.has(id))) void loadList(); else emit();
      }, () => {});
    }
    const admin = Object.keys(snap.roomStatus).filter(id => snap.roomStatus[id] === 'ready' && myRole.get(id) !== 'member' && spaces.has(id));
    if (admin.length) void Promise.all(admin.map(loadRequests)).then(() => emit(), () => {});
  }, 30000);
}
