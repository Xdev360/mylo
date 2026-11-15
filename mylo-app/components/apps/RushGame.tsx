'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated, useLocal } from '@/lib/local';
import { uid, useResults } from '@/lib/apps';
import { flyFrom, lessMotion } from './motion';
import { Avatar, Head, useToast } from './ui';

/* G6 · Colour Rush (879:184493). Match the top card's colour or number;
   can't, so draw one. Down to two cards, press Rush! before you play, or
   draw two. First to empty their hand takes the round. Against Mylo, fifteen
   seconds a turn. The cards move like cards: a new round deals the hand
   from the deck one by one, a played card flies from the hand (or from
   Mylo's seat) onto the pile, a drawn card comes off the deck, and the fan
   closes up around the gap. */
type Colour = 'red' | 'blue' | 'yellow' | 'white';
type Card = { id: string; colour: Colour; n: number };
type Who = 'you' | 'mylo';
type Save = {
  id: string; round: number; deck: Card[]; pile: Card[]; hands: Record<Who, Card[]>;
  turn: Who; drew: boolean; rushed: boolean; wins: Record<Who, number>; winner?: Who;
};
const COLOURS: Colour[] = ['red', 'blue', 'yellow', 'white'];
const HEX: Record<Colour, string> = { red: '#FF5A5F', blue: '#5AA9D6', yellow: '#FFB547', white: '#E5E5E8' };
const VS = 'Mylo';
const TURN = 15;

function shuffle<T>(a: T[]) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function deal(round: number, wins: Record<Who, number>, id = uid()): Save {
  const deck = shuffle(COLOURS.flatMap(colour => [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9].map(n => ({ id: uid(), colour, n }))));
  const you = deck.splice(0, 7), mylo = deck.splice(0, 7), pile = deck.splice(0, 1);
  return { id, round, deck, pile, hands: { you, mylo }, turn: round % 2 ? 'you' : 'mylo', drew: false, rushed: false, wins };
}
const fits = (c: Card, top: Card) => c.colour === top.colour || c.n === top.n;
function draw(s: Save, who: Who, k = 1): Save {
  let deck = s.deck.slice(), pile = s.pile.slice();
  const hand = s.hands[who].slice();
  for (let i = 0; i < k; i++) {
    if (!deck.length) { const top = pile.pop()!; deck = shuffle(pile); pile = [top]; }
    if (!deck.length) break;
    hand.push(deck.shift()!);
  }
  return { ...s, deck, pile, hands: { ...s.hands, [who]: hand } };
}
const other = (w: Who): Who => (w === 'you' ? 'mylo' : 'you');
/* After a play: a hand at nought takes the round, else the turn passes. */
function end(s: Save): Save {
  for (const w of ['you', 'mylo'] as Who[]) if (!s.hands[w].length) return { ...s, wins: { ...s.wins, [w]: s.wins[w] + 1 }, winner: w };
  return { ...s, turn: other(s.turn), drew: false, rushed: false };
}
function playCard(s: Save, who: Who, card: Card) {
  const hand = s.hands[who].filter(c => c.id !== card.id);
  let next: Save = { ...s, pile: [...s.pile, card], hands: { ...s.hands, [who]: hand } };
  const penalty = hand.length === 1 && !s.rushed;
  if (penalty) next = draw(next, who, 2);
  return { next: end(next), penalty };
}

export default function RushGame() {
  const ready = useHydrated();
  const [save, setSave] = useLocal<Save>('mylo.apps.rush.v1', deal(1, { you: 0, mylo: 0 }));
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  return <RushPlay key={save.id} save={save} setSave={setSave} />;
}

