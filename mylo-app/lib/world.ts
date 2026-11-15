'use client';

import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useLocal } from './local';
import { iso, todayIso } from './dates';
import type { Item } from './store';

/* Mylo's world: the saved look, the house, the egg and pet, walks, photos
   and the app theme. Everything is the person's own and starts empty; keys,
   levels and chests are the server's to give, so nobody has any yet. */

export const KEYS = {
  look: 'mylo.world.look.v1',
  theme: 'mylo.world.theme.v1',
  chatTheme: 'mylo.world.chat-theme.v1',
  egg: 'mylo.world.egg.v1',
  house: 'mylo.world.house.v1',
  walks: 'mylo.world.walks.v1',
  photos: 'mylo.world.photos.v1',
  visits: 'mylo.world.visits.v1'
} as const;

/* ── The look ──────────────────────────────────────────────────────────── */

export type Colour = { id: string; label: string; body: string; shade: string; locked?: boolean };
export const COLOURS: Colour[] = [
  { id: 'cloud', label: 'Cloud', body: '#FFFFFF', shade: '#E5E8F0' },
  { id: 'peach', label: 'Peach', body: '#FFE0D1', shade: '#F2B79F' },
  { id: 'butter', label: 'Butter', body: '#FFF2C2', shade: '#EED58A' },
  { id: 'mint', label: 'Mint', body: '#D6F5E8', shade: '#A9DFC8' },
  { id: 'sky', label: 'Sky', body: '#D8E9FF', shade: '#A9C8F2' },
  { id: 'lilac', label: 'Lilac', body: '#E9E0FF', shade: '#C3B2F2' },
  { id: 'blush', label: 'Blush', body: '#FFDCE8', shade: '#F2A9C3' },
  { id: 'sage', label: 'Sage', body: '#E3ECD3', shade: '#BCCB9F' },
  { id: 'sand', label: 'Sand', body: '#F3E7D7', shade: '#D9C2A3' },
  { id: 'gold', label: 'Gold', body: '#FFE9A8', shade: '#E8B84A', locked: true }
];

/* The twelve expressions of the "Mylo" component set, in M2's order. */
export const FACES = ['smile', 'happy', 'laugh', 'wink', 'love', 'starry', 'wow', 'calm', 'focused', 'proud', 'sleepy', 'sad'] as const;
export type Face = typeof FACES[number];

/* "Mylo/Outfit" pieces: each drawn on Mylo's 300 x 360 box, some reaching
   past its top or right edge (w, h are their own drawing's size). */
export const WEAR: Record<string, { w: number; h: number }> = {
  beanie: { w: 300, h: 360 }, bow: { w: 300, h: 360 }, builder: { w: 300, h: 360 }, cap: { w: 307, h: 360 },
  chef: { w: 300, h: 376 }, crown: { w: 300, h: 360 }, flowers: { w: 300, h: 360 }, glasses: { w: 300, h: 360 },
  graduate: { w: 300, h: 360 }, headphones: { w: 300, h: 360 }, nightcap: { w: 306, h: 360 }, party: { w: 300, h: 405 },
  scarf: { w: 300, h: 360 }, shades: { w: 300, h: 360 }, sporty: { w: 300, h: 360 }, wizard: { w: 316, h: 460 }
};
export type Piece = { id: string; label: string; locked?: boolean };
/* M3, in order; the first tile is Mylo with nothing on. */
export const OUTFITS: (Piece | null)[] = [
  null,
  { id: 'beanie', label: 'Beanie' }, { id: 'cap', label: 'Cap' }, { id: 'headphones', label: 'Headphones' },
  { id: 'chef', label: 'Chef' }, { id: 'builder', label: 'Builder' }, { id: 'sporty', label: 'Sporty' },
  { id: 'party', label: 'Party' }, { id: 'graduate', label: 'Graduate', locked: true }, { id: 'nightcap', label: 'Nightcap' },
  { id: 'wizard', label: 'Wizard', locked: true }, { id: 'crown', label: 'Crown', locked: true }
];
/* M4: glasses, scarves, flowers. More than one can be on. */
export const EXTRAS: Piece[] = [
  { id: 'glasses', label: 'Glasses' }, { id: 'shades', label: 'Shades' }, { id: 'scarf', label: 'Scarf' },
  { id: 'bow', label: 'Bow' }, { id: 'flowers', label: 'Flowers' }, { id: 'headphones', label: 'Headphones' },
  { id: 'party', label: 'Party', locked: true }, { id: 'crown', label: 'Crown', locked: true }
];
/* M5's stage backgrounds. */
export const SCENES = [
  { id: 'cloud', label: 'Cloud', from: '#ECECF1', to: '#F5F5F7' },
  { id: 'dawn', label: 'Dawn', from: '#FDF3EC', to: '#FFE9DD' },
  { id: 'mint', label: 'Mint', from: '#F1FBF6', to: '#DDF5EA' },
  { id: 'sky', label: 'Sky', from: '#F1F7FF', to: '#DCEBFF' },
  { id: 'dusk', label: 'Dusk', from: '#F7F3FF', to: '#E9E1FF' },
  { id: 'night', label: 'Night', from: '#2B2B3D', to: '#1C1C27' }
] as const;

