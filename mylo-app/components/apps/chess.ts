/* Chess rules, written out in full: every legal move (castling, en passant,
   promotion), check, mate, stalemate, threefold repetition, the fifty-move
   rule and dead positions; moves named in SAN; and a small engine for Mylo
   (alpha-beta, material and piece-square tables). Square 0 is a8, 63 is h1. */

export type Side = 'w' | 'b';
export type Kind = 'P' | 'N' | 'B' | 'R' | 'Q' | 'K';
export type Piece = `${Side}${Kind}`;
export type Board = (Piece | null)[];
export type Castling = { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
export type Position = { board: Board; turn: Side; castling: Castling; ep: number | null; half: number; full: number };
export type Move = { from: number; to: number; piece: Piece; captured?: Piece; promo?: Kind; castle?: 'K' | 'Q'; ep?: boolean };
export type Ending = 'checkmate' | 'stalemate' | 'repetition' | 'fifty' | 'material' | null;

const FILES = 'abcdefgh';
export const fileOf = (i: number) => i % 8;
export const rankOf = (i: number) => 8 - Math.floor(i / 8);
export const sqName = (i: number) => FILES[fileOf(i)] + rankOf(i);
const at = (f: number, r: number) => (f < 0 || f > 7 || r < 1 || r > 8 ? -1 : (8 - r) * 8 + f);
const side = (p: Piece) => p[0] as Side;
const kind = (p: Piece) => p[1] as Kind;
const other = (s: Side): Side => (s === 'w' ? 'b' : 'w');

export function start(): Position {
  const back: Kind[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const board: Board = Array(64).fill(null);
  back.forEach((k, f) => { board[f] = `b${k}`; board[56 + f] = `w${k}`; board[8 + f] = 'bP'; board[48 + f] = 'wP'; });
  return { board, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null, half: 0, full: 1 };
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

/* Is square `sq` attacked by `by`? */
export function attacked(board: Board, sq: number, by: Side) {
  const f = fileOf(sq), r = rankOf(sq);
  const dir = by === 'w' ? -1 : 1; // a white pawn attacks from one rank below
  for (const df of [-1, 1]) { const s = at(f + df, r + dir); if (s >= 0 && board[s] === `${by}P`) return true; }
  for (const [df, dr] of KNIGHT) { const s = at(f + df, r + dr); if (s >= 0 && board[s] === `${by}N`) return true; }
  for (const [df, dr] of KING) { const s = at(f + df, r + dr); if (s >= 0 && board[s] === `${by}K`) return true; }
  for (const [lines, kinds] of [[ROOK, ['R', 'Q']], [BISHOP, ['B', 'Q']]] as const) {
    for (const [df, dr] of lines) {
      let nf = f + df, nr = r + dr;
      for (;;) {
        const s = at(nf, nr); if (s < 0) break;
        const p = board[s];
        if (p) { if (side(p) === by && (kinds as readonly string[]).includes(kind(p))) return true; break; }
        nf += df; nr += dr;
      }
    }
  }
  return false;
}

const kingSq = (board: Board, s: Side) => board.indexOf(`${s}K`);
export const inCheck = (pos: Position, s: Side = pos.turn) => attacked(pos.board, kingSq(pos.board, s), other(s));

function pseudo(pos: Position): Move[] {
  const { board, turn } = pos;
  const out: Move[] = [];
  const push = (from: number, to: number, extra: Partial<Move> = {}) => {
    const piece = board[from]!;
    const captured = extra.ep ? (`${other(turn)}P` as Piece) : board[to] ?? undefined;
    if (kind(piece) === 'P' && (rankOf(to) === 8 || rankOf(to) === 1)) {
      for (const promo of ['Q', 'R', 'B', 'N'] as Kind[]) out.push({ from, to, piece, captured, promo, ...extra });
    } else out.push({ from, to, piece, captured, ...extra });
  };
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || side(p) !== turn) continue;
    const f = fileOf(i), r = rankOf(i), k = kind(p);
    if (k === 'P') {
      const d = turn === 'w' ? 1 : -1;
      const one = at(f, r + d);
      if (one >= 0 && !board[one]) {
        push(i, one);
        const two = at(f, r + 2 * d);
        if ((turn === 'w' ? r === 2 : r === 7) && !board[two]) push(i, two);
      }
      for (const df of [-1, 1]) {
        const s = at(f + df, r + d); if (s < 0) continue;
        if (board[s] && side(board[s]!) !== turn) push(i, s);
        else if (s === pos.ep) push(i, s, { ep: true });
      }
    } else if (k === 'N' || k === 'K') {
      for (const [df, dr] of k === 'N' ? KNIGHT : KING) {
        const s = at(f + df, r + dr);
        if (s >= 0 && (!board[s] || side(board[s]!) !== turn)) push(i, s);
      }
      if (k === 'K') {
        const home = turn === 'w' ? 60 : 4;
        if (i === home && !attacked(board, i, other(turn))) {
          const c = pos.castling;
          if ((turn === 'w' ? c.wK : c.bK) && !board[i + 1] && !board[i + 2] && board[i + 3] === `${turn}R`
              && !attacked(board, i + 1, other(turn)) && !attacked(board, i + 2, other(turn))) push(i, i + 2, { castle: 'K' });
          if ((turn === 'w' ? c.wQ : c.bQ) && !board[i - 1] && !board[i - 2] && !board[i - 3] && board[i - 4] === `${turn}R`
              && !attacked(board, i - 1, other(turn)) && !attacked(board, i - 2, other(turn))) push(i, i - 2, { castle: 'Q' });
        }
      }
    } else {
      const lines = k === 'R' ? ROOK : k === 'B' ? BISHOP : [...ROOK, ...BISHOP];
      for (const [df, dr] of lines) {
        let nf = f + df, nr = r + dr;
        for (;;) {
          const s = at(nf, nr); if (s < 0) break;
          if (board[s]) { if (side(board[s]!) !== turn) push(i, s); break; }
          push(i, s); nf += df; nr += dr;
        }
      }
    }
  }
  return out;
}

export function play(pos: Position, m: Move): Position {
  const board = pos.board.slice();
  const turn = pos.turn;
  board[m.to] = m.promo ? (`${turn}${m.promo}` as Piece) : m.piece;
  board[m.from] = null;
  if (m.ep) board[m.to + (turn === 'w' ? 8 : -8)] = null;
  if (m.castle === 'K') { board[m.to - 1] = board[m.to + 1]; board[m.to + 1] = null; }
  if (m.castle === 'Q') { board[m.to + 1] = board[m.to - 2]; board[m.to - 2] = null; }
  const castling = { ...pos.castling };
  if (kind(m.piece) === 'K') { if (turn === 'w') { castling.wK = false; castling.wQ = false; } else { castling.bK = false; castling.bQ = false; } }
  for (const s of [m.from, m.to]) {
    if (s === 63) castling.wK = false; if (s === 56) castling.wQ = false;
    if (s === 7) castling.bK = false; if (s === 0) castling.bQ = false;
  }
  const ep = kind(m.piece) === 'P' && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : null;
  const half = kind(m.piece) === 'P' || m.captured ? 0 : pos.half + 1;
  return { board, turn: other(turn), castling, ep, half, full: pos.full + (turn === 'b' ? 1 : 0) };
}

export function legal(pos: Position): Move[] {
  return pseudo(pos).filter(m => !inCheck(play(pos, m), pos.turn));
}

/* The position's identity for repetition: placement, side, rights, ep. */
export function key(pos: Position) {
  return pos.board.map(p => p ?? '.').join('') + pos.turn + Object.values(pos.castling).map(Number).join('') + (pos.ep ?? '-');
}

function deadPosition(board: Board) {
  const rest = board.filter((p): p is Piece => !!p && kind(p) !== 'K');
  if (rest.length === 0) return true;
  if (rest.length === 1 && (kind(rest[0]) === 'B' || kind(rest[0]) === 'N')) return true;
  if (rest.every(p => kind(p) === 'B')) {
    const colours = new Set(board.map((p, i) => (p && kind(p) === 'B' ? (fileOf(i) + rankOf(i)) % 2 : -1)).filter(c => c >= 0));
    return colours.size === 1;
  }
  return false;
}

export function ending(pos: Position, history: string[]): Ending {
  if (legal(pos).length === 0) return inCheck(pos) ? 'checkmate' : 'stalemate';
  const k = key(pos);
  if (history.filter(h => h === k).length >= 3) return 'repetition';
  if (pos.half >= 100) return 'fifty';
  if (deadPosition(pos.board)) return 'material';
  return null;
}

export function san(pos: Position, m: Move): string {
  let s: string;
  if (m.castle) s = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const k = kind(m.piece);
    const cap = m.captured ? 'x' : '';
    if (k === 'P') s = (cap ? FILES[fileOf(m.from)] : '') + cap + sqName(m.to) + (m.promo ? `=${m.promo}` : '');
    else {
      const rivals = legal(pos).filter(o => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = '';
      if (rivals.length) {
        if (rivals.every(o => fileOf(o.from) !== fileOf(m.from))) dis = FILES[fileOf(m.from)];
        else if (rivals.every(o => rankOf(o.from) !== rankOf(m.from))) dis = String(rankOf(m.from));
        else dis = sqName(m.from);
      }
      s = k + dis + cap + sqName(m.to);
    }
  }
  const next = play(pos, m);
  if (inCheck(next)) s += legal(next).length === 0 ? '#' : '+';
  return s;
}

/* Material count, white minus black, in pawns. */
const VALUE: Record<Kind, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
export function material(board: Board) {
  return board.reduce((n, p) => (p ? n + (side(p) === 'w' ? 1 : -1) * VALUE[kind(p)] : n), 0);
}

/* ── Mylo's engine ──────────────────────────────────────────────────────── */
const CENTRE = (i: number) => {
  const f = fileOf(i), r = rankOf(i) - 1;
  return 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
};
function evaluate(pos: Position) {
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = pos.board[i]; if (!p) continue;
    const s = side(p) === 'w' ? 1 : -1, k = kind(p);
    let v = VALUE[k] * 100;
    if (k === 'N' || k === 'B') v += CENTRE(i) * 8 - ((side(p) === 'w' ? rankOf(i) === 1 : rankOf(i) === 8) ? 15 : 0);
    if (k === 'P') v += (side(p) === 'w' ? rankOf(i) - 2 : 7 - rankOf(i)) * (pos.full < 25 ? 2 : 8) + (fileOf(i) > 1 && fileOf(i) < 6 ? CENTRE(i) * 6 : 0);
    if (k === 'Q') v += CENTRE(i) * 2;
    if (k === 'K') v += pos.full < 30 ? -CENTRE(i) * 6 : CENTRE(i) * 4;
    score += s * v;
  }
  return pos.turn === 'w' ? score : -score;
}

