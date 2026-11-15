'use client';

import { useSyncExternalStore } from 'react';

/* Rooms and their messages, kept on this device for now under mylo.rooms.*.
   The shapes follow the rooms / room_members / messages tables the server
   pass will add: a Room carries its members and join requests, a Message
   belongs to one room and one author. Every account starts with no rooms and
   no messages; nothing here is sample data.

   One store for every screen in the area (chats list, chat, settings, desk)
   so a message sent in one place shows up in the others at once. */

export const ME = 'me';
export type Role = 'owner' | 'admin' | 'member';
export type Member = { id: string; name: string; role: Role; joinedAt: string };
export type JoinRequest = { id: string; name: string; via: 'code' | 'link'; note?: string; at: string };
export type Cover =
  | { kind: 'colour'; colour: string }
  | { kind: 'scene'; scene: SceneId; zoom?: number; x?: number; y?: number }
  | { kind: 'photo'; src: string; zoom?: number; x?: number; y?: number };
export type Notify = 'All messages' | 'Check-ins and cheers' | 'Off';
export type Disappear = 'Off' | '24 hours' | '7 days';
export type Room = {
  id: string; name: string; about: string; code: string; createdAt: string;
  cover: Cover; category?: string;
  members: Member[]; requests: JoinRequest[]; capacity: number;
  joinPolicy: 'Ask to join' | 'Anyone with the code'; findable: boolean;
  colour: string; wallpaper: WallpaperId | null;
  notify: Notify; muted: boolean; readReceipts: boolean; disappear: Disappear;
  pinned: string[];
  /* Rooms I asked to join from a code or Find a room, waiting on the admin. */
  asked?: boolean;
};

export type ReactionKey = 'heart' | 'party' | 'fire' | 'star' | 'hand' | `sticker:${StickerId}`;
export type Message = {
  id: string; roomId: string; authorId: string; authorName: string; at: string;
  kind: 'text' | 'sticker' | 'cheer' | 'poll' | 'voice' | 'photo';
  text?: string;
  sticker?: StickerId;
  cheer?: CheerId;
  poll?: { question: string; options: { label: string; votes: string[] }[]; closesAt: string };
  voice?: { clip: string; seconds: number; bars: number[] };
  photo?: { src: string; once: boolean; caption?: string; openedBy: string[] };
  replyTo?: string;
  editedAt?: string;
  deleted?: boolean;
  hiddenFor?: string[];
  reactions?: Partial<Record<ReactionKey, string[]>>;
};

/* ── Catalogues, from the frames ─────────────────────────────────────────── */
export const STICKERS = [
  { id: 'angry', label: 'Angry', size: 126 }, { id: 'love', label: 'Love', size: 120 },
  { id: 'sad', label: 'Sad', size: 120 }, { id: 'crying', label: 'Crying', size: 120 },
  { id: 'laughing', label: 'Laughing', size: 136 }, { id: 'vomit', label: 'Vomit', size: 120 },
  { id: 'shocked', label: 'Shocked', size: 120 }, { id: 'cool', label: 'Cool', size: 120 },
  { id: 'sleepy', label: 'Sleepy', size: 120 }, { id: 'party', label: 'Party', size: 120 },
  { id: 'proud', label: 'Proud', size: 120 }, { id: 'thinking', label: 'Thinking', size: 120 },
  { id: 'dizzy', label: 'Dizzy', size: 136 }, { id: 'hi', label: 'Hi', size: 130 },
  { id: 'letsgo', label: 'Lets go', size: 132 }, { id: 'wink', label: 'Wink', size: 120 }
] as const;
export type StickerId = typeof STICKERS[number]['id'];
export const sticker = (id: string) => STICKERS.find(s => s.id === id) ?? STICKERS[0];

export const CHEERS = [
  { id: 'win', label: 'Cheer a win!', sticker: 'party', from: '#FFE38A', to: '#F5A04A' },
  { id: 'letsgo', label: "Let's go!", sticker: 'letsgo', from: '#9BF0C8', to: '#2FA36B' },
  { id: 'proud', label: 'Proud of you!', sticker: 'proud', from: '#FFC2D6', to: '#E0457A' },
  { id: 'keepgoing', label: 'Keep going!', sticker: 'hi', from: '#BFD8FF', to: '#3E7BFA' },
  { id: 'nice', label: 'Nice one!', sticker: 'cool', from: '#E4D4FF', to: '#7A5CD9' },
  { id: 'gotthis', label: 'You got this!', sticker: 'laughing', from: '#FFD9A8', to: '#FF7A3D' }
] as const;
export type CheerId = typeof CHEERS[number]['id'];
export const cheer = (id: string) => CHEERS.find(c => c.id === id) ?? CHEERS[2];