function RushPlay({ save, setSave }: { save: Save; setSave: (s: Save | ((p: Save) => Save)) => void }) {
  const [, setResults] = useResults();
  const [toast, showToast] = useToast();
  const [left, setLeft] = useState(TURN);
  const [menu, setMenu] = useState(false);
  const top = save.pile[save.pile.length - 1];
  const mine = save.hands.you;
  const yourTurn = save.turn === 'you' && !save.winner;

  const log = useCallback((s: Save) => {
    if (s.winner) setResults(r => (r.some(x => x.id === s.id) ? r : [{ id: s.id, game: 'rush', vs: VS, outcome: s.winner === 'you' ? 'won' : 'lost', at: new Date().toISOString(), how: `Round ${s.round}` }, ...r]));
  }, [setResults]);
  const commit = useCallback((s: Save) => { setSave(s); log(s); }, [setSave, log]);

  // Your turn's clock; at nought you draw (if you haven't) and the turn passes.
  useEffect(() => {
    if (!yourTurn) return;
    const started = Date.now();
    const id = setInterval(() => setLeft(Math.max(0, TURN - Math.floor((Date.now() - started) / 1000))), 250);
    return () => { clearInterval(id); setLeft(TURN); };
  }, [yourTurn, save.round]);
  useEffect(() => {
    if (!yourTurn || left > 0) return;
    const t = setTimeout(() => commit(end(save.drew ? save : draw(save, 'you'))), 0);
    return () => clearTimeout(t);
  }, [left, yourTurn, save, commit]);

  // Mylo's turn.
  useEffect(() => {
    if (save.turn !== 'mylo' || save.winner) return;
    const t = setTimeout(() => {
      let cur = save;
      const t0 = cur.pile[cur.pile.length - 1];
      let options = cur.hands.mylo.filter(c => fits(c, t0));
      if (!options.length) {
        cur = draw(cur, 'mylo');
        options = cur.hands.mylo.filter(c => fits(c, t0));
        if (!options.length) { commit(end(cur)); return; }
      }
      const count = (col: Colour) => cur.hands.mylo.filter(c => c.colour === col).length;
      const card = options.sort((a, b) => count(b.colour) - count(a.colour) || b.n - a.n)[0];
      if (cur.hands.mylo.length === 2 && Math.random() < 0.9) cur = { ...cur, rushed: true };
      commit(playCard(cur, 'mylo', card).next);
    }, 1100);
    return () => clearTimeout(t);
  }, [save, commit]);

  // Where things fly from and to.
  const deckRef = useRef<HTMLImageElement>(null);
  const seatRef = useRef<HTMLDivElement>(null);
  const pileRef = useRef<HTMLDivElement>(null);
  const handRef = useRef<HTMLDivElement>(null);
  const played = useRef<Map<string, DOMRect>>(new Map());
  const seen = useRef<{ top: string; hand: Set<string> } | null>(null);
  useLayoutEffect(() => {
    const before = seen.current;
    seen.current = { top: top.id, hand: new Set(mine.map(c => c.id)) };
    if (lessMotion()) return;
    // The pile: a card from your hand, or one Mylo put down.
    if (before && before.top !== top.id) {
      const el = pileRef.current?.querySelector('.is-top');
      const from = played.current.get(top.id) ?? seatRef.current?.getBoundingClientRect();
      flyFrom(el, from, { scale: true, rotate: played.current.has(top.id) ? -10 : 14, duration: 420 });
      played.current.delete(top.id);
    }
    // New cards in your hand come off the deck; a new round deals them one by one.
    const deck = deckRef.current?.getBoundingClientRect();
    const fresh = mine.filter(c => !before?.hand.has(c.id));
    fresh.forEach((c, k) => {
      const el = handRef.current?.querySelector(`[data-card="${c.id}"]`);
      flyFrom(el, deck, { scale: true, rotate: -18, duration: 460, delay: before ? k * 90 : 120 + k * 70 });
    });
  });

  const tapCard = (c: Card, el: HTMLElement) => {
    if (!yourTurn) return;
    if (!fits(c, top)) { showToast(`Match ${top.colour} or ${top.n}`); el.animate([{ translate: '0 0' }, { translate: '-6px 0' }, { translate: '6px 0' }, { translate: '0 0' }], { duration: 260, composite: 'add' }); return; }
    played.current.set(c.id, el.getBoundingClientRect());
    const { next, penalty } = playCard(save, 'you', c);
    if (penalty) showToast('No Rush! Draw two.');
    commit(next);
  };
  const tapDraw = () => {
    if (!yourTurn || save.drew) return;
    const next = { ...draw(save, 'you'), drew: true };
    const got = next.hands.you[next.hands.you.length - 1];
    setSave(next);
    if (!fits(got, top)) setTimeout(() => setSave(s => (s.turn === 'you' && s.drew && !s.winner ? end(s) : s)), 700);
  };
  const rush = () => { if (yourTurn && mine.length === 2 && !save.rushed) { setSave({ ...save, rushed: true }); showToast('Rush!'); } };

  // The hand as a fan that fits the screen.
  const spread = Math.min(46, mine.length > 1 ? 216 / (mine.length - 1) : 0);
  const width = spread * (mine.length - 1) + 84;
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-game ax-rush">
      <Head title={`Colour Rush · round ${save.round}`} fallback="/games"
            right={<button type="button" className="ax-more is-soft" aria-label="More" onClick={() => setMenu(true)}><Icon name="apps/i-more" size={22} /></button>} />
      <div className="ax-rush-players">
        <div ref={seatRef} className={`ax-rush-player${save.turn === 'mylo' && !save.winner ? ' is-turn' : ''}`}>
          <Avatar name={VS} size={36} tint="var(--tint-green)" />
          <span className="ax-13 ax-600">{VS}</span>
          <span className="ax-11 c-2 ax-count" key={save.hands.mylo.length}>{save.hands.mylo.length} {save.hands.mylo.length === 1 ? 'card' : 'cards'}</span>
        </div>
      </div>
      <div className="ax-rush-table">
        <button type="button" className="ax-rush-draw" onClick={tapDraw} disabled={!yourTurn || save.drew} aria-label="Draw a card">
          <img ref={deckRef} src="/figma/apps/rush-back.svg" alt="" width={99} height={135} />
          <span className="ax-12 ax-600 c-2">Draw</span>
        </button>
        <div ref={pileRef} className="ax-rush-pile" aria-label={`Top card ${top.colour} ${top.n}`}>
          {save.pile.length > 1 && <RushCard card={save.pile[save.pile.length - 2]} className="is-under" />}
          <RushCard card={top} key={top.id} className="is-top" />
        </div>
      </div>
      <p className="ax-rush-match"><span className="ax-chip-static">Match {top.colour} or {top.n}</span></p>
      <div ref={handRef} className="ax-hand" style={{ width }} role="list" aria-label="Your hand">
        {mine.map((c, i) => {
          const ok = yourTurn && fits(c, top);
          const mid = (mine.length - 1) / 2;
          return (
            <button key={c.id} type="button" role="listitem" data-card={c.id} className={`ax-hand-card${ok ? ' is-ok' : ''}`} onClick={e => tapCard(c, e.currentTarget)}
                    aria-label={`${c.colour} ${c.n}${ok ? ', playable' : ''}`}
                    style={{ left: i * spread, rotate: `${(i - mid) * 5}deg`, translate: `0 ${Math.abs(i - mid) * 5 - (ok ? 28 : 0)}px`, zIndex: i }}>
              <RushCard card={c} />
            </button>
          );
        })}
      </div>
      <div className="ax-rush-foot">
        <p className="t-body ax-600">{save.winner ? '' : yourTurn ? `Your turn · 0:${String(left).padStart(2, '0')}` : `${VS}’s turn`}</p>
        <button type="button" className={`ax-btn ax-rush-btn${save.rushed && yourTurn ? ' is-pressed' : ''}`} onClick={rush}
                disabled={!yourTurn || mine.length !== 2 || save.rushed}>Rush!</button>
      </div>
      {toast}
      <Sheet open={!!save.winner} onClose={() => setSave(deal(save.round + 1, save.wins))}
             title={save.winner === 'you' ? `You take round ${save.round}` : `${VS} takes round ${save.round}`} sub={`You ${save.wins.you}, ${VS} ${save.wins.mylo}.`}>
        {save.winner && <img className="ax-sticker ax-round-sticker" src={save.winner === 'you' ? '/figma/apps/mylo-laugh.svg' : '/figma/apps/mylo-sad.svg'} alt="" width={124} height={124} />}
        <button type="button" className="ax-btn" onClick={() => setSave(deal(save.round + 1, save.wins))}>Next round</button>
      </Sheet>
      <Sheet open={menu} onClose={() => setMenu(false)} title="Colour Rush">
        <div className="ax-menu">
          <button type="button" className="ax-menu-row" onClick={() => { setMenu(false); setSave(deal(1, { you: 0, mylo: 0 })); }}><Icon name="apps/i-repeat" size={22} />Start again</button>
          <Link href="/games" className="ax-menu-row"><Icon name="apps/i-more" size={22} />All games</Link>
        </div>
      </Sheet>
    </main>
  );
}

function RushCard({ card, className = '' }: { card: Card; className?: string }) {
  return (
    <span className={`ax-card ${className}`} style={{ background: HEX[card.colour] }}>
      <span className="ax-card-oval" />
      <span className="ax-card-corner">{card.n}</span>
      <span className="ax-card-n">{card.n}</span>
    </span>
  );
}
