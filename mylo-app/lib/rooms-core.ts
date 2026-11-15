/* Rooms: the shapes every rooms screen draws, the catalogues from the frames,
   and the small pure helpers they share. No storage and no network here:
   lib/rooms-remote.ts fills these shapes from Supabase, lib/rooms.ts is what
   the screens import.

   ME stands for the signed-in person wherever an id appears (members, message
   authors, poll votes), so a screen never needs to know the real user id. */

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
  /* A room I am not in, known only by its public face (Find a room, a code):
     name, picture, category and a head count. Its members are placeholders. */
  peek?: boolean;
};

export type ReactionKey = 'heart' | 'party' | 'fire' | 'star' | 'hand' | `sticker:${StickerId}`;
export type Message = {
  id: string; roomId: string; authorId: string; authorName: string; at: string;
  kind: 'text' | 'sticker' | 'cheer' | 'poll' | 'voice' | 'photo';
  text?: string;
  sticker?: StickerId;
  cheer?: CheerId;
  poll?: { question: string; options: { id?: string; label: string; votes: string[] }[]; closesAt: string };
  voice?: { clip: string; seconds: number; bars: number[] };
  photo?: { src: string; once: boolean; caption?: string; openedBy: string[] };
  replyTo?: string;
  /* What the reply quoted, as it was sent, for when that message is not loaded. */
  quote?: { id: string; authorId: string; text: string };
  editedAt?: string;
  deleted?: boolean;
  hiddenFor?: string[];
  reactions?: Partial<Record<ReactionKey, string[]>>;
  /* Still on its way to the server. */
  pending?: boolean;
  /* Names of the people who have read up to this message (my messages only). */
  seenBy?: string[];
};

/* What the server can carry today. Edits, reactions, disappearing messages,
   instant joins and colour room pictures have no table or RPC behind them,
   so their controls stay hidden until one exists. */
export const caps = { edit: false, react: false, disappear: false, joinPolicy: false, coverColour: false, cancelRequest: false } as const;

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

/* ── Little helpers the screens share ────────────────────────────────────── */

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

/* The current app lets you pull a message back for everyone for ten minutes
   after you sent it; after that it stands. */
export const DELETE_FOR_ALL_MS = 10 * 60 * 1000;
export const canDeleteForAll = (m: Message | null | undefined) =>
  !!m && m.authorId === ME && !m.deleted && !m.pending && Date.now() - Date.parse(m.at) < DELETE_FOR_ALL_MS;

/* One line for a quote or a reply bar. */
export function quoteText(m: Message) {
  if (m.deleted) return 'Deleted message';
  if (m.text) return m.text;
  return m.kind === 'sticker' ? `${sticker(m.sticker!).label} sticker` : m.kind === 'cheer' ? cheer(m.cheer!).label
    : m.kind === 'poll' ? m.poll!.question : m.kind === 'voice' ? 'Voice note' : m.photo?.once ? 'View once' : 'Photo';
}

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
export const isMember = (r: Room) => !r.peek && r.members.some(m => m.id === ME);
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

/* Photos are shrunk before they go: 1080 on the long side for the chat. */
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