/* Mylo style (MS1, MS2, MS4). Rarity sets the dot and the collection shelf. */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'special';
export const RARITY: Record<Rarity, { label: string; color: string }> = {
  legendary: { label: 'Legendary', color: '#D99A1E' },
  epic: { label: 'Epic', color: '#7A5CD9' },
  rare: { label: 'Rare', color: '#3E7BFA' },
  common: { label: 'Common', color: '#8E95A6' },
  special: { label: 'Special', color: '#2FA36B' }
};
export type Backdrop = { id: string; label: string; rarity: Rarity; from?: string; hero?: string };
/* `from` is where a locked one comes from, as its card says. */
export const BACKDROPS: Backdrop[] = [
  { id: 'sunrise', label: 'Sunrise', rarity: 'common' },
  { id: 'sky', label: 'Sky', rarity: 'common', hero: 'hero-sky' },
  { id: 'forest', label: 'Forest', rarity: 'common' },
  { id: 'beach', label: 'Beach', rarity: 'rare' },
  { id: 'city', label: 'City night', rarity: 'rare', hero: 'hero-city' },
  { id: 'snow', label: 'Snow', rarity: 'rare', from: 'Silver chest, wk 3' },
  { id: 'space', label: 'Space', rarity: 'epic' },
  { id: 'aurora', label: 'Aurora', rarity: 'epic', from: 'Gold chest, wk 4' },
  { id: 'golden', label: 'Golden hour', rarity: 'legendary', from: 'Gold chest, very rare' }
];
export type Style = { id: string; label: string; rarity: Rarity; from?: string; art: string };
export const STYLES: Style[] = [
  { id: 'gala', label: 'Gala Night', rarity: 'epic', art: 'gala' },
  { id: 'studio', label: 'Studio Vibes', rarity: 'rare', art: 'studio' },
  { id: 'winter', label: 'Winter Cozy', rarity: 'common', art: 'winter' },
  { id: 'party', label: 'Party Host', rarity: 'epic', art: 'party' },
  { id: 'queen', label: 'Mylo Queen', rarity: 'legendary', art: 'queen' },
  { id: 'space-cadet', label: 'Space Cadet', rarity: 'legendary', from: 'Gold chest, wk 4', art: 'plain' },
  { id: 'galaxy', label: 'Galaxy Drip', rarity: 'epic', from: 'Gold chest, wk 4', art: 'plain' },
  { id: 'birthday', label: 'Birthday Bash', rarity: 'special', from: 'Your birthday week only', art: 'plain' },
  { id: 'ballet', label: 'Ballet Day', rarity: 'rare', art: 'ballet' }
];

export type Look = {
  name: string;
  colour: string;
  face: Face;
  outfit: string | null;
  extras: string[];
  scene: string;
  shine: boolean;
  backdrop: string;
  style: string | null;
};
/* The Mylo everyone meets first: white, calm smile, nothing on. */
export const DEFAULT_LOOK: Look = {
  name: 'Mylo', colour: 'cloud', face: 'smile', outfit: null, extras: [], scene: 'cloud', shine: true, backdrop: 'sky', style: null
};

