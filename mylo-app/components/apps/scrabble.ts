/* Scrabble: the standard 15 x 15 board and its premium squares, the 100
   tile bag, placement and word checks against the word list, scoring with
   premiums and the 50 point bonus for all seven, and Mylo's move finder. */

export type Tile = { letter: string; blank?: boolean };
export type Cell = Tile | null;
export type Placed = { idx: number; tile: Tile };
export type Premium = 'TW' | 'DW' | 'TL' | 'DL' | null;

export const SIZE = 15;
export const CENTRE = 112;

const TW = ['A1', 'H1', 'O1', 'A8', 'O8', 'A15', 'H15', 'O15'];
const DW = ['B2', 'C3', 'D4', 'E5', 'K5', 'L4', 'M3', 'N2', 'B14', 'C13', 'D12', 'E11', 'K11', 'L12', 'M13', 'N14', 'H8'];
const TL = ['F2', 'J2', 'B6', 'F6', 'J6', 'N6', 'B10', 'F10', 'J10', 'N10', 'F14', 'J14'];
const DL = ['D1', 'L1', 'G3', 'I3', 'A4', 'H4', 'O4', 'C7', 'G7', 'I7', 'M7', 'D8', 'L8', 'C9', 'G9', 'I9', 'M9', 'A12', 'H12', 'O12', 'G13', 'I13', 'D15', 'L15'];
const toIdx = (n: string) => (Number(n.slice(1)) - 1) * SIZE + 'ABCDEFGHIJKLMNO'.indexOf(n[0]);
export const PREMIUM: Premium[] = Array.from({ length: SIZE * SIZE }, () => null);
TW.forEach(n => (PREMIUM[toIdx(n)] = 'TW')); DW.forEach(n => (PREMIUM[toIdx(n)] = 'DW'));
TL.forEach(n => (PREMIUM[toIdx(n)] = 'TL')); DL.forEach(n => (PREMIUM[toIdx(n)] = 'DL'));

export const VALUES: Record<string, number> = {
  A: 1, B: 3, C: 3, D: 2, E: 1, F: 4, G: 2, H: 4, I: 1, J: 8, K: 5, L: 1, M: 3,
  N: 1, O: 1, P: 3, Q: 10, R: 1, S: 1, T: 1, U: 1, V: 4, W: 4, X: 8, Y: 4, Z: 10
};
const COUNTS: Record<string, number> = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1, K: 1, L: 4, M: 2,
  N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6, U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1, '?': 2
};
export const tileValue = (t: Tile) => (t.blank ? 0 : VALUES[t.letter] ?? 0);

export function newBag(): Tile[] {
  const bag: Tile[] = [];
  for (const [l, n] of Object.entries(COUNTS)) for (let i = 0; i < n; i++) bag.push(l === '?' ? { letter: '', blank: true } : { letter: l });
  for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
  return bag;
}

const rowOf = (i: number) => Math.floor(i / SIZE);
const colOf = (i: number) => i % SIZE;

type Word = { word: string; score: number; cells: number[] };
export type Check = { ok: true; words: Word[]; score: number } | { ok: false; error: string };

/* Read the run of letters through `idx` along a direction (1 across, 15 down). */
function run(board: Cell[], idx: number, step: 1 | 15) {
  const same = (a: number, b: number) => (step === 1 ? rowOf(a) === rowOf(b) : true);
  let s = idx;
  while (s - step >= 0 && same(s - step, s) && board[s - step]) s -= step;
  const cells: number[] = [];
  let e = s;
  while (e < SIZE * SIZE && same(e, s) && board[e]) { cells.push(e); e += step; }
  return cells;
}

function scoreWord(board: Cell[], cells: number[], fresh: Set<number>) {
  let sum = 0, mult = 1;
  for (const c of cells) {
    let v = tileValue(board[c]!);
    if (fresh.has(c)) {
      const p = PREMIUM[c];
      if (p === 'DL') v *= 2; if (p === 'TL') v *= 3;
      if (p === 'DW') mult *= 2; if (p === 'TW') mult *= 3;
    }
    sum += v;
  }
  return sum * mult;
}

/* Check a play: one line, no gaps, joined to the board (or on the centre for
   the first word), and every word it makes is in the list. */
