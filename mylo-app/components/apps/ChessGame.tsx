'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated, useLocal } from '@/lib/local';
import { headToHead, uid, useResults } from '@/lib/apps';
import * as C from './chess';
import ChessBoard from './ChessBoard';
import { morph } from './motion';
import { Avatar, Confetti, Head, useToast } from './ui';

/* G2 · Chess · your move (879:114987), G3 · won (879:115141), G4 · lost or
   draw (879:115201). You play white against Mylo, five minutes each; Mylo's
   moves come from the engine in chess.ts. The game is kept on the device, so
   leaving and coming back picks it up where it was (clocks pause while away). */
export type Line = [number, number, C.Kind?][];
export type ChessSave = { id: string; line: Line; clocks: { w: number; b: number }; over?: { outcome: 'won' | 'lost' | 'draw'; how: string; moves: number } };
export const CHESS_KEY = 'mylo.apps.chess.v1';
const START = 5 * 60 * 1000;
const VS = 'Mylo';
const fresh = (): ChessSave => ({ id: uid(), line: [], clocks: { w: START, b: START } });

/* Replay a saved line into positions, SAN and repetition keys. */
export function replay(line: Line) {
  let pos = C.start();
  const sans: string[] = [], keys = [C.key(pos)];
  let last: [number, number] | null = null;
  for (const [from, to, promo] of line) {
    const m = C.legal(pos).find(x => x.from === from && x.to === to && (x.promo ?? undefined) === (promo ?? undefined));
    if (!m) break;
    sans.push(C.san(pos, m));
    pos = C.play(pos, m);
    keys.push(C.key(pos));
    last = [from, to];
  }
  return { pos, sans, keys, last };
}

export const clockText = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const HOW: Record<Exclude<C.Ending, null | 'checkmate'>, string> = {
  stalemate: 'Draw by stalemate', repetition: 'Draw by repetition', fifty: 'Draw by the fifty move rule', material: 'Draw, not enough pieces left'
};

export default function ChessGame() {
  const ready = useHydrated();
  const [save, setSave] = useLocal<ChessSave>(CHESS_KEY, fresh());
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  // Ending and starting again change the whole screen in place, as one moment.
  const rematch = () => morph(() => setSave(fresh()));
  return save.over
    ? <ChessOver save={save} onRematch={rematch} />
    : <ChessPlay key={save.id} save={save} setSave={setSave} />;
}