export const WALLPAPERS = [
  { id: 'sunrise', label: 'Sunrise', locked: false }, { id: 'sky', label: 'Sky', locked: false },
  { id: 'forest', label: 'Forest', locked: false }, { id: 'beach', label: 'Beach', locked: false },
  { id: 'city', label: 'City night', locked: false }, { id: 'snow', label: 'Snow', locked: true },
  { id: 'space', label: 'Space', locked: false }, { id: 'aurora', label: 'Aurora', locked: true },
  { id: 'golden', label: 'Golden hour', locked: true }
] as const;
export type WallpaperId = typeof WALLPAPERS[number]['id'];
export const wallpaper = (id: string | null) => WALLPAPERS.find(w => w.id === id);

export const SCENES = [
  { id: 'gym', label: 'Gym' }, { id: 'night', label: 'Night' }, { id: 'studio', label: 'Studio' },
  { id: 'cozy', label: 'Cozy' }, { id: 'beach', label: 'Beach' }, { id: 'garden', label: 'Garden' }
] as const;
export type SceneId = typeof SCENES[number]['id'];

export const CHAT_COLOURS = ['var(--primary)', '#3E7BFA', '#2FA36B', '#E2594B', '#7A5CD9', '#D99A1E', '#E0457A'];
export const COVER_COLOURS = ['#F5A04A', '#5B8DEF', '#4BA37A', '#9B6BD6', '#E5574A', '#2B3150'];
export const AVATAR_COLOURS = ['#E8A23A', '#5B8DEF', '#D9644E', '#4BA37A', '#9B6BD6', '#E0457A'];
export const REACTIONS: { key: ReactionKey; icon: string; tint?: boolean }[] = [
  { key: 'heart', icon: 'heart' }, { key: 'party', icon: 'party', tint: true }, { key: 'fire', icon: 'fire' },
  { key: 'star', icon: 'star' }, { key: 'hand', icon: 'hand', tint: true }
];
export const NAME_TONES = ['#E0A82E', '#E2594B', '#3E7BFA', '#2FA36B', '#7A5CD9', '#E0457A'];

/* ── The store ───────────────────────────────────────────────────────────── */
const ROOMS = 'mylo.rooms.list.v1';
const MSGS = 'mylo.rooms.messages.v1';
const RECENT = 'mylo.rooms.recent-stickers.v1';
type State = { rooms: Room[]; messages: Record<string, Message[]>; recent: StickerId[] };
const EMPTY: State = { rooms: [], messages: {}, recent: [] };
let state: State | null = null;
const listeners = new Set<() => void>();

function read<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
function get(): State {
  if (typeof window === 'undefined') return EMPTY;
  if (!state) state = { rooms: read(ROOMS, []), messages: read(MSGS, {}), recent: read(RECENT, []) };
  return state;
}
function write(next: Partial<State>) {
  state = { ...get(), ...next };
  try {
    if (next.rooms) localStorage.setItem(ROOMS, JSON.stringify(state.rooms));
    if (next.messages) localStorage.setItem(MSGS, JSON.stringify(state.messages));
    if (next.recent) localStorage.setItem(RECENT, JSON.stringify(state.recent));
  } catch { /* storage full or blocked: kept for this visit */ }
  listeners.forEach(l => l());
}
function subscribe(cb: () => void) {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => { if (e.key && e.key.startsWith('mylo.rooms.')) { state = null; cb(); } };
  window.addEventListener('storage', onStorage);
  return () => { listeners.delete(cb); window.removeEventListener('storage', onStorage); };
}

export function useRooms() {
  const s = useSyncExternalStore(subscribe, get, () => EMPTY);
  const ready = useSyncExternalStore(subscribe, () => true, () => false);
  return { ready, ...s };
}
export function useRoom(id: string) {
  const s = useRooms();
  const room = s.rooms.find(r => r.id === id);
  const all = s.messages[id] ?? [];
  const messages = visible(all, room);
  return { ready: s.ready, room, messages, all };
}

/* What I see: not hidden for me, not past the room's disappearing time. */
export function visible(list: Message[], room?: Room) {
  const ttl = room?.disappear === '24 hours' ? 864e5 : room?.disappear === '7 days' ? 6048e5 : 0;
  const now = Date.now();
  return list.filter(m => !m.hiddenFor?.includes(ME) && (!ttl || now - Date.parse(m.at) < ttl));
}

