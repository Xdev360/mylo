'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated, useLocal } from '@/lib/local';
import { uid, useResults } from '@/lib/apps';
import * as S from './scrabble';
import { Avatar, Head, useToast } from './ui';

/* G5 · Scrabble (879:184139). A real 15 x 15 board and bag, words checked
   against the full list in /public/figma/apps/scrabble-words.txt, against
   Mylo. Tap a rack tile, then a square; tap a tile you put down to take it
   back. Play word checks and scores it. */
type Who = 'you' | 'mylo';
type Save = {
  id: string; board: S.Cell[]; bag: S.Tile[]; racks: Record<Who, S.Tile[]>; scores: Record<Who, number>;
  turn: Who; passes: number; over?: boolean; last?: { who: Who; word: string; score: number };
};
const VS = 'Mylo';
function fresh(): Save {
  const bag = S.newBag();
  const you = bag.splice(0, 7), mylo = bag.splice(0, 7);
  return { id: uid(), board: Array(S.SIZE * S.SIZE).fill(null), bag, racks: { you, mylo }, scores: { you: 0, mylo: 0 }, turn: 'you', passes: 0 };
}

/* The word list, loaded once. */
let words: Promise<{ list: string[]; set: Set<string> }> | null = null;
function loadWords() {
  words ??= fetch('/figma/apps/scrabble-words.txt').then(r => r.text()).then(t => {
    const list = t.split(/\r?\n/).map(w => w.trim().toUpperCase()).filter(Boolean);
    return { list, set: new Set(list) };
  });
  return words;
}

/* Take tiles out of the bag to fill a rack, and settle the end. */
function refill(s: Save, who: Who): Save {
  const bag = s.bag.slice(), rack = s.racks[who].slice();
  while (rack.length < 7 && bag.length) rack.push(bag.shift()!);
  return { ...s, bag, racks: { ...s.racks, [who]: rack } };
}
function settle(s: Save): Save {
  const out = (['you', 'mylo'] as Who[]).find(w => !s.racks[w].length && !s.bag.length);
  if (!out && s.passes < 4) return s;
  const scores = { ...s.scores };
  let bonus = 0;
  for (const w of ['you', 'mylo'] as Who[]) { const v = s.racks[w].reduce((n, t) => n + S.tileValue(t), 0); scores[w] -= v; bonus += v; }
  if (out) scores[out] += bonus;
  return { ...s, scores, over: true };
}
function removeFrom(rack: S.Tile[], used: S.Tile[]) {
  const r = rack.slice();
  for (const u of used) { const i = r.findIndex(t => (u.blank ? t.blank : !t.blank && t.letter === u.letter)); if (i >= 0) r.splice(i, 1); }
  return r;
}

export default function ScrabbleGame() {
  const ready = useHydrated();
  const [save, setSave] = useLocal<Save>('mylo.apps.scrabble.v1', fresh());
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  return <ScrabblePlay key={save.id} save={save} setSave={setSave} />;
}

