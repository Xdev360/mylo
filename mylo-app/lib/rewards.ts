'use client';

import { useCallback, useMemo } from 'react';
import { addDays, fromIso, iso, thisWeek } from './dates';
import { useLocal, useHydrated } from './local';
import { streak, useStore, type Item } from './store';

/* Rewards: levels, cards, the Sunday chest, keys, shards, eggs and pets,
   badges and the streak, from the Figma "Rewards" frames (U, L, XT, SH).

   XP and levels are the server's to decide (handoff rule). There is no XP
   server yet, so everyone is at the start: Spark, 0 XP. `useXp()` is the one
   place that answer comes from.

   Keys and the chest follow the rule the frames spell out, worked from the
   person's real ticks: a day with at least one thing ticked on Today is an
   active day; 5 active days in a Monday-to-Sunday week earn 1 key; the chest
   opens on Sunday with a key. Weeks of showing up in a row raise the chest:
   Wood in weeks 1 and 2, Silver in week 3, Gold from week 4. A missed week
   drops it one level; nothing owned is lost. What the chest gives is kept on
   the device under mylo.rewards.state.v1 until the server takes it over. */

/* ── Levels (L7) ─────────────────────────────────────────────────────────── */
export type Level = { id: string; name: string; xp: number; perk: string; glow: string };
export const LEVELS: Level[] = [
  { id: 'spark', name: 'Spark', xp: 0, perk: 'Where everyone starts', glow: 'rgba(217,169,63,.28)' },
  { id: 'ember', name: 'Ember', xp: 500, perk: '5 quick to-dos', glow: 'rgba(224,160,90,.28)' },
  { id: 'kindle', name: 'Kindle', xp: 1500, perk: '8 quick to-dos · Beanie', glow: 'rgba(224,138,60,.28)' },
  { id: 'flame', name: 'Flame', xp: 3500, perk: '8 quick to-dos · Graduate hat', glow: 'rgba(249,115,22,.28)' },
  { id: 'blaze', name: 'Blaze', xp: 7000, perk: '12 quick to-dos · Gold Mylo', glow: 'rgba(239,91,76,.28)' },
  { id: 'beacon', name: 'Beacon', xp: 12000, perk: '12 quick to-dos · Crown', glow: 'rgba(236,72,153,.28)' },
  { id: 'wildfire', name: 'Wildfire', xp: 20000, perk: '20 quick to-dos · Wizard hat', glow: 'rgba(168,85,247,.28)' },
  { id: 'supernova', name: 'Supernova', xp: 32000, perk: 'Unlimited · Supernova wings', glow: 'rgba(91,106,191,.28)' }
];
/* What reaching a level opens, where the frames say it (L1). */
export const OPENS: Record<string, string> = { flame: 'Flame opens Games and Challenges' };

/* The server's answer. Until there is one, a new account is at the start. */
export function useXp() {
  return 0;
}
export function levelOf(xp: number) {
  let i = 0;
  LEVELS.forEach((l, n) => { if (xp >= l.xp) i = n; });
  const level = LEVELS[i];
  const next = LEVELS[i + 1] ?? null;
  const pct = next ? Math.max(0, Math.min(1, (xp - level.xp) / (next.xp - level.xp))) : 1;
  return { index: i, number: i + 1, level, next, pct };
}
export const num = (n: number) => n.toLocaleString('en-GB');
export const levelArt = (id: string, earned = true) => `/figma/rewards/level-${id}${earned ? '' : '-locked'}.svg`;