export function useLook() {
  const [look, setLook] = useLocal<Look>(KEYS.look, DEFAULT_LOOK);
  return [{ ...DEFAULT_LOOK, ...look }, setLook] as const;
}

const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];
export function shuffleLook(look: Look): Look {
  const outfit = pick(OUTFITS.filter(o => !o?.locked));
  const extras = EXTRAS.filter(e => !e.locked && e.id !== outfit?.id);
  return {
    ...look,
    colour: pick(COLOURS.filter(c => !c.locked)).id,
    face: pick([...FACES]),
    outfit: outfit?.id ?? null,
    extras: Math.random() < 0.5 ? [pick(extras).id] : [],
    style: null
  };
}

/* ── App theme (T3) ────────────────────────────────────────────────────── */

export type ThemeChoice = 'system' | 'light' | 'dark';
export function stampTheme(t: ThemeChoice) {
  const root = document.documentElement;
  if (t === 'light' || t === 'dark') root.dataset.theme = t;
  else delete root.dataset.theme;
}
export function useTheme() {
  const [theme, setTheme] = useLocal<ThemeChoice>(KEYS.theme, 'system');
  const set = useCallback((t: ThemeChoice) => { setTheme(t); stampTheme(t); }, [setTheme]);
  return [theme, set] as const;
}
/* Keeps a stored choice stamped on every world screen, even before the
   shared layout learns to do it before the first paint. */