/* Your name as the profile has it, or "You" before there is one. */
export function myName() {
  try { const n = JSON.parse(localStorage.getItem('mylo.profile.v1') ?? '{}').name; if (n) return String(n); } catch { /* none */ }
  return 'You';
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function newCode(taken: Set<string>) {
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const c = Array.from(bytes, b => CODE_CHARS[b % CODE_CHARS.length]).join('');
    if (!taken.has(c)) return c;
  }
}
const uid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

export const rooms = {
  create(name: string) {
    const s = get();
    const now = new Date().toISOString();
    const room: Room = {
      id: uid(), name: name.trim(), about: '', code: newCode(new Set(s.rooms.map(r => r.code))), createdAt: now,
      cover: { kind: 'scene', scene: SCENES[s.rooms.length % SCENES.length].id },
      members: [{ id: ME, name: myName(), role: 'owner', joinedAt: now }], requests: [], capacity: 5,
      joinPolicy: 'Ask to join', findable: true, colour: CHAT_COLOURS[0], wallpaper: null,
      notify: 'All messages', muted: false, readReceipts: true, disappear: 'Off', pinned: []
    };
    write({ rooms: [room, ...s.rooms] });
    return room;
  },
  update(id: string, patch: Partial<Room> | ((r: Room) => Partial<Room>)) {
    const s = get();
    write({ rooms: s.rooms.map(r => r.id === id ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) } : r) });
  },
  /* Leaving is the last member going on this device, so the room goes too. */
  leave(id: string) {
    const s = get();
    const room = s.rooms.find(r => r.id === id);
    if (!room) return;
    const left = room.members.filter(m => m.id !== ME);
    if (left.length) { write({ rooms: s.rooms.map(r => r.id === id ? { ...r, members: left } : r) }); return; }
    const messages = { ...s.messages }; delete messages[id];
    write({ rooms: s.rooms.filter(r => r.id !== id), messages });
  },
  byCode(code: string) { return get().rooms.find(r => r.code === code.toUpperCase()); },
  setRequestDecision(id: string, requestId: string, letIn: boolean) {
    rooms.update(id, r => {
      const q = r.requests.find(x => x.id === requestId);
      const members = letIn && q ? [...r.members, { id: q.id, name: q.name, role: 'member' as Role, joinedAt: new Date().toISOString() }] : r.members;
      return { requests: r.requests.filter(x => x.id !== requestId), members };
    });
  },
  setRole(id: string, memberId: string, role: Role) {
    rooms.update(id, r => ({ members: r.members.map(m => m.id === memberId ? { ...m, role } : m) }));
  },
  remove(id: string, memberId: string) {
    rooms.update(id, r => ({ members: r.members.filter(m => m.id !== memberId) }));
  }
};

function setMsgs(roomId: string, fn: (list: Message[]) => Message[]) {
  const s = get();
  write({ messages: { ...s.messages, [roomId]: fn(s.messages[roomId] ?? []) } });
}
export const msgs = {
  send(roomId: string, m: Omit<Message, 'id' | 'roomId' | 'authorId' | 'authorName' | 'at'>) {
    const msg: Message = { id: uid(), roomId, authorId: ME, authorName: myName(), at: new Date().toISOString(), ...m };
    setMsgs(roomId, list => [...list, msg]);
    if (m.kind === 'sticker' && m.sticker) {
      const s = get(); write({ recent: [m.sticker, ...s.recent.filter(x => x !== m.sticker)].slice(0, 12) });
    }
    return msg;
  },
  edit(roomId: string, id: string, text: string) {
    setMsgs(roomId, list => list.map(m => m.id === id ? { ...m, text, editedAt: new Date().toISOString() } : m));
  },
  removeForEveryone(roomId: string, id: string) {
    setMsgs(roomId, list => list.map(m => m.id === id ? { id: m.id, roomId, authorId: m.authorId, authorName: m.authorName, at: m.at, kind: 'text', deleted: true } : m));
    rooms.update(roomId, r => ({ pinned: r.pinned.filter(p => p !== id) }));
  },
  removeForMe(roomId: string, id: string) {
    setMsgs(roomId, list => list.map(m => m.id === id ? { ...m, hiddenFor: [...(m.hiddenFor ?? []), ME] } : m));
  },
  react(roomId: string, id: string, key: ReactionKey) {
    setMsgs(roomId, list => list.map(m => {
      if (m.id !== id) return m;
      const r = { ...(m.reactions ?? {}) };
      const who = r[key] ?? [];
      r[key] = who.includes(ME) ? who.filter(x => x !== ME) : [...who, ME];
      if (!r[key]!.length) delete r[key];
      return { ...m, reactions: r };
    }));
  },
  vote(roomId: string, id: string, option: number) {
    setMsgs(roomId, list => list.map(m => {
      if (m.id !== id || !m.poll || Date.parse(m.poll.closesAt) < Date.now()) return m;
      const mine = m.poll.options[option].votes.includes(ME);
      return { ...m, poll: { ...m.poll, options: m.poll.options.map((o, i) => ({ ...o, votes: o.votes.filter(v => v !== ME).concat(i === option && !mine ? [ME] : []) })) } };
    }));
  },
  opened(roomId: string, id: string) {
    setMsgs(roomId, list => list.map(m => m.id === id && m.photo ? { ...m, photo: { ...m.photo, src: '', openedBy: [...m.photo.openedBy, ME] } } : m));
  },
  togglePin(roomId: string, id: string) {
    rooms.update(roomId, r => ({ pinned: r.pinned.includes(id) ? r.pinned.filter(p => p !== id) : [...r.pinned, id] }));
  }
};

