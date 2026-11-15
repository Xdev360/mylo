'use client';

import { useLocal } from './local';

/* The Apps area's saved state and rules. Every list starts empty. Levels and
   XP are the server's (handoff: "XP, levels, streaks, keys, chests and gates
   are decided on the server. The app only shows them"), so nothing here
   counts XP or decides a level; the gates read `LEVEL` and `RELEASES`, which
   stay at "not reached" until the server sends them. */

/* ── Gates ─────────────────────────────────────────────────────────────── */
export type Level = 'Spark' | 'Kindle' | 'Flame' | 'Blaze' | 'Beacon';
export type Release = 'launch1' | 'u1_1' | 'u1_2' | 'u1_3' | 'u2_0' | 'u2_1';
export type Feature = 'games' | 'challenges' | 'pets' | 'scrabble' | 'rush' | 'chest' | 'vibes' | 'rewards';

/* Handoff §1 build order: Flame opens games, Chance, challenges and dares
   (1.1); Blaze opens eggs and pets (1.2); Beacon opens Scrabble, Colour Rush
   and the vibe feed (1.3); edit reward comes with 2.0. */
export const GATES: Record<Feature, { level: Level; release: Release; name: string; plural: boolean }> = {
  games: { level: 'Flame', release: 'u1_1', name: 'Games', plural: true },
  challenges: { level: 'Flame', release: 'u1_1', name: 'Challenges', plural: true },
  chest: { level: 'Kindle', release: 'u1_2', name: 'Sunday chest', plural: false },
  pets: { level: 'Blaze', release: 'u1_2', name: 'Pets', plural: true },
  scrabble: { level: 'Beacon', release: 'u1_3', name: 'Scrabble', plural: false },
  rush: { level: 'Beacon', release: 'u1_3', name: 'Colour Rush', plural: false },
  vibes: { level: 'Beacon', release: 'u1_3', name: 'Saved', plural: false },
  rewards: { level: 'Kindle', release: 'u2_0', name: 'Rewards', plural: true }
};
const ORDER: Level[] = ['Spark', 'Kindle', 'Flame', 'Blaze', 'Beacon'];

/* Every release is on and nothing waits for a level: the owner wants the
   whole app open now. To bring the handoff's gates back, set RELEASES to the
   releases that are out and LEVEL to the level the server reports. */
export const GATES_ON = false;
export const LEVEL: Level | null = null;
export const RELEASES: Release[] = ['launch1', 'u1_1', 'u1_2', 'u1_3', 'u2_0', 'u2_1'];

export type GateState = 'open' | 'level' | 'release';
export function gate(f: Feature): GateState {
  if (!GATES_ON) return 'open';
  const g = GATES[f];
  if (!RELEASES.includes(g.release)) return 'release';
  if (!LEVEL || ORDER.indexOf(LEVEL) < ORDER.indexOf(g.level)) return 'level';
  return 'open';
}

/* ── Habits: identities (LX7), stacks (LX8), review (LX10) ─────────────── */
export type Identity = { id: string; label: string; icon: string; tone: 'green' | 'blue' | 'amber' | 'red' | 'grey' };
export const IDENTITIES: Identity[] = [
  { id: 'moves', label: 'Someone who moves every day', icon: 'i-workout', tone: 'green' },
  { id: 'reader', label: 'A reader', icon: 'i-book', tone: 'blue' },
  { id: 'finisher', label: 'Someone who finishes things', icon: 'i-done', tone: 'amber' },
  { id: 'calm', label: 'Calm and rested', icon: 'i-moon', tone: 'blue' },
  { id: 'money', label: 'Good with money', icon: 'i-chart', tone: 'green' },
  { id: 'friend', label: 'A good friend', icon: 'i-heart', tone: 'red' }
];
export type Stack = { id: string; anchor: string; habit: string; small?: string; smallOn: boolean; identity?: string; itemId?: string; at: string };
export const ANCHORS = ['Wake up', 'Brush my teeth', 'Make coffee', 'Lunch', 'Get home', 'Before bed'];

export const useIdentities = () => useLocal<string[]>('mylo.apps.identities.v1', []);
export const useOwnIdentities = () => useLocal<Identity[]>('mylo.apps.own-identities.v1', []);
export const useStacks = () => useLocal<Stack[]>('mylo.apps.stacks.v1', []);
export const useHard = () => useLocal<Record<string, string[]>>('mylo.apps.hard.v1', {});