function order(moves: Move[]) {
  return moves.sort((a, b) => (b.captured ? VALUE[kind(b.captured)] * 10 - VALUE[kind(b.piece)] : 0) + (b.promo ? 80 : 0)
    - ((a.captured ? VALUE[kind(a.captured)] * 10 - VALUE[kind(a.piece)] : 0) + (a.promo ? 80 : 0)));
}

function search(pos: Position, depth: number, alpha: number, beta: number): number {
  const moves = legal(pos);
  if (moves.length === 0) return inCheck(pos) ? -100000 - depth : 0;
  if (depth === 0) return quiesce(pos, alpha, beta, 4);
  for (const m of order(moves)) {
    const v = -search(play(pos, m), depth - 1, -beta, -alpha);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function quiesce(pos: Position, alpha: number, beta: number, left: number): number {
  const stand = evaluate(pos);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (left === 0) return alpha;
  for (const m of order(legal(pos).filter(x => x.captured || x.promo))) {
    const v = -quiesce(play(pos, m), -beta, -alpha, left - 1);
    if (v >= beta) return beta;
    if (v > alpha) alpha = v;
  }
  return alpha;
}

/* Mylo's choice: a two-ply search with captures followed out, and a little
   randomness between near-equal moves so games don't repeat. */
export function bestMove(pos: Position, history: string[] = []): Move | null {
  const moves = order(legal(pos));
  if (!moves.length) return null;
  let scored = moves.map(m => {
    const next = play(pos, m);
    let v = -search(next, 1, -Infinity, Infinity);
    if (m.promo && m.promo !== 'Q') v -= 300;
    if (history.filter(h => h === key(next)).length >= 2) v -= 50; // steer clear of repetition unless losing
    return { m, v };
  });
  scored.sort((a, b) => b.v - a.v);
  const top = scored[0].v;
  scored = scored.filter(s => s.v >= top - 12);
  return scored[Math.floor(Math.random() * scored.length)].m;
}

/* Would Mylo take a draw? Only when it is not ahead. */
export function acceptsDraw(pos: Position, mylo: Side) {
  const m = material(pos.board) * (mylo === 'w' ? 1 : -1);
  return m <= 0;
}
