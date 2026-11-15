'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import FigIcon from './FigIcon';
import { Art, bounce, ExploreSlider, reduced, useDrift, useTouchGuard } from './Playground';
import { PLAYGROUND as P, PLAYGROUND_PAGE as PP } from '@/lib/content';

/* Figma "Board · playable (1000 x 1240)" (1134:1261) and the phone's
   "Board · playable (345 x 1170)" (1137:78).

   The phone board is the desktop board at 0.56 with the toys rearranged,
   so every toy is styled in units of its own width (--t, a hundredth of
   the toy over its Figma width): the same toy is right at any size, on
   either board. Positions come from each frame.

   What you can do, which is what "How it plays" promises:
   - tap an egg three times: it wobbles, cracks, and a buddy pops out (each
     egg counts its own taps)
   - drag the key onto the chest, or tap the chest: a card flies out
   - drag an outfit onto Mylo, or tap one: Mylo puts it on
   - tap a task on the Today list: it ticks, with a little confetti
   - tap a pet and a heart floats up; tap Mylo and it jumps; tap the gift
     for confetti; anything else gives a little bounce
   - throw anything and it drifts back; Shake to mix, or swiping the hand
     along the bottom bar, shuffles the board

   On the home page it opens out of the smaller canvas (intro): its pieces
   then pop in from the top down as the board grows.

   Each black tip shows once per visit: it goes when you have done what it
   says, and stays gone until the tab is closed. */

type Spot = [number, number, number, number, number];      // x, y, w, h, rot
type Toy = { key: string; d: Spot; m: Spot | null; kind: string; tw: number; drift?: boolean; float?: number };

/* Positions read off the two frames. tw is the width the toy is drawn at
   in Figma's own component, which its insides are measured against. */
const TOYS: Toy[] = [
  { key: 'dress',     kind: 'dress',     tw: 250, d: [32, 56, 250, 310, 5],   m: [12, 22, 140, 174, 5],   drift: true, float: 0 },
  { key: 'chest',     kind: 'chest',     tw: 230, d: [318, 52, 230, 240, -3], m: [186, 18, 129, 134, -4], drift: true, float: 1.3 },
  { key: 'shake',     kind: 'chip',      tw: 107, d: [476, 30, 107, 30, -8],  m: null },
  { key: 'egg',       kind: 'egg',       tw: 200, d: [574, 68, 200, 250, 4],  m: [18, 206, 112, 140, 4],  drift: true, float: 2.1 },
  { key: 'today',     kind: 'today',     tw: 240, d: [764, 60, 216, 225, -5], m: [196, 200, 121, 126, -5], drift: true, float: .7 },
  { key: 'polaroid',  kind: 'polaroid',  tw: 200, d: [350, 380, 200, 240, 7], m: [198, 380, 112, 134, 6], drift: true, float: 1.8 },
  { key: 'card',      kind: 'card',      tw: 201, d: [590, 336, 201, 295, -12], m: [28, 378, 113, 165, -9], drift: true, float: 2.6 },
  { key: 'gift',      kind: 'gift',      tw: 220, d: [790, 400, 198, 207, 5], m: [214, 662, 111, 116, 5], drift: true, float: 1.1 },
  { key: 'buddy',     kind: 'buddy',     tw: 210, d: [40, 450, 210, 220, -6], m: [14, 640, 118, 123, -6], drift: true, float: 3.1 },
  { key: 'key',       kind: 'key',       tw: 90,  d: [250, 300, 90, 90, 20],  m: [156, 600, 50, 50, 20],  drift: true, float: 2.4 },
  { key: 'note',      kind: 'note',      tw: 180, d: [70, 830, 180, 80, -4],  m: null,                    drift: true, float: .4 },
  { key: 'tray',      kind: 'tray',      tw: 309, d: [40, 700, 309, 86, 2],   m: [14, 806, 216, 60, 2] },
  { key: 'cracker',   kind: 'cracker',   tw: 109, d: [410, 720, 109, 137, -6], m: [26, 886, 61, 76, -6],  drift: true, float: 1.6 },
  { key: 'hatched',   kind: 'hatched',   tw: 140, d: [530, 770, 140, 140, 0], m: [100, 906, 78, 78, 0],   drift: true, float: 2.9 },
  { key: 'cardChest', kind: 'cardChest', tw: 165, d: [700, 640, 165, 242, 8], m: [226, 870, 92, 136, 8],  drift: true, float: .9 },
  { key: 'goldChest', kind: 'goldChest', tw: 154, d: [560, 980, 154, 154, -4], m: null,                   drift: true, float: 2.2 },
  { key: 'pip',       kind: 'pip',       tw: 120, d: [300, 960, 120, 120, 6], m: [84, 1026, 67, 67, 6],   drift: true, float: 1.2 },
  { key: 'momo',      kind: 'momo',      tw: 112, d: [60, 1000, 112, 112, -8], m: [14, 1040, 63, 63, -8], drift: true, float: 3.4 },
  { key: 'zapMint',   kind: 'zapMint',   tw: 112, d: [430, 980, 112, 112, 4], m: [150, 1046, 63, 63, 4],  drift: true, float: .2 },
  { key: 'mylo',      kind: 'mylo',      tw: 200, d: [770, 916, 200, 240, 0], m: [220, 1000, 112, 134, 0] }
];