/* ── Cards (U2, U3, XT3 to XT6, U12) ─────────────────────────────────────── */
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export const RARITY: Record<Rarity, {
  label: string; chip: string; pill: string; frame: string; stars: number;
  stage: string; glow: string; tint: string; tintDark: string;
}> = {
  common: { label: 'Common', chip: 'Common', pill: '#8E95A6', frame: 'linear-gradient(160deg,#F4F6FA,#C3C9D6 55%,#9AA2B4)', stars: 1,
    stage: 'linear-gradient(180deg,#232733,#3F4656)', glow: 'rgba(195,201,214,.45)', tint: '#F5F5F7', tintDark: '#1F1F23' },
  rare: { label: 'Rare', chip: 'Rare', pill: '#3E7BFA', frame: 'linear-gradient(160deg,#BFD8FF,#5B8EF0 55%,#2F5FD0)', stars: 2,
    stage: 'linear-gradient(180deg,#12234A,#2C4A8C)', glow: 'rgba(127,180,255,.5)', tint: '#EAF1FF', tintDark: '#16213A' },
  epic: { label: 'Epic', chip: 'Epic', pill: '#7A5CD9', frame: 'linear-gradient(160deg,#E4D4FF,#9B6BF0 55%,#5A2DC0)', stars: 3,
    stage: 'linear-gradient(180deg,#2A1846,#4A2A7A)', glow: 'rgba(183,155,255,.5)', tint: '#F1EAFE', tintDark: '#221A36' },
  legendary: { label: 'Legendary', chip: 'Legend', pill: '#D99A1E', frame: 'linear-gradient(160deg,#FFF1B8,#F5C64A 55%,#B97A12)', stars: 4,
    stage: 'linear-gradient(180deg,#2A1A04,#4E3208)', glow: 'rgba(255,210,63,.4)', tint: '#FEF4E2', tintDark: '#2A2214' }
};
export const RARITIES: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export type Card = { id: string; no: number; name: string; desc: string; rarity: Rarity; source: string };
export const CARDS: Card[] = [
  { id: 'winter-cozy', no: 1, name: 'Winter Cozy', desc: 'Cable knit sweater, wool beanie', rarity: 'common', source: 'From any chest' },
  { id: 'morning-run', no: 2, name: 'Morning Run', desc: 'Track jacket, sweatband', rarity: 'common', source: 'From any chest' },
  { id: 'pink-pilates', no: 3, name: 'Pink Pilates', desc: 'Pink sports top, hair bun', rarity: 'common', source: 'From any chest' },
  { id: 'sunday-bow', no: 5, name: 'Sunday Bow', desc: 'Polka dot dress, big pink bow', rarity: 'common', source: 'From any chest' },
  { id: 'studio-vibes', no: 11, name: 'Studio Vibes', desc: 'Bomber jacket, studio headphones', rarity: 'rare', source: 'Silver or Gold chest, from week 3' },
  { id: 'ballet-day', no: 14, name: 'Ballet Day', desc: 'Leotard, tutu, ballet bun', rarity: 'rare', source: 'Silver or Gold chest, from week 3' },
  { id: 'gala-night', no: 19, name: 'Gala Night', desc: 'Sequin evening gown, pearl earrings, sleek bun', rarity: 'epic', source: 'Gold chest, from week 4' },
  { id: 'mylo-queen', no: 25, name: 'Mylo Queen', desc: 'Sequin dress, fur collar, tiara', rarity: 'legendary', source: 'Gold chest, from week 4. Very rare' }
];
export const CARD_TOTAL = 30;
export const cardById = (id: string) => CARDS.find(c => c.id === id) ?? null;
export const cardArt = (id: string) => `/figma/rewards/card-${id}.svg`;
export const cardNo = (c: Card) => `${String(c.no).padStart(3, '0')} / ${String(CARD_TOTAL).padStart(3, '0')}`;
export const SHARDS_FOR_CARD = 5;
export const LEGENDARY_WITHIN = 20;