export function useStampedTheme() {
  useEffect(() => {
    try {
      const t = JSON.parse(localStorage.getItem(KEYS.theme) ?? 'null');
      if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
    } catch { /* storage blocked */ }
  }, []);
}
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
export function usePhoneIsDark() {
  return useSyncExternalStore(
    cb => { const m = media(); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => media().matches, () => false
  );
}

/* ── Egg and pet (EG1, EG2, PT2) ───────────────────────────────────────── */

export type Egg = { foundOn: string | null; named?: string };
export const HATCH_DAYS = 5;
/* Active days are days something got ticked, from the day the egg was kept
   warm. Missed days pause it; they never take a day back. */
export function activeDays(items: Item[], since: string | null) {
  if (!since) return { days: 0, today: false };
  const days = new Set(items.filter(i => i.done && i.doneAt).map(i => iso(new Date(i.doneAt!))).filter(d => d >= since));
  return { days: days.size, today: days.has(todayIso()) };
}

/* ── House (H1 to H7) ──────────────────────────────────────────────────── */

export type RoomId = 'bedroom' | 'photo' | 'kitchen' | 'living' | 'gym' | 'garden';
export const ROOMS: { id: RoomId; label: string; art: string; sub: string }[] = [
  { id: 'bedroom', label: 'Bedroom', art: 'bedroom', sub: 'Sleep streak' },
  { id: 'photo', label: 'Photo studio', art: 'photo-locked', sub: 'Shared win needed' },
  { id: 'kitchen', label: 'Kitchen', art: 'kitchen', sub: 'Cook together' },
  { id: 'living', label: 'Living room', art: 'living-day', sub: 'Treats to claim' },
  { id: 'gym', label: 'Gym', art: 'gym', sub: 'Workout day' },
  { id: 'garden', label: 'Garden', art: 'garden', sub: 'Walk 20 min' }
];
export const ROOM_STYLES = [
  { id: 'classic', label: 'Classic', art: 'bedroom' },
  { id: 'cozy', label: 'Cozy pink', short: 'Cozy', art: 'cozy', pitch: 'Pink walls, fairy lights and a teddy for Mylo.', keys: 1 },
  { id: 'gamer', label: 'Gamer', short: 'Gamer', art: 'gamer', keys: 1 },
  { id: 'summer', label: 'Summer', art: 'beach', season: true }
] as const;
export type House = { here: RoomId; bedroom: string; owned: string[]; flipped: boolean; keys: number; treats: { id: string; title: string; at: string }[] };
export const DEFAULT_HOUSE: House = { here: 'bedroom', bedroom: 'classic', owned: ['classic'], flipped: false, keys: 0, treats: [] };
export function useHouse() {
  const [house, setHouse] = useLocal<House>(KEYS.house, DEFAULT_HOUSE);
  return [{ ...DEFAULT_HOUSE, ...house }, setHouse] as const;
}
export const roomArt = (house: House, id: RoomId) =>
  id === 'bedroom' ? (ROOM_STYLES.find(s => s.id === house.bedroom)?.art ?? 'bedroom') : ROOMS.find(r => r.id === id)!.art;

/* Furniture in H5. Owned pieces came with the room; the others say how
   they are earned. */
export const DECOR: Record<string, { id: string; label: string; icon: string; tint: string; color: string; owned?: boolean; need?: string }[]> = {
  Furniture: [
    { id: 'bed', label: 'Bed', icon: 'home', tint: 'var(--tint-amber)', color: 'var(--amber)', owned: true },
    { id: 'beanbag', label: 'Bean bag', icon: 'circle', tint: 'var(--w-tint-purple)', color: '#7A5CD9', owned: true },
    { id: 'bookshelf', label: 'Bookshelf', icon: 'book', tint: 'var(--tint-blue)', color: 'var(--blue)', owned: true },
    { id: 'neon', label: 'Neon sign', icon: 'sparkle', tint: 'var(--tint-red)', color: 'var(--red)', need: 'Badge: 7 days' },
    { id: 'fairy', label: 'Fairy lights', icon: 'sun', tint: 'var(--tint-amber)', color: 'var(--amber)', need: 'Level Kindle' },
    { id: 'arcade', label: 'Arcade', icon: 'games', tint: 'var(--tint-green)', color: 'var(--green)', need: '1 key' }
  ],
  Walls: [], Floor: [], Lights: [], Plants: []
};

/* ── Garden walks (H4) ─────────────────────────────────────────────────── */

export type Walks = { days: Record<string, number>; startedAt: string | null };
export const WALK_GOAL = 20;
export function useWalks() {
  const [walks, setWalks] = useLocal<Walks>(KEYS.walks, { days: {}, startedAt: null });
  return [walks, setWalks] as const;
}

/* ── Photos (PH1 to PH5) ───────────────────────────────────────────────── */

export const PHOTO_BGS = [
  { id: 'bedroom', label: 'Your bedroom', art: 'bedroom' },
  { id: 'gym', label: 'Gym', art: 'gym' },
  { id: 'studio', label: 'Studio', art: 'studio' },
  { id: 'garden', label: 'Garden', art: 'garden' },
  { id: 'summer', label: 'Summer', art: 'beach' }
] as const;
export const POSES = ['Side by side', 'Lean in', 'Jump', 'Silly'] as const;
export const MOODS: { label: string; face: Face }[] = [
  { label: 'Excited', face: 'laugh' }, { label: 'Happy', face: 'happy' }, { label: 'Proud', face: 'proud' }, { label: 'Love', face: 'love' }
];
export type Photo = { id: string; bg: string; pose: string; face: Face; look: Look; at: string; title: string; frame: string };
export function usePhotos() {
  return useLocal<Photo[]>(KEYS.photos, []);
}

/* ── Visits (K1 to K8) ─────────────────────────────────────────────────── */

/* A visit needs a friend on the other side. Friends come from the social
   area and the server; until there are some, every list here is empty. */
export type Visit = {
  id: string; friend: string; status: 'knocking' | 'invited' | 'over' | 'ended';
  activity: string; when: string; startedAt?: string; endedAt?: string; messages: number; note?: string;
};
export function useVisits() {
  return useLocal<Visit[]>(KEYS.visits, []);
}
export const ACTIVITIES = [
  { id: 'movie', label: 'Movie night', room: 'living' as RoomId, art: 'living-night-photo' },
  { id: 'study', label: 'Study together', room: 'bedroom' as RoomId, art: 'bedroom' },
  { id: 'workout', label: 'Workout', room: 'gym' as RoomId, art: 'gym' },
  { id: 'chill', label: 'Chill outside', room: 'garden' as RoomId, art: 'garden' }
];