export function check(board: Cell[], placed: Placed[], dict: Set<string>): Check {
  if (!placed.length) return { ok: false, error: 'Place some tiles first.' };
  const rows = new Set(placed.map(p => rowOf(p.idx))), cols = new Set(placed.map(p => colOf(p.idx)));
  if (rows.size > 1 && cols.size > 1) return { ok: false, error: 'Keep your tiles in one line.' };
  const next = board.slice();
  for (const p of placed) { if (next[p.idx]) return { ok: false, error: 'That square is taken.' }; next[p.idx] = p.tile; }
  const first = board.every(c => !c);
  const step: 1 | 15 = placed.length === 1
    ? ((run(next, placed[0].idx, 1).length > 1 ? 1 : 15))
    : rows.size === 1 ? 1 : 15;
  const main = run(next, placed[0].idx, step);
  if (!placed.every(p => main.includes(p.idx))) return { ok: false, error: 'Leave no gaps in your word.' };
  if (first) {
    if (!placed.some(p => p.idx === CENTRE)) return { ok: false, error: 'The first word covers the centre star.' };
    if (main.length < 2) return { ok: false, error: 'Words are two letters or more.' };
  } else {
    const touches = placed.some(p => [p.idx - 1, p.idx + 1, p.idx - SIZE, p.idx + SIZE].some(n =>
      n >= 0 && n < SIZE * SIZE && board[n] && (Math.abs(colOf(n) - colOf(p.idx)) <= 1)));
    if (!touches) return { ok: false, error: 'Join your word to the board.' };
  }
  const fresh = new Set(placed.map(p => p.idx));
  const words: Word[] = [];
  if (main.length > 1) words.push({ word: main.map(c => next[c]!.letter).join(''), score: scoreWord(next, main, fresh), cells: main });
  const cross: 1 | 15 = step === 1 ? 15 : 1;
  for (const p of placed) {
    const cells = run(next, p.idx, cross);
    if (cells.length > 1) words.push({ word: cells.map(c => next[c]!.letter).join(''), score: scoreWord(next, cells, fresh), cells });
  }
  if (!words.length) return { ok: false, error: 'Words are two letters or more.' };
  const bad = words.find(w => !dict.has(w.word));
  if (bad) return { ok: false, error: `${bad.word} is not in the word list.` };
  const score = words.reduce((n, w) => n + w.score, 0) + (placed.length === 7 ? 50 : 0);
  return { ok: true, words, score };
}

/* ── Mylo's move finder ────────────────────────────────────────────────────
   Words made from the rack, either through one letter already on the board
   or, on an empty board, across the centre. Each spot is checked in full,
   cross words included, and the best score wins. */
export type Found = { placed: Placed[]; score: number; word: string };

export function findMove(board: Cell[], rack: Tile[], words: string[], dict: Set<string>): Found | null {
  const have: Record<string, number> = {};
  let blanks = 0;
  for (const t of rack) { if (t.blank) blanks++; else have[t.letter] = (have[t.letter] ?? 0) + 1; }
  const first = board.every(c => !c);
  const onBoard = new Map<string, number[]>();
  board.forEach((c, i) => { if (c) onBoard.set(c.letter, [...(onBoard.get(c.letter) ?? []), i]); });

  let best: Found | null = null;
  let tries = 0;
  const consider = (word: string, startIdx: number, step: 1 | 15) => {
    if (tries > 40000) return;
    const end = startIdx + step * (word.length - 1);
    if (end >= SIZE * SIZE) return;
    if (step === 1 && rowOf(startIdx) !== rowOf(end)) return;
    if (startIdx - step >= 0 && (step === 15 || rowOf(startIdx - 1) === rowOf(startIdx)) && board[startIdx - step]) return;
    if (end + step < SIZE * SIZE && (step === 15 || rowOf(end + 1) === rowOf(end)) && board[end + step]) return;
    const pool = { ...have };
    let wild = blanks;
    const placed: Placed[] = [];
    for (let k = 0; k < word.length; k++) {
      const idx = startIdx + step * k;
      const c = board[idx];
      if (c) { if (c.letter !== word[k]) return; continue; }
      if (pool[word[k]]) { pool[word[k]]--; placed.push({ idx, tile: { letter: word[k] } }); }
      else if (wild) { wild--; placed.push({ idx, tile: { letter: word[k], blank: true } }); }
      else return;
    }
    if (!placed.length) return;
    tries++;
    const r = check(board, placed, dict);
    if (r.ok && (!best || r.score > best.score)) best = { placed, score: r.score, word };
  };

  for (const word of words) {
    if (word.length < 2 || word.length > 8) continue;
    // letters the rack is short of for this word
    const need: Record<string, number> = {};
    for (const ch of word) need[ch] = (need[ch] ?? 0) + 1;
    let short = 0;
    const shortOf: string[] = [];
    for (const [ch, n] of Object.entries(need)) { const s = n - (have[ch] ?? 0); if (s > 0) { short += s; shortOf.push(ch); } }
    if (first) {
      if (short > blanks || word.length > rack.length) continue;
      for (let s = Math.max(0, 7 - word.length + 1); s <= 7; s++) if (s + word.length - 1 <= 14) consider(word, 7 * SIZE + s, 1);
      continue;
    }
    if (short > blanks + 1 || word.length > rack.length + 1) continue;
    const anchors = short > blanks ? shortOf : [...new Set(word)];
    for (const a of anchors) {
      const spots = onBoard.get(a); if (!spots) continue;
      for (let k = 0; k < word.length; k++) {
        if (word[k] !== a) continue;
        for (const spot of spots) {
          if (colOf(spot) - k >= 0 && colOf(spot) - k + word.length <= SIZE) consider(word, spot - k, 1);
          if (rowOf(spot) - k >= 0 && rowOf(spot) - k + word.length <= SIZE) consider(word, spot - k * SIZE, 15);
        }
      }
    }
  }
  return best;
}