/* ── Chests ──────────────────────────────────────────────────────────────── */
export type Tier = 'wood' | 'silver' | 'gold';
export const TIERS: Record<Tier, { name: string; week: string }> = {
  wood: { name: 'Wood', week: 'Now' },
  silver: { name: 'Silver', week: 'Week 3' },
  gold: { name: 'Gold', week: 'Week 4' }
};
export const tierOf = (weekNo: number): Tier => (weekNo >= 4 ? 'gold' : weekNo === 3 ? 'silver' : 'wood');
const RANK: Record<Tier, number> = { wood: 0, silver: 1, gold: 2 };
export const chestArt = (t: Tier) => `/figma/rewards/chest-${t}.svg`;
/* What each chest can hold, for the odds chips (DT10). */
export const CHEST_HOLDS: Record<Tier, Rarity[]> = { wood: ['common'], silver: ['common', 'rare'], gold: ['rare', 'epic', 'legendary'] };

/* ── Eggs and pets (U7, U8, XT8) ─────────────────────────────────────────── */
export type EggKind = 'purple-galaxy' | 'orange-sunset';
export const EGGS: Record<EggKind, { name: string; hatches: PetKind[] }> = {
  'purple-galaxy': { name: 'Purple Galaxy egg', hatches: ['zap-galaxy', 'momo-galaxy'] },
  'orange-sunset': { name: 'Orange Sunset egg', hatches: ['pip-tiger', 'zap-mint'] }
};
export type PetKind = 'pip-tiger' | 'momo-galaxy' | 'zap-mint' | 'zap-galaxy';
export const PETS: Record<PetKind, { name: string }> = {
  'pip-tiger': { name: 'Pip · Tiger' },
  'momo-galaxy': { name: 'Momo · Galaxy' },
  'zap-mint': { name: 'Zap · Mint' },
  'zap-galaxy': { name: 'Zap · Galaxy' }
};
export const eggArt = (k: EggKind) => `/figma/rewards/egg-${k}.svg`;
export const petArt = (k: PetKind) => `/figma/rewards/pet-${k}.svg`;
export const HATCH_DAYS = 5;
export const BASKET = 3;
export const PET_HOUSE = 6;

/* ── Badges (L3, L4, L8) ─────────────────────────────────────────────────── */
export type BadgeId = 'streak_3' | 'streak_7' | 'first_goal' | 'room_duo' | 'streak_14' | 'goals_25' | 'streak_21' | 'streak_30';
export type Badge = { id: BadgeId; name: string; title: string; line?: string; share?: string; days?: number; goals?: number; glow: string };
export const BADGES: Badge[] = [
  { id: 'streak_3', name: '3 Day Streak', title: '3 Day Streak', days: 3, share: '3 days in a row', glow: 'rgba(233,184,36,.28)' },
  { id: 'streak_7', name: 'Showing Up', title: 'Queen of Showing Up', line: 'Seven days, locked in', days: 7, share: '7 days in a row', glow: 'rgba(255,107,157,.28)' },
  { id: 'first_goal', name: 'First Win', title: 'First Win', goals: 1, glow: 'rgba(45,212,191,.28)' },
  { id: 'room_duo', name: 'Better Together', title: 'Better Together', glow: 'rgba(244,114,182,.28)' },
  { id: 'streak_14', name: 'Two Weeks', title: 'Two Weeks Locked In', line: 'Fourteen days straight.', days: 14, share: '14 days in a row', glow: 'rgba(255,138,91,.28)' },
  { id: 'goals_25', name: '25 Goals', title: '25 Goals', goals: 25, glow: 'rgba(59,130,246,.28)' },
  { id: 'streak_21', name: '21-Day Flame', title: '21-Day Flame', days: 21, share: '21 days in a row', glow: 'rgba(167,139,250,.28)' },
  { id: 'streak_30', name: 'Perfect Month', title: 'Perfect Month', days: 30, share: '30 days in a row', glow: 'rgba(139,92,246,.28)' }
];
export const badgeById = (id: string) => BADGES.find(b => b.id === id) ?? null;
export const badgeArt = (id: string, earned = true) => `/figma/rewards/badge-${id}${earned ? '' : '-locked'}.svg`;