/* The hints Figma draws on the board: two cursors and four labels. They
   are pictures of what to do, not things to grab. */
const HINTS: { key: string; d: [number, number]; m: [number, number]; kind: 'grab' | 'grabbing' | 'tip'; text?: string }[] = [
  { key: 'grab',     kind: 'grab',     d: [694, 218], m: [88, 294] },
  { key: 'crack',    kind: 'tip',      d: [728, 190], m: [114, 272], text: PP.tips.crack },
  { key: 'grabbing', kind: 'grabbing', d: [670, 466], m: [78, 464] },
  { key: 'drop',     kind: 'tip',      d: [704, 496], m: [108, 488], text: PP.tips.drop },
  { key: 'keyTip',   kind: 'tip',      d: [120, 396], m: [120, 560], text: PP.tips.key },
  { key: 'outfit',   kind: 'tip',      d: [620, 930], m: [150, 970], text: PP.tips.outfit }
];

const LABELS: Record<string, string> = {
  dress: 'Dress up. Tap to change the outfit.',
  chest: 'Wood chest. Tap to open it, or drop the key on it.',
  egg: 'Egg, day 4 of 5. Tap three times to crack it.',
  today: 'Today list.',
  polaroid: 'Photo pinned to the board.',
  card: 'Mylo Queen, a Legendary outfit card.',
  gift: 'Gift a card.',
  buddy: 'Pet Zap.',
  key: 'Key. Drag it onto a chest.',
  note: 'Note.',
  cracker: 'Cracking egg. Tap to crack it.',
  hatched: 'A hatched buddy.',
  cardChest: 'An outfit card from the chest.',
  goldChest: 'Gold chest. Tap to open it, or drop the key on it.',
  pip: 'Pip, a pet.',
  momo: 'Momo, a pet.',
  zapMint: 'Zap, a pet.'
};

const TIP_KEY = 'mylo.pg.tips';
type Tip = 'crack' | 'drop' | 'keyTip' | 'outfit';
// The cursor drawings go with the tip beside them.
const TIP_OF: Record<string, Tip> = { grab: 'crack', crack: 'crack', grabbing: 'drop', drop: 'drop', keyTip: 'keyTip', outfit: 'outfit' };

type Burst = { id: number; x: number; y: number };
type Egg = 'egg' | 'cracker';
const PETS = new Set(['buddy', 'pip', 'momo', 'zapMint', 'hatched']);

const noop = () => () => {};
function readTips() { try { return sessionStorage.getItem(TIP_KEY) || '[]'; } catch { return '[]'; } }
function parseTips(raw: string): Tip[] { try { return JSON.parse(raw); } catch { return []; } }