/* ── Milestones (I4) ───────────────────────────────────────────────────── */
export type Milestone = { id: string; goalId: string; title: string; date?: string; reward?: string; rewardIcon?: string; done: boolean; doneAt?: string };
export const useMilestones = () => useLocal<Milestone[]>('mylo.apps.milestones.v1', []);

/* ── Saved vibes (V6). The feed saves into this list with saveVibe(). ──── */
export type VibeStyle = 'dots' | 'sunburst' | 'halftone' | 'waves' | 'stars' | 'blobs';
export type Vibe = { id: string; text: string; style: VibeStyle; at: string };
export const VIBE_STYLES: VibeStyle[] = ['dots', 'sunburst', 'halftone', 'waves', 'stars', 'blobs'];
const VIBES_KEY = 'mylo.apps.vibes.v1';
export const useVibes = () => useLocal<Vibe[]>(VIBES_KEY, []);
export function saveVibe(text: string, style?: VibeStyle) {
  try {
    const all: Vibe[] = JSON.parse(localStorage.getItem(VIBES_KEY) ?? '[]');
    const pick = style ?? VIBE_STYLES[all.length % VIBE_STYLES.length];
    localStorage.setItem(VIBES_KEY, JSON.stringify([{ id: crypto.randomUUID(), text, style: pick, at: new Date().toISOString() }, ...all]));
  } catch { /* storage blocked */ }
}

/* ── Rewards you set yourself (W6) ─────────────────────────────────────── */
export type Reward = { id: string; what: string; after: number; minutes?: number; paused: boolean; history: string[]; ready?: boolean };
export const useRewards = () => useLocal<Reward[]>('mylo.apps.rewards.v1', []);

/* ── Challenges and dares (CH1 to CH5) ─────────────────────────────────── */
export type Challenge = {
  id: string; kind: 'challenge' | 'dare'; title: string; people: string[]; days: number;
  loser?: string; proof: boolean; nudge: boolean; startedAt: string;
  checkins: Record<string, string[]>; // person ("you" for you) -> ISO days checked in
  from?: string; status: 'active' | 'offered' | 'done' | 'declined'; proofPhoto?: string; doneAt?: string; room?: string;
};
export const useChallenges = () => useLocal<Challenge[]>('mylo.apps.challenges.v1', []);

/* ── Games ─────────────────────────────────────────────────────────────── */
export type GameId = 'chess' | 'rush' | 'scrabble' | 'chance';
export const GAMES: { id: GameId; name: string; players: string; pick: string; icon: string }[] = [
  { id: 'chess', name: 'Chess', players: '2 players', pick: '2 players · about 15 min', icon: 'app-chess' },
  { id: 'rush', name: 'Colour Rush', players: '2 to 4', pick: '2 to 4 · about 5 min', icon: 'app-rush' },
  { id: 'scrabble', name: 'Scrabble', players: '2 or 3', pick: '2 or 3 · async', icon: 'app-scrabble' },
  { id: 'chance', name: 'Chance', players: '2, best of 3', pick: '2 · under a minute', icon: 'app-chance' }
];
export const gameName = (id: string) => GAMES.find(g => g.id === id)?.name ?? id;

export type Result = { id: string; game: GameId; vs: string; outcome: 'won' | 'lost' | 'draw'; at: string; moves?: number; how?: string };
export const useResults = () => useLocal<Result[]>('mylo.apps.results.v1', []);

/* Head to head against one opponent in one game. */
export function headToHead(results: Result[], game: GameId, vs: string) {
  const mine = results.filter(r => r.game === game && r.vs === vs);
  return { you: mine.filter(r => r.outcome === 'won').length, them: mine.filter(r => r.outcome === 'lost').length };
}

/* "Yesterday", "Today", or a short date, for the Recent list. */
export function when(isoString: string) {
  const d = new Date(isoString), now = new Date();
  const days = Math.round((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 864e5);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export const uid = () => crypto.randomUUID();
export const initial = (name: string) => (name.trim()[0] ?? '?').toUpperCase();
/* The avatar tints Figma cycles through. */
const TINTS = ['var(--tint-amber)', 'var(--tint-green)', 'var(--tint-red)', 'var(--tint-blue)', 'var(--surface-2)'];
export const tintFor = (name: string) => TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