/* Voice clips stay in memory for this visit: the recording is real, the blob
   URL is only good until the page goes. The message keeps its length and
   waveform so the chat still reads right after a reload. */
const clips = new Map<string, string>();
export const voiceClips = {
  put(blob: Blob) { const id = uid(); clips.set(id, URL.createObjectURL(blob)); return id; },
  get(id: string) { return clips.get(id); }
};

/* ── Little helpers the screens share ────────────────────────────────────── */
export const lastMessage = (list: Message[]) => [...visible(list)].reverse()[0];
export function preview(m: Message | undefined) {
  if (!m) return '';
  const who = m.authorId === ME ? 'You: ' : `${m.authorName}: `;
  if (m.deleted) return m.authorId === ME ? 'You deleted this' : `${m.authorName} deleted this message`;
  const body = m.kind === 'text' ? m.text : m.kind === 'sticker' ? `${sticker(m.sticker!).label} sticker`
    : m.kind === 'cheer' ? cheer(m.cheer!).label : m.kind === 'poll' ? `Poll · ${m.poll!.question}`
    : m.kind === 'voice' ? 'Voice note' : m.photo?.once ? 'View once' : 'Photo';
  return who + body;
}
/* 7:42, the way the bubbles stamp time. */
export const stamp = (iso: string) => {
  const d = new Date(iso); const h = d.getHours();
  return `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/* 4:12 PM today, Yesterday, Tue this week, 12 Nov before that: CT0's column. */
export function listTime(iso: string) {
  const d = new Date(iso); const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  if (diff === 0) return `${stamp(iso)} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export function dayLabel(iso: string) {
  const d = new Date(iso); const now = new Date();
  const day = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 864e5);
  return diff === 0 ? 'Today' : diff === 1 ? 'Yesterday' : d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}
export const people = (r: Room) => r.members.length === 1 ? 'Only you' : `${r.members.length} people`;
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
export function tone(name: string, list = AVATAR_COLOURS) {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return list[h % list.length];
}
export const isAdmin = (r: Room) => r.members.some(m => m.id === ME && m.role !== 'member');
export const isMember = (r: Room) => r.members.some(m => m.id === ME);
export const adminName = (r: Room) => { const o = r.members.find(m => m.role === 'owner') ?? r.members[0]; return o?.id === ME ? 'You' : o?.name ?? ''; };
export const joinLink = (r: Room) => `${typeof location === 'undefined' ? '' : location.origin}/rooms/join?code=${r.code}`;

/* Room streak: days in a row, up to today or yesterday, with a message in it. */
export function roomStreak(list: Message[]) {
  const days = new Set(list.filter(m => !m.deleted).map(m => new Date(m.at).toDateString()));
  const d = new Date();
  if (!days.has(d.toDateString())) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(d.toDateString())) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
export const inToday = (list: Message[]) => new Set(list.filter(m => new Date(m.at).toDateString() === new Date().toDateString()).map(m => m.authorId)).size;

/* Photos are kept small enough to live on the device: 1080 on the long side. */
export function shrinkPhoto(file: File, max = 1080): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.78));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read that photo')); };
    img.src = url;
  });
}