function ScrabblePlay({ save, setSave }: { save: Save; setSave: (s: Save) => void }) {
  const [, setResults] = useResults();
  const [toast, showToast] = useToast();
  const [dict, setDict] = useState<{ list: string[]; set: Set<string> } | null>(null);
  const [placed, setPlaced] = useState<{ idx: number; r: number; letter: string }[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [order, setOrder] = useState<number[]>(() => save.racks.you.map((_, i) => i));
  const [blankFor, setBlankFor] = useState<number | null>(null);
  const [swap, setSwap] = useState<number[] | null>(null);
  const [menu, setMenu] = useState(false);

  useEffect(() => { let on = true; loadWords().then(d => { if (on) setDict(d); }); return () => { on = false; }; }, []);

  const rack = save.racks.you;
  const rackOrder = order.length === rack.length ? order : rack.map((_, i) => i);
  const used = new Set(placed.map(p => p.r));
  const yourTurn = save.turn === 'you' && !save.over;
  const view = useMemo(() => {
    const b = save.board.slice();
    for (const p of placed) b[p.idx] = { letter: p.letter, blank: rack[p.r].blank };
    return b;
  }, [save.board, placed, rack]);

  const finish = (s: Save) => {
    setSave(s);
    if (s.over) setResults(r => [{ id: s.id, game: 'scrabble', vs: VS, outcome: s.scores.you > s.scores.mylo ? 'won' : s.scores.you < s.scores.mylo ? 'lost' : 'draw', at: new Date().toISOString(), how: `${s.scores.you} to ${s.scores.mylo}` }, ...r]);
  };

  // Mylo's turn.
  useEffect(() => {
    if (save.turn !== 'mylo' || save.over || !dict) return;
    const t = setTimeout(() => {
      const found = S.findMove(save.board, save.racks.mylo, dict.list, dict.set);
      let next: Save;
      if (found) {
        const board = save.board.slice();
        for (const p of found.placed) board[p.idx] = p.tile;
        next = refill({ ...save, board, racks: { ...save.racks, mylo: removeFrom(save.racks.mylo, found.placed.map(p => p.tile)) }, scores: { ...save.scores, mylo: save.scores.mylo + found.score }, turn: 'you', passes: 0, last: { who: 'mylo', word: found.word, score: found.score } }, 'mylo');
        showToast(`${VS} played ${found.word} for ${found.score}`);
      } else if (save.bag.length >= 7) {
        const bag = [...save.bag, ...save.racks.mylo];
        for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
        next = { ...save, bag: bag.slice(7), racks: { ...save.racks, mylo: bag.slice(0, 7) }, turn: 'you', passes: save.passes + 1 };
        showToast(`${VS} swapped tiles`);
      } else {
        next = { ...save, turn: 'you', passes: save.passes + 1 };
        showToast(`${VS} passed`);
      }
      finish(settle(next));
    }, 500);
    return () => clearTimeout(t);
  });

  const tapCell = (idx: number) => {
    if (!yourTurn) return;
    const mine = placed.find(p => p.idx === idx);
    if (mine) { setPlaced(placed.filter(p => p.idx !== idx)); return; }
    if (save.board[idx] || sel === null) return;
    if (rack[sel].blank) { setBlankFor(idx); return; }
    setPlaced([...placed, { idx, r: sel, letter: rack[sel].letter }]); setSel(null);
  };
  const putBlank = (letter: string) => {
    if (blankFor === null || sel === null) return;
    setPlaced([...placed, { idx: blankFor, r: sel, letter }]); setSel(null); setBlankFor(null);
  };
  const shuffle = () => {
    setPlaced([]); setSel(null);
    const o = rack.map((_, i) => i);
    for (let i = o.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; }
    setOrder(o);
  };
  const playWord = () => {
    if (!yourTurn) return;
    if (!dict) { showToast('Loading the word list…'); return; }
    const tiles = placed.map(p => ({ idx: p.idx, tile: { letter: p.letter, blank: rack[p.r].blank } }));
    const r = S.check(save.board, tiles, dict.set);
    if (!r.ok) { showToast(r.error); return; }
    const board = save.board.slice();
    for (const t of tiles) board[t.idx] = t.tile;
    const left = rack.filter((_, i) => !used.has(i));
    const main = r.words[0].word;
    setPlaced([]); setSel(null);
    finish(settle(refill({ ...save, board, racks: { ...save.racks, you: left }, scores: { ...save.scores, you: save.scores.you + r.score }, turn: 'mylo', passes: 0, last: { who: 'you', word: main, score: r.score } }, 'you')));
    showToast(`${main} for ${r.score}`);
  };
  const doSwap = () => {
    if (!swap || !swap.length) return;
    const out = swap.map(i => rack[i]);
    const keep = rack.filter((_, i) => !swap.includes(i));
    const bag = [...save.bag];
    const drawn = bag.splice(0, out.length);
    const back = [...bag, ...out];
    for (let i = back.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [back[i], back[j]] = [back[j], back[i]]; }
    setSwap(null); setPlaced([]); setSel(null);
    finish(settle({ ...save, bag: back, racks: { ...save.racks, you: [...keep, ...drawn] }, turn: 'mylo', passes: save.passes + 1 }));
  };
  const pass = () => { setMenu(false); setPlaced([]); finish(settle({ ...save, turn: 'mylo', passes: save.passes + 1 })); };

  const lead: Who | null = save.scores.you === save.scores.mylo ? null : save.scores.you > save.scores.mylo ? 'you' : 'mylo';
  const newCells = new Set(placed.map(p => p.idx));
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-game ax-scrabble">
      <Head title="Scrabble · 2 players" fallback="/games" right={<button type="button" className="ax-more" aria-label="More" onClick={() => setMenu(true)}><Icon name="apps/i-more" size={22} /></button>} />
      <div className="ax-scores">
        {(['you', 'mylo'] as Who[]).map(w => (
          <div key={w} className={`ax-score-p${save.turn === w && !save.over ? ' is-turn' : ''}`}>
            {w === 'you' ? <Avatar name="You" size={32} me /> : <Avatar name={VS} size={32} tint="var(--tint-red)" />}
            <span><span className="ax-13 ax-600">{w === 'you' ? 'You' : VS}</span><span className={`ax-13 ${lead === w ? 'c-green' : 'c-2'}`}>{save.scores[w]}</span></span>
          </div>
        ))}
      </div>
      <div className="ax-sboard" role="grid" aria-label="Scrabble board">
        {view.map((c, i) => {
          const prem = S.PREMIUM[i];
          return (
            <button key={i} type="button" className={`ax-sq2${prem ? ` is-${prem.toLowerCase()}` : ''}${c ? ' has-tile' : ''}${newCells.has(i) ? ' is-new' : ''}`}
                    onClick={() => tapCell(i)} aria-label={c ? c.letter : prem ?? (i === S.CENTRE ? 'Centre' : 'Empty')}>
              {c ? <span className="ax-stile">{c.letter}{!c.blank && <span>{S.VALUES[c.letter]}</span>}</span> : prem && <span className="ax-prem">{prem}</span>}
            </button>
          );
        })}
      </div>
      <p className="ax-13 ax-600 c-2">Your rack</p>
      <div className="ax-rack" role="list" aria-label="Your rack">
        {rackOrder.map(i => rack[i] && (
          <button key={i} type="button" role="listitem" className={`ax-rtile${sel === i ? ' is-sel' : ''}${used.has(i) ? ' is-used' : ''}`}
                  disabled={used.has(i) || !yourTurn} onClick={() => setSel(sel === i ? null : i)} aria-label={rack[i].blank ? 'Blank' : rack[i].letter}>
            {rack[i].blank ? '' : rack[i].letter}<span>{S.tileValue(rack[i])}</span>
          </button>
        ))}
      </div>
      <div className="ax-scrabble-btns">
        <button type="button" className="ax-btn ax-btn-soft" onClick={shuffle}>Shuffle</button>
        <button type="button" className="ax-btn ax-btn-soft" disabled={!yourTurn || !save.bag.length} onClick={() => setSwap([])}>Swap</button>
        <button type="button" className="ax-btn" disabled={!yourTurn || !placed.length} onClick={playWord}>Play word</button>
      </div>
      {toast}

      <Sheet open={blankFor !== null} onClose={() => setBlankFor(null)} title="Blank tile">
        <div className="ax-letters">
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(l => <button key={l} type="button" className="ax-rtile" onClick={() => putBlank(l)}>{l}</button>)}
        </div>
      </Sheet>
      <Sheet open={swap !== null} onClose={() => setSwap(null)} title="Swap">
        <div className="ax-letters">
          {rack.map((t, i) => (
            <button key={i} type="button" className={`ax-rtile${swap?.includes(i) ? ' is-sel' : ''}`} aria-pressed={!!swap?.includes(i)}
                    onClick={() => setSwap(s => (s ? (s.includes(i) ? s.filter(x => x !== i) : [...s, i]) : s))}>
              {t.blank ? '' : t.letter}<span>{S.tileValue(t)}</span>
            </button>
          ))}
        </div>
        <button type="button" className="ax-btn" disabled={!swap?.length || (swap?.length ?? 0) > save.bag.length} onClick={doSwap}>Swap</button>
      </Sheet>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Scrabble · 2 players" sub={`${save.bag.length} ${save.bag.length === 1 ? 'tile' : 'tiles'} in the bag`}>
        <div className="ax-menu">
          <button type="button" className="ax-menu-row" disabled={!yourTurn} onClick={pass}><Icon name="chevron-right" size={22} />Pass</button>
          <button type="button" className="ax-menu-row" onClick={() => { setMenu(false); setSave(fresh()); }}><Icon name="apps/i-repeat" size={22} />Start again</button>
          <Link href="/games" className="ax-menu-row"><Icon name="apps/i-more" size={22} />All games</Link>
        </div>
      </Sheet>
      <Sheet open={!!save.over} onClose={() => setSave(fresh())}
             title={lead === 'you' ? `You beat ${VS}` : lead === 'mylo' ? `${VS} won` : 'Even match'} sub={`You ${save.scores.you}, ${VS} ${save.scores.mylo}.`}>
        <button type="button" className="ax-btn" onClick={() => setSave(fresh())}><Icon name="apps/i-repeat" size={22} />Rematch</button>
        <Link href="/games" className="ax-btn ax-btn-soft">All games</Link>
      </Sheet>
    </main>
  );
}