/* ── App icons (XT2) ─────────────────────────────────────────────────────── */
export const APP_ICONS = [
  { id: 'violet', name: 'Violet', level: 0 },
  { id: 'sunrise', name: 'Sunrise', level: 2 },
  { id: 'night', name: 'Night', level: 3 },
  { id: 'mint', name: 'Mint', level: 4 }
];

/* ── Active days, streaks, weeks ─────────────────────────────────────────── */
export const mondayOf = (d: Date) => iso(addDays(d, -((d.getDay() + 6) % 7)));

export function activeDays(items: Item[]) {
  return new Set(items.filter(i => i.done && i.doneAt).map(i => iso(new Date(i.doneAt!))));
}

/* Longest run of active days in a row, and the day each run length was first
   reached (for badge dates). */
export function runs(days: Set<string>) {
  const sorted = [...days].sort();
  let best = 0; let cur = 0; let prev: string | null = null;
  const reached: Record<number, string> = {};
  for (const d of sorted) {
    cur = prev && iso(addDays(fromIso(prev), 1)) === d ? cur + 1 : 1;
    if (cur > best) best = cur;
    if (!reached[cur]) reached[cur] = d;
    prev = d;
  }
  return { best, reached };
}

export type Week = {
  monday: string;
  days: boolean[];        // Monday to Sunday, this week
  count: number;          // active days this week
  toKey: number;          // days still needed for this week's key
  keysEarned: number;     // every key ever earned, this week included
  weekNo: number;         // this week's number in the run of weeks showing up
  tier: Tier;             // this week's chest
  dropped: boolean;       // last week was missed and the chest fell a level
  isSunday: boolean;
};

export function weekOf(days: Set<string>, now = new Date()): Week {
  const monday = mondayOf(now);
  const week = thisWeek(now).map(d => days.has(iso(d)));
  const count = week.filter(Boolean).length;
  const first = [...days].sort()[0];
  let run = 0; let keysEarned = 0; let dropped = false;
  if (first) {
    for (let m = fromIso(mondayOf(fromIso(first))); iso(m) < monday; m = addDays(m, 7)) {
      let n = 0; for (let i = 0; i < 7; i++) if (days.has(iso(addDays(m, i)))) n++;
      if (n >= 5) { run++; keysEarned++; dropped = false; }
      else {
        const before = tierOf(run + 1);
        run = run >= 3 ? 2 : run === 2 ? 1 : 0;
        dropped = RANK[before] > RANK[tierOf(run + 1)];
      }
    }
  }
  if (count >= 5) keysEarned++;
  const weekNo = run + 1;
  return { monday, days: week, count, toKey: Math.max(0, 5 - count), keysEarned, weekNo, tier: tierOf(weekNo), dropped, isSunday: now.getDay() === 0 };
}

/* ── What the chest has given, kept on the device ────────────────────────── */
export type Opened = { week: string; tier: Tier; card: string; dup: boolean; egg?: EggKind; at: string; seen: boolean };
export type Pet = { id: string; kind: PetKind; name?: string; at: string };
export type Egg = { id: string; kind: EggKind; at: string };
export type Gift = { card: string; to: string; note: string; at: string };
export type RewardsState = {
  opened: Opened[];
  cards: Record<string, number>;
  shards: number;
  goldSinceLegendary: number;
  goldOpened: number;
  eggs: Egg[];
  nest: (Egg & { since: string }) | null;
  hatched: string | null;           // a pet id waiting to be greeted (XT8)
  pets: Pet[];
  out: string | null;
  wearing: string | null;
  gifts: Gift[];
  pinned: string | null;
  seenBadges: string[];
  appIcon: string;
  lastLevel: number;
};
export const EMPTY_REWARDS: RewardsState = {
  opened: [], cards: {}, shards: 0, goldSinceLegendary: 0, goldOpened: 0, eggs: [], nest: null, hatched: null,
  pets: [], out: null, wearing: null, gifts: [], pinned: null, seenBadges: [], appIcon: 'violet', lastLevel: 1
};
const KEY = 'mylo.rewards.state.v1';
const uid = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(Math.random()).slice(2));
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