function overlaps(a: DOMRect, b: DOMRect) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export default function PlaygroundBoard({ intro = false }: { intro?: boolean }) {
  const board = useRef<HTMLDivElement>(null);
  useTouchGuard(board);
  const [fit, setFit] = useState(0);                 // dress-up swatch
  const [eggs, setEggs] = useState<Record<Egg, number>>({ egg: 0, cracker: 0 });   // 0..3, 3 is hatched
  const [opened, setOpened] = useState(0);           // chest: bumps on each open
  const [outfit, setOutfit] = useState<string | null>(null);
  const [ticked, setTicked] = useState(() => P.today.rows.map(r => r.done));
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [hearts, setHearts] = useState<Burst[]>([]);
  const [retired, setRetired] = useState<Set<Tip>>(new Set());
  const burstId = useRef(0);
  const dress = P.dressUp.outfits[fit];

  // Tips already retired earlier in this visit, from sessionStorage. The
  // server has none, so every tip is in the first HTML.
  const stored = useSyncExternalStore(noop, readTips, () => '[]');
  const done = new Set<Tip>([...parseTips(stored), ...retired]);
  const retire = (tip: Tip) => setRetired(prev => {
    if (prev.has(tip)) return prev;
    const next = new Set(prev).add(tip);
    try { sessionStorage.setItem(TIP_KEY, JSON.stringify([...new Set([...parseTips(readTips()), ...next])])); } catch { /* storage blocked */ }
    return next;
  });

  // Something short-lived over an element (confetti, a heart), placed in
  // board pixels and gone after its animation.
  const spawn = (set: typeof setBursts, el: Element, at = .5, ms = 900) => {
    const b = board.current?.getBoundingClientRect(), r = el.getBoundingClientRect();
    if (!b) return;
    const id = ++burstId.current;
    set(list => [...list, { id, x: r.left + r.width / 2 - b.left, y: r.top + r.height * at - b.top }]);
    window.setTimeout(() => set(list => list.filter(x => x.id !== id)), ms);
  };
  const burstAt = (el: Element) => spawn(setBursts, el);

  // Each egg counts its own taps, in a ref as well, so taps quicker than a
  // render still count one each.
  const tapsRef = useRef<Record<Egg, number>>({ egg: 0, cracker: 0 });
  const crack = (el: Element, egg: Egg) => {
    retire('crack');
    const next = tapsRef.current[egg] >= 3 ? 0 : tapsRef.current[egg] + 1;   // past 3: tapping the buddy resets
    tapsRef.current = { ...tapsRef.current, [egg]: next };
    setEggs(tapsRef.current);
    if (next === 3) window.setTimeout(() => burstAt(el), 120);
  };
  const openChest = () => { setOpened(n => n + 1); retire('keyTip'); };
  const wear = (k: string) => { setOutfit(k); retire('outfit'); };
  const tick = (row: Element) => {
    const i = Number((row as HTMLElement).dataset.row);
    setTicked(list => list.map((v, j) => (j === i ? !v : v)));
    if (!ticked[i]) burstAt(row);
  };

  const rectOf = (k: string) =>
    board.current?.querySelector<HTMLElement>(`[data-key="${k}"]`)?.getBoundingClientRect();

  const tap = (el: HTMLElement, target: Element) => {
    const k = el.dataset.key;
    if (k === 'egg' || k === 'cracker') crack(el, k);
    else if (k === 'chest' || k === 'goldChest') { openChest(); bounce(el); }
    else if (k === 'dress') setFit(f => (f + 1) % P.dressUp.outfits.length);
    else if (k === 'today') {
      const row = target.closest('[data-row]') ?? board.current?.querySelector(`[data-key="today"] [data-row="${ticked.indexOf(false)}"]`);
      if (row) tick(row);
    }
    else if (k?.startsWith('outfit-')) wear(k.slice(7));
    else if (k && PETS.has(k)) { spawn(setHearts, el, .2, 1100); bounce(el, 'jump'); }
    else if (k === 'mylo') bounce(el, 'jump');
    else if (k === 'gift') { burstAt(el); bounce(el); }
    else if (k === 'note' || k === 'polaroid') bounce(el, 'wiggle');
    else bounce(el);
  };

  // Opening out of the home canvas: every piece pops in, top row first.
  useEffect(() => {
    const root = board.current;
    if (!intro || !root || reduced()) return;
    const pieces = [...root.querySelectorAll<HTMLElement>(':scope > .pgp-toy, :scope > .pgp-hint, :scope > .pgp-controls')]
      .filter(el => el.offsetParent)
      .map(el => ({ el, top: el.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top);
    pieces.forEach(({ el }, i) => {
      const timing = { duration: 560, delay: 80 + i * 38, fill: 'backwards' as const };
      el.animate([{ transform: 'translateY(32px) scale(.82)' }, { transform: 'none' }],
                 { ...timing, easing: 'cubic-bezier(.34,1.56,.64,1)', composite: 'add' });
      el.animate([{ opacity: 0 }, { opacity: 1 }], { ...timing, duration: 300, easing: 'ease-out' });
    });
  }, [intro]);

  const { onPointerDown, shake } = useDrift({
    onTap: tap,
    onDrop: el => {
      retire('drop');
      const k = el.dataset.key;
      const r = el.getBoundingClientRect();
      if (k === 'key') {
        const hit = ['chest', 'goldChest'].find(c => { const cr = rectOf(c); return cr && cr.width && overlaps(r, cr); });
        if (hit) { openChest(); bounce(board.current!.querySelector(`[data-key="${hit}"]`)!); }
      }
      if (k?.startsWith('outfit-')) {
        const m = rectOf('mylo');
        if (m && overlaps(r, m)) wear(k.slice(7));
      }
    }
  });

  const onKey = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    tap(e.currentTarget, e.target as Element);
  };

  const body = (t: Toy) => {
    switch (t.kind) {
      case 'dress': return (
        <>
          <span className="pgp-stage" style={{ '--a': dress.stage[0], '--b': dress.stage[1] } as React.CSSProperties}>
            <img loading="lazy" decoding="async" src={`/figma/${dress.shot}.svg`} alt="" />
          </span>
          <span className="pgp-dress-title">{P.dressUp.title}</span>
          <span className="pgp-dress-hint">{P.dressUp.hint}</span>
          <span className="pgp-swatches">
            {P.dressUp.outfits.map((o, i) => (
              <button key={o.swatch} type="button" aria-label={`Try ${o.name}`} aria-pressed={i === fit}
                      className={i === fit ? 'is-on' : undefined} style={{ background: o.swatch }}
                      onPointerDown={e => e.stopPropagation()} onClick={() => setFit(i)} />
            ))}
          </span>
        </>
      );
      case 'chest': return (
        <Art eager src="/figma/pg-chest.svg" cx={47.48} cy={45.58} w={69.57} unTilt={4} />
      );
      case 'chip': return <><FigIcon name="hand" />{P.shakeMe}</>;
      case 'egg': {
        const taps = eggs.egg;
        return (
        <>
          <span key={taps} className={`pgp-egg-art${taps > 0 && taps < 3 ? ' pgp-wobble' : ''}${taps >= 3 ? ' pgp-gone' : ''}`}>
            <Art eager src="/figma/pg-egg.svg" cx={50} cy={42} w={65.25} unTilt={-4} />
          </span>
          {taps > 0 && taps < 3 && <span className={`pgp-crack pgp-crack-${taps}`} aria-hidden />}
          {taps >= 3 && <span className="pgp-pop" style={{ position: 'absolute', inset: 0 }}><Art eager src="/figma/pgp-hatched.svg" cx={50} cy={42} w={62} unTilt={-4} /></span>}
          <span className="pgp-egg-day">{taps >= 3 ? 'Hatched!' : P.eggDay}</span>
        </>
        );
      }
      case 'today': return (
        <>
          <span className="pgp-today-title">{P.today.title}</span>
          <ul className="pgp-today-list">
            {P.today.rows.map((r, i) => (
              <li key={r.text} data-row={i} className={ticked[i] ? 'is-done' : undefined}>
                <span role="checkbox" aria-checked={ticked[i]} tabIndex={0} className="pgp-row"
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); tick(e.currentTarget.parentElement!); } }}>
                  <span className="pgp-check">{ticked[i] && <FigIcon name="check" />}</span>{r.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      );
      case 'polaroid': return (
        <>
          <Art eager src="/figma/pg-photo.svg" cx={50} cy={43.33} w={96.5} unTilt={-7} />
          <Art eager src="/figma/pg-pin.svg" cx={50} cy={2.5} w={23.25} unTilt={-7} />
          <span className="pgp-caption">{P.polaroid}</span>
        </>
      );
      case 'card': return <Art eager src="/figma/pg-card.svg" alt="A Legendary outfit card: Mylo Queen." cx={50} cy={50} w={119.47} unTilt={8} />;
      case 'gift': return (
        <>
          <span className="pgp-gift-box"><FigIcon name="gift" /></span>
          <span className="pgp-gift-title">{P.gift.title}</span>
          <span className="pgp-gift-to"><span className="pgp-avatar">{P.gift.initial}</span>{P.gift.to}</span>
        </>
      );
      case 'buddy': return (
        <>
          <Art eager src="/figma/pg-zap.svg" cx={50} cy={45.45} w={74.52} unTilt={7} />
          <span className="pgp-heart">♥</span>
          <span className="pgp-pet-name">{P.petName}</span>
        </>
      );
      case 'key': return <Art eager src="/figma/pg-key.svg" cx={50} cy={50} w={128.33} unTilt={-20} />;
      case 'note': return <span className="pgp-note-text">{P.note}</span>;
      case 'tray': return (
        <>
          <span className="pgp-tray-label">{PP.tryOn}</span>
          {PP.outfits.map(o => (
            <span key={o.key} data-key={`outfit-${o.key}`} data-drift className="pgp-tile"
                  role="button" tabIndex={0} aria-label={`Put ${o.name} on Mylo`}
                  onPointerDown={e => { e.stopPropagation(); onPointerDown(e); }}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); wear(o.key); } }}>
              <img loading="lazy" decoding="async" src={`/figma/${o.mini}.svg`} alt="" />
              <span className="pgp-tile-name">{o.name}</span>
              <span className="pgp-tile-dot" style={{ background: o.rarity }} />
            </span>
          ))}
        </>
      );
      case 'cracker': {
        const taps = eggs.cracker;
        return taps >= 3
          ? <span className="pgp-pop" style={{ position: 'absolute', inset: 0 }}><Art eager src="/figma/pgp-hatched.svg" cx={50} cy={58} w={128} unTilt={6} /></span>
          : (
            <span key={taps} className={taps > 0 ? 'pgp-wobble' : undefined} style={{ position: 'absolute', inset: 0 }}>
              <Art eager src="/figma/pgp-egg-crack.svg" cx={50} cy={50} w={112.84} unTilt={6} />
            </span>
          );
      }
      case 'hatched': return <Art eager src="/figma/pgp-hatched.svg" cx={50} cy={50} w={100} unTilt={0} />;
      case 'cardChest': return <Art eager src="/figma/pgp-card-chest.svg" cx={50} cy={50} w={119.7} unTilt={-8} />;
      case 'goldChest': return (
        <Art eager src="/figma/pgp-gold-chest.svg" cx={50} cy={50} w={106.82} unTilt={4} />
      );
      case 'pip': return <Art eager src="/figma/pgp-pip-tiger.svg" cx={50} cy={50} w={110} unTilt={-6} />;
      case 'momo': return <Art eager src="/figma/pgp-momo-galaxy.svg" cx={50} cy={50} w={112.95} unTilt={8} />;
      case 'zapMint': return <Art eager src="/figma/pgp-zap-mint.svg" cx={50} cy={50} w={107.14} unTilt={-4} />;
      case 'mylo': {
        const o = PP.outfits.find(x => x.key === outfit);
        return <img loading="lazy" decoding="async" key={outfit ?? 'gala'} src={o ? o.big : '/figma/pgp-mylo-gala.svg'} alt={o ? `Mylo wearing ${o.name}` : 'Mylo'}
                    className={`pgp-mylo-img${outfit ? ' pgp-pop' : ''}`} />;
      }
    }
    return null;
  };

  return (
    <>
      {/* On the home page the board opens inside its section, which has its
          own heading; the tools row is the Playground page's. */}
      {!intro && <div className="pgp-tools" role="group" aria-label="Board">
        {PP.tools.map((label, i) => (
          i === 2
            ? <button key={label} type="button" className="pgp-tool" onClick={() => shake(board.current)}>{label}</button>
            : <span key={label} className={`pgp-tool${i === 0 ? ' is-on' : ''}`}>{label}</span>
        ))}
      </div>}

      <div ref={board} className={`pgp-board${intro ? ' pgp-board-embed' : ''}`} data-board="">
        {TOYS.map(t => {
          const m = t.m ?? t.d;
          const hatched = (t.kind === 'egg' || t.kind === 'cracker') && eggs[t.kind] >= 3;
          const label = hatched ? 'A hatched buddy. Tap to reset the egg.' : LABELS[t.kind];
          return (
            <div
              key={t.key}
              data-key={t.key}
              data-drift={t.drift ? '' : undefined}
              onPointerDown={t.drift ? onPointerDown : undefined}
              // The dress card holds its own swatch buttons; every other
              // moving toy is a button itself.
              role={t.drift && t.kind !== 'dress' ? 'button' : undefined}
              tabIndex={t.drift && t.kind !== 'dress' ? 0 : undefined}
              onKeyDown={t.drift && t.kind !== 'dress' ? onKey : undefined}
              className={`pgp-toy pgp-${t.kind}${t.m ? '' : ' pgp-wide-only'}${t.drift ? ' is-drift' : ''}`}
              style={{
                '--dx2': t.d[0], '--dy2': t.d[1], '--dw': t.d[2], '--dh': t.d[3], '--dr': `${t.d[4]}deg`,
                '--mx': m[0], '--my': m[1], '--mw': m[2], '--mh': m[3], '--mr': `${m[4]}deg`,
                '--tw': t.tw, '--float': `${t.float ?? 0}s`
              } as React.CSSProperties}
            >
              {/* The toy's name comes from its content, so whatever text it
                  shows is part of what a screen reader hears. */}
              {t.drift && t.kind !== 'dress' && <span className="sr-only">{label}</span>}
              {body(t)}
            </div>
          );
        })}

        {/* The card that flies out of the chest, re-keyed each time so the
            flight plays again. */}
        {opened > 0 && (
          <img loading="lazy" decoding="async" key={opened} src="/figma/pgp-card-chest.svg" alt="" aria-hidden className="pgp-flyout" />
        )}

        {hearts.map(h => (
          <span key={h.id} className="pgp-heart-pop" aria-hidden style={{ left: h.x, top: h.y }}>♥</span>
        ))}

        {bursts.map(b => (
          <span key={b.id} className="pgp-burst" aria-hidden style={{ left: b.x, top: b.y }}>
            {Array.from({ length: 10 }, (_, i) => <i key={i} style={{ '--a': `${i * 36}deg` } as React.CSSProperties} />)}
          </span>
        ))}

        {HINTS.map(h => (
          <span key={h.key} aria-hidden className={`pgp-hint pgp-hint-${h.kind}${done.has(TIP_OF[h.key]) ? ' is-gone' : ''}`}
                style={{ '--dx2': h.d[0], '--dy2': h.d[1], '--mx': h.m[0], '--my': h.m[1] } as React.CSSProperties}>
            {h.kind === 'tip'
              ? h.text
              : <img loading="lazy" decoding="async" src={`/figma/pgp-cursor-${h.kind}.png`} alt="" />}
          </span>
        ))}

        <ExploreSlider className="pgp-controls" again label="Mix the board up" onDone={() => shake(board.current)} />
      </div>
    </>
  );
}