function ChessPlay({ save, setSave }: { save: ChessSave; setSave: (s: ChessSave | ((p: ChessSave) => ChessSave)) => void }) {
  const [, setResults] = useResults();
  const [toast, showToast] = useToast();
  const [sel, setSel] = useState<number | null>(null);
  const [promo, setPromo] = useState<{ from: number; to: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [now, setNow] = useState(0);
  const [since, setSince] = useState(0);
  const { pos, sans, keys, last } = useMemo(() => replay(save.line), [save.line]);
  const legal = useMemo(() => C.legal(pos), [pos]);
  const yourTurn = pos.turn === 'w';

  const finish = useCallback((outcome: 'won' | 'lost' | 'draw', how: string) => {
    const moves = Math.ceil(save.line.length / 2);
    morph(() => {
      setSave(s => (s.over ? s : { ...s, over: { outcome, how, moves } }));
      setResults(r => (r.some(x => x.id === save.id) ? r : [{ id: save.id, game: 'chess', vs: VS, outcome, at: new Date().toISOString(), moves, how }, ...r]));
    });
  }, [save.id, save.line.length, setSave, setResults]);

  const commit = useCallback((m: C.Move) => {
    const t = Date.now();
    setSave(s => {
      const spent = since ? t - since : 0;
      return { ...s, line: [...s.line, m.promo ? [m.from, m.to, m.promo] : [m.from, m.to]], clocks: { ...s.clocks, [pos.turn]: Math.max(0, s.clocks[pos.turn] - spent) } };
    });
    setSince(t); setSel(null);
  }, [pos.turn, setSave, since]);

  // The clock: starts when the screen is open, ticks for the side to move.
  useEffect(() => {
    const id = setInterval(() => { const t = Date.now(); setNow(t); setSince(s => s || t); }, 250);
    return () => clearInterval(id);
  }, []);
  // The last tick can be older than the last move, so time spent never goes below nought.
  const left = (s: C.Side) => save.clocks[s] - (pos.turn === s && since && now ? Math.max(0, now - since) : 0);

  // Endings, and running out of time.
  useEffect(() => {
    const e = C.ending(pos, keys);
    const t = setTimeout(() => {
      if (e === 'checkmate') finish(pos.turn === 'w' ? 'lost' : 'won', `Checkmate in ${Math.ceil(save.line.length / 2)} moves`);
      else if (e) finish('draw', HOW[e]);
    }, e === 'checkmate' ? 700 : 400);
    return () => clearTimeout(t);
  }, [pos, keys, finish, save.line.length]);
  useEffect(() => {
    if (since && now && left(pos.turn) <= 0) {
      const t = setTimeout(() => finish(pos.turn === 'w' ? 'lost' : 'won', pos.turn === 'w' ? 'Out of time' : `${VS} ran out of time`), 0);
      return () => clearTimeout(t);
    }
  });

  // Mylo's move.
  useEffect(() => {
    if (yourTurn || C.ending(pos, keys)) return;
    const t = setTimeout(() => { const m = C.bestMove(pos, keys); if (m) commit(m); }, 650);
    return () => clearTimeout(t);
  }, [yourTurn, pos, keys, commit]);

  const targets = sel === null ? [] : [...new Set(legal.filter(m => m.from === sel).map(m => m.to))];
  const tap = (i: number) => {
    if (!yourTurn) return;
    if (sel !== null && targets.includes(i)) {
      const ms = legal.filter(m => m.from === sel && m.to === i);
      if (ms.length > 1) { setPromo({ from: sel, to: i }); return; }
      commit(ms[0]); return;
    }
    const p = pos.board[i];
    setSel(p && p[0] === 'w' && sel !== i ? i : null);
  };

  // The move chips: the last two full moves, then the one being played.
  const pairs: string[] = [];
  for (let k = 0; k < sans.length; k += 2) pairs.push(`${k / 2 + 1}. ${sans[k]}${sans[k + 1] ? ` ${sans[k + 1]}` : ''}`);
  const n = Math.floor(sans.length / 2) + 1;
  const done = sans.length % 2 === 0 ? pairs : pairs.slice(0, -1);
  const current = yourTurn ? `${n}. Your move` : `${n}. ${sans[sans.length - 1]} …`;
  const diff = C.material(pos.board);
  const up = (d: number) => (d <= 0 ? '' : d === 1 ? ' · up a pawn' : ` · up ${d}`);
  const checkSq = C.inCheck(pos) ? pos.board.indexOf(`${pos.turn}K`) : null;
  const ended = C.ending(pos, keys);

  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-game">
      <Head title={`Chess · ${VS}`} fallback="/games" right={<button type="button" className="ax-more" aria-label="More" onClick={() => setMenu(true)}><Icon name="apps/i-more" size={22} /></button>} />
      <div className="ax-player">
        <Avatar name={VS} size={36} tint="var(--tint-amber)" />
        <span className="ax-player-text"><span className="t-body ax-600">{VS}</span><span className="t-caption c-2">Black{up(-diff)}</span></span>
        <span className={`ax-clock${!yourTurn ? ' is-on' : ''}`}>{clockText(left('b'))}</span>
      </div>
      <div className="ax-board-wrap">
        <ChessBoard board={pos.board} className="is-live" selected={sel} targets={targets} last={last} check={checkSq} onSquare={tap} name="ax-chess" />
        {ended && <span className="ax-ending" role="status">{ended === 'checkmate' ? 'Checkmate' : 'Draw'}</span>}
        {promo && (
          <div className="ax-promo" role="dialog" aria-label="Promote to">
            {(['Q', 'R', 'B', 'N'] as C.Kind[]).map(k => (
              <button key={k} type="button" aria-label={{ Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight' }[k as 'Q']}
                      onClick={() => { const m = legal.find(x => x.from === promo.from && x.to === promo.to && x.promo === k); setPromo(null); if (m) commit(m); }}>
                <img src={`/figma/apps/piece-w${k}.svg`} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="ax-player">
        <Avatar name="You" size={36} me />
        <span className="ax-player-text"><span className="t-body ax-600">You</span><span className="t-caption c-2">White{yourTurn ? ' · your move' : ''}{up(diff)}</span></span>
        <span className={`ax-clock${yourTurn ? ' is-on' : ''}`}>{clockText(left('w'))}</span>
      </div>
      <div className="ax-moves" aria-label="Moves">
        {done.slice(-2).map(p => <span key={p} className="ax-move">{p}</span>)}
        <span className="ax-move is-now">{current}</span>
      </div>
      <div className="ax-actions">
        <Link href="/chats" className="ax-action"><Icon name="apps/i-chat" size={24} />Chat</Link>
        <button type="button" className="ax-action" disabled={!!ended} onClick={() => (C.acceptsDraw(pos, 'b') ? finish('draw', 'Draw by agreement') : showToast(`${VS} plays on.`))}><Icon name="apps/i-hand" size={24} />Offer draw</button>
        <button type="button" className="ax-action" disabled={!!ended} onClick={() => finish('lost', 'Resigned')}><Icon name="apps/i-flag" size={24} />Resign</button>
      </div>
      {toast}
      <Sheet open={menu} onClose={() => setMenu(false)} title={`Chess · ${VS}`}>
        <div className="ax-menu">
          <button type="button" className="ax-menu-row" onClick={() => { setMenu(false); morph(() => setSave(fresh())); }}><Icon name="apps/i-repeat" size={22} />Start again</button>
          <Link href="/games" className="ax-menu-row"><Icon name="apps/i-more" size={22} />All games</Link>
        </div>
      </Sheet>
    </main>
  );
}

const G3_CONFETTI: [number, number, string, number][] = [
  [52, 110, '#E5574A', 0], [93, 152, '#F5B83D', -37], [166, 196, '#2FA36B', -74], [239, 248, '#0F0F12', -21], [312, 121, '#5AA8D6', -58],
  [35, 174, '#E5574A', -5], [108, 217, '#F5B83D', -42], [181, 261, '#2FA36B', -79], [254, 142, '#0F0F12', -26], [327, 186, '#5AA8D6', -63],
  [50, 239, '#E5574A', -10], [123, 111, '#F5B83D', -47], [196, 156, '#2FA36B', -84], [269, 207, '#0F0F12', -31], [342, 251, '#5AA8D6', -68],
  [65, 133, '#E5574A', -15], [138, 176, '#F5B83D', -52], [284, 271, '#0F0F12', -36], [357, 145, '#5AA8D6', -73], [80, 197, '#E5574A', -20],
  [153, 240, '#F5B83D', -57], [226, 123, '#2FA36B', -4], [299, 166, '#0F0F12', -41], [334, 210, '#5AA8D6', -78], [95, 262, '#E5574A', -25]
];

function ChessOver({ save, onRematch }: { save: ChessSave; onRematch: () => void }) {
  const router = useRouter();
  const [results] = useResults();
  const over = save.over!;
  const h = headToHead(results, 'chess', VS);
  const { pos } = useMemo(() => replay(save.line), [save.line]);
  const share = async () => {
    const text = over.outcome === 'won' ? `I beat ${VS} at Chess. ${over.how}.` : over.outcome === 'draw' ? `Chess with ${VS}: even match.` : `${VS} won at Chess.`;
    try { if (navigator.share) { await navigator.share({ text }); return; } } catch { return; }
    router.push('/chats');
  };
  if (over.outcome === 'won') return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-result">
      <Head fallback="/games" />
      <Confetti pieces={G3_CONFETTI} className="ax-result-confetti" />
      <img className="ax-result-mylo is-won" src="/figma/apps/mylo-won.svg" alt="" width={142} height={170} />
      <p className="ax-how">{over.how}</p>
      <h1 className="ax-result-title">You beat {VS}</h1>
      <p className="ax-14 c-2 ax-center">Head to head: you {h.you}, {VS} {h.them}</p>
      <div className="ax-saved">
        <span className="ax-saved-icon"><img src="/figma/apps/i-trophy.svg" alt="" width={26} height={26} /></span>
        <span><span className="ax-saved-t">Win saved</span><span className="t-body-s c-2">Head to head updated. Rematch any time.</span></span>
      </div>
      <span className="spacer" />
      <div className="ax-moment-btns">
        <button type="button" className="ax-btn" onClick={onRematch}><Icon name="apps/i-repeat" size={22} />Rematch</button>
        <button type="button" className="ax-btn ax-btn-soft" onClick={share}><Icon name="apps/i-share" size={22} />Share to chat</button>
      </div>
    </main>
  );
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-result">
      <Head fallback="/games" />
      <img className="ax-result-mylo" src={over.outcome === 'draw' ? '/figma/apps/mylo-even.svg' : '/figma/apps/mylo-sad.svg'} alt="" width={125} height={150} />
      <p className="ax-how">{over.how}</p>
      <h1 className="ax-result-title">{over.outcome === 'draw' ? 'Even match' : `${VS} won`}</h1>
      <p className="ax-14 c-2 ax-center">Good game. Rematch any time.</p>
      <ChessBoard board={pos.board} className="is-final" label="Final position" name="ax-chess" />
      <span className="spacer" />
      <div className="ax-pair">
        <button type="button" className="ax-btn" onClick={onRematch}>Rematch</button>
        <Link href="/games" className="ax-btn ax-btn-soft">All games</Link>
      </div>
    </main>
  );
}