function rollRarity(tier: Tier, goldSince: number): Rarity {
  const r = Math.random();
  if (tier === 'wood') return 'common';
  if (tier === 'silver') return r < 0.3 ? 'rare' : 'common';
  if (goldSince + 1 >= LEGENDARY_WITHIN || r < 0.025) return 'legendary';
  return r < 0.025 + 1 / 8 ? 'epic' : 'rare';
}

export type BadgeState = Badge & { earned: boolean; at?: string; left: number };

/* Everything the rewards screens read, and what they can do. */
export function useRewards() {
  const { items, ready } = useStore();
  const hydrated = useHydrated();
  const [state, setState] = useLocal<RewardsState>(KEY, EMPTY_REWARDS);
  const s: RewardsState = useMemo(() => ({ ...EMPTY_REWARDS, ...state }), [state]);
  const xp = useXp();

  const derived = useMemo(() => {
    const now = new Date();
    const days = activeDays(items);
    const week = weekOf(days, now);
    const keys = Math.max(0, week.keysEarned - s.opened.length);
    const openedThisWeek = s.opened.find(o => o.week === week.monday) ?? null;
    const canOpen = week.isSunday && keys >= 1 && !openedThisWeek;
    const owned = CARDS.filter(c => (s.cards[c.id] ?? 0) > 0);
    const { best, reached } = runs(days);
    const doneGoals = items.filter(i => i.kind === 'goal' && i.done && i.doneAt).sort((a, b) => a.doneAt!.localeCompare(b.doneAt!));
    const current = streak(items);
    const badges: BadgeState[] = BADGES.map(b => {
      if (b.days) return { ...b, earned: best >= b.days, at: reached[b.days], left: Math.max(0, b.days - current) };
      if (b.goals) { const g = doneGoals[b.goals - 1]; return { ...b, earned: !!g, at: g ? iso(new Date(g.doneAt!)) : undefined, left: Math.max(0, b.goals - doneGoals.length) }; }
      return { ...b, earned: false, left: 0 };
    });
    const nestDays = s.nest ? [...days].filter(d => d >= s.nest!.since).length : 0;
    return { now, days, week, keys, openedThisWeek, canOpen, owned, best, current, badges, nestDays, level: levelOf(xp) };
  }, [items, s, xp]);

  const set = setState;

  /* Open this week's chest with a key. Returns the record it made. */
  const openChest = useCallback((): Opened | null => {
    if (!derived.canOpen) return null;
    const tier = derived.week.tier;
    const rarity = rollRarity(tier, s.goldSinceLegendary);
    const card = pick(CARDS.filter(c => c.rarity === rarity));
    const have = s.cards[card.id] ?? 0;
    const dup = have > 0 && rarity === 'common';
    const egg: EggKind | undefined = tier === 'gold' && Math.random() < 0.5 && s.eggs.length < BASKET ? pick(Object.keys(EGGS) as EggKind[]) : undefined;
    const rec: Opened = { week: derived.week.monday, tier, card: card.id, dup, egg, at: new Date().toISOString(), seen: false };
    set(p => {
      const q = { ...EMPTY_REWARDS, ...p };
      return {
        ...q,
        opened: [...q.opened, rec],
        cards: dup ? q.cards : { ...q.cards, [card.id]: (q.cards[card.id] ?? 0) + 1 },
        shards: dup ? q.shards + 1 : q.shards,
        goldOpened: q.goldOpened + (tier === 'gold' ? 1 : 0),
        goldSinceLegendary: tier !== 'gold' ? q.goldSinceLegendary : rarity === 'legendary' ? 0 : q.goldSinceLegendary + 1,
        eggs: egg ? [...q.eggs, { id: uid(), kind: egg, at: new Date().toISOString() }] : q.eggs
      };
    });
    return rec;
  }, [derived, s, set]);

  const seeResult = useCallback(() => set(p => ({ ...EMPTY_REWARDS, ...p, opened: p.opened.map(o => ({ ...o, seen: true })) })), [set]);
  const wear = useCallback((id: string | null) => set(p => ({ ...EMPTY_REWARDS, ...p, wearing: id })), [set]);
  const spendShards = useCallback((id: string) => set(p => {
    const q = { ...EMPTY_REWARDS, ...p };
    if (q.shards < SHARDS_FOR_CARD) return q;
    return { ...q, shards: q.shards - SHARDS_FOR_CARD, cards: { ...q.cards, [id]: (q.cards[id] ?? 0) + 1 } };
  }), [set]);
  const sendGift = useCallback((card: string, to: string, note: string) => set(p => {
    const q = { ...EMPTY_REWARDS, ...p };
    if ((q.cards[card] ?? 0) < 2) return q;
    return { ...q, cards: { ...q.cards, [card]: q.cards[card] - 1 }, gifts: [...q.gifts, { card, to, note, at: new Date().toISOString() }] };
  }), [set]);
  const placeEgg = useCallback((id: string) => set(p => {
    const q = { ...EMPTY_REWARDS, ...p };
    const egg = q.eggs.find(e => e.id === id);
    if (!egg || q.nest) return q;
    return { ...q, eggs: q.eggs.filter(e => e.id !== id), nest: { ...egg, since: iso(new Date()) } };
  }), [set]);
  const hatch = useCallback(() => set(p => {
    const q = { ...EMPTY_REWARDS, ...p };
    if (!q.nest) return q;
    const pet: Pet = { id: uid(), kind: pick(EGGS[q.nest.kind].hatches), at: new Date().toISOString() };
    return { ...q, nest: null, hatched: pet.id, pets: [...q.pets, pet], out: q.out ?? pet.id };
  }), [set]);
  const greet = useCallback(() => set(p => ({ ...EMPTY_REWARDS, ...p, hatched: null })), [set]);
  const namePet = useCallback((id: string, name: string) => set(p => ({ ...EMPTY_REWARDS, ...p, pets: p.pets.map(x => x.id === id ? { ...x, name: name.trim().slice(0, 20) || undefined } : x) })), [set]);
  const setOut = useCallback((id: string) => set(p => ({ ...EMPTY_REWARDS, ...p, out: id })), [set]);
  const pin = useCallback((id: string | null) => set(p => ({ ...EMPTY_REWARDS, ...p, pinned: id })), [set]);
  const seeBadges = useCallback((ids: string[]) => set(p => ({ ...EMPTY_REWARDS, ...p, seenBadges: [...new Set([...(p.seenBadges ?? []), ...ids])] })), [set]);
  const setAppIcon = useCallback((id: string) => set(p => ({ ...EMPTY_REWARDS, ...p, appIcon: id })), [set]);
  const seeLevel = useCallback((n: number) => set(p => ({ ...EMPTY_REWARDS, ...p, lastLevel: n })), [set]);

  return {
    ready: ready && hydrated, state: s, ...derived,
    openChest, seeResult, wear, spendShards, sendGift, placeEgg, hatch, greet, namePet, setOut, pin, seeBadges, setAppIcon, seeLevel
  };
}

export const petName = (p: Pet) => p.name ? `${p.name} · ${PETS[p.kind].name.split(' · ')[1]}` : PETS[p.kind].name;
export const shortDay = (day: string) => fromIso(day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

/* How long ago someone became a friend, the way U4 says it: "3 weeks". */
export function since(at: number, now = Date.now()) {
  const d = Math.floor((now - at) / 86400000);
  if (d < 7) return d <= 1 ? '1 day' : `${d} days`;
  if (d < 30) { const w = Math.floor(d / 7); return w === 1 ? '1 week' : `${w} weeks`; }
  const m = Math.floor(d / 30); return m === 1 ? '1 month' : `${m} months`;
}
