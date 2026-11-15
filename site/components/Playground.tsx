'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ComponentType } from 'react';
import FigIcon from './FigIcon';
import { PLAYGROUND as P } from '@/lib/content';

/* Figma frames "06 Playground" (887:3843) and its mobile twin
   (887:188611): a dotted canvas with toys scattered across it.

   The handoff asks for three things here, pieces drag with momentum and
   spring back after 1.5 seconds, tapping a Mylo changes its outfit, and
   with prefers-reduced-motion there is no float and no drift, tap only.

   Each toy carries its place on both canvases and every length is a
   multiple of --u, a hundredth of the canvas width over its design width,
   so the whole arrangement scales as one object. The canvas clips: the
   list at the right edge is meant to run off it.

   "Drag to explore" is a slider: hold the hand at its left end and swipe it
   to the arrow, and the canvas opens up into the full playable board from
   the Playground page, which grows to its height while its pieces pop in
   from the top down. */

type Spot = { x: number; y: number; w: number; h: number; r: number };

/* An export from inside a tilted toy comes out with the toy's tilt already
   baked in, its file is the bounding box of the rotated art, bigger than
   the art itself. Turning it back by the toy's own Figma tilt and centring
   it on the art's centre puts it exactly where Figma has it, and the toy's
   rotation then applies once, not twice. Numbers are percentages of the
   toy's desktop box, so the same art sits right on the phone canvas. */
export function Art({ src, alt = '', cx, cy, w, unTilt, eager = false }: {
  src: string; alt?: string; cx: number; cy: number; w: number; unTilt: number; eager?: boolean;
}) {
  return (
    <img loading={eager ? 'eager' : 'lazy'} decoding="async" src={src} alt={alt} aria-hidden={alt ? undefined : true} className="pg-art"
         style={{ '--cx': `${cx}%`, '--cy': `${cy}%`, '--w': `${w}%`, '--k': `${unTilt}deg` } as React.CSSProperties} />
  );
}
type Toy = {
  key: string;
  d: Spot;
  m: Spot | null;              // null: wide screens only
  className?: string;
  float?: number;              // seconds of drift offset, so they differ
  children: React.ReactNode;
};

/* A dragged toy lifts (a little bigger, upright, with the floating shadow),
   follows the pointer and stays inside its board. Let go with speed and it
   keeps going, easing to a stop; after 1.5s idle it springs back home.

   A press that barely moves is a tap, not a drag: it calls onTap with the
   toy and the element pressed, and the toy stays put. A real drag calls
   onDrop on release, before the throw, so a board can ask what it landed on.

   On touch a drag starts only after a 150ms press, so a swipe across a toy
   still scrolls the page. With reduced motion there is no throw and the
   way home is instant.

   Everything moves through `translate`, `rotate` and `scale`: compositor
   work only, nothing that makes the page lay out again. */
const HOME_AFTER = 1500;

/* A non-passive touchmove listener on the board, there from the start, so
   the browser has to ask before it scrolls a touch that began on a toy. It
   only says no while a toy is armed or held; every other swipe scrolls. */
export function useTouchGuard(board: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = board.current;
    if (!el) return;
    const guard = (e: TouchEvent) => { if (el.querySelector('.is-armed, .is-held')) e.preventDefault(); };
    el.addEventListener('touchmove', guard, { passive: false });
    return () => el.removeEventListener('touchmove', guard);
  }, [board]);
}
const HOLD_MS = 150;

export const reduced = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* A one-off bounce on a toy. Web Animations with composite 'add', so it
   plays on top of the toy's float and its drag position instead of
   replacing them, and it needs no class to clean up afterwards. */
export function bounce(el: Element, kind: 'bump' | 'jump' | 'wiggle' = 'bump') {
  if (reduced() || !el.animate) return;
  const frames: Record<string, Keyframe[]> = {
    bump: [{ transform: 'scale(1)' }, { transform: 'scale(1.1) rotate(-3deg)', offset: .3 }, { transform: 'scale(.97)', offset: .65 }, { transform: 'scale(1)' }],
    jump: [{ transform: 'translateY(0)' }, { transform: 'translateY(-18%) scale(1.04,.96)', offset: .35 }, { transform: 'translateY(0) scale(1.06,.92)', offset: .7 }, { transform: 'translateY(0)' }],
    wiggle: [{ transform: 'rotate(0)' }, { transform: 'rotate(-6deg)', offset: .25 }, { transform: 'rotate(5deg)', offset: .55 }, { transform: 'rotate(-2deg)', offset: .8 }, { transform: 'rotate(0)' }]
  };
  el.animate(frames[kind], { duration: kind === 'jump' ? 620 : 500, easing: 'cubic-bezier(.34,1.56,.64,1)', composite: 'add' });
}

function place(el: HTMLElement, x: number, y: number) {
  el.dataset.dx = String(x); el.dataset.dy = String(y);
  el.style.setProperty('--dx', `${x}px`);
  el.style.setProperty('--dy', `${y}px`);
}

export function useDrift(opts: {
  onTap?: (el: HTMLElement, target: Element) => void;
  onDrop?: (el: HTMLElement) => void;
  onMove?: () => void;
} = {}) {
  const optsRef = useRef(opts);
  useLayoutEffect(() => { optsRef.current = opts; });
  const timers = useRef(new Map<HTMLElement, number>());

  const goHome = useCallback((el: HTMLElement, delay = HOME_AFTER) => {
    const old = timers.current.get(el);
    if (old) clearTimeout(old);
    const id = window.setTimeout(() => {
      el.style.transition = reduced() ? 'none' : 'translate 1.1s cubic-bezier(.34,1.3,.5,1)';
      place(el, 0, 0);
      timers.current.delete(el);
    }, delay);
    timers.current.set(el, id);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const target = e.target as Element;
    const timer = timers.current.get(el);
    if (timer) { clearTimeout(timer); timers.current.delete(el); }

    const pointerId = e.pointerId;
    const touch = e.pointerType === 'touch';
    const startX = e.clientX, startY = e.clientY;
    const from = { x: +(el.dataset.dx ?? 0), y: +(el.dataset.dy ?? 0) };

    // How far it may go: inside the board, or no further out than it is now.
    const boardEl = el.closest<HTMLElement>('[data-board]') ?? el.parentElement!;
    const b = boardEl.getBoundingClientRect(), r = el.getBoundingClientRect();
    const lim = {
      x0: Math.min(from.x, from.x - (r.left - b.left)), x1: Math.max(from.x, from.x + (b.right - r.right)),
      y0: Math.min(from.y, from.y - (r.top - b.top)),   y1: Math.max(from.y, from.y + (b.bottom - r.bottom))
    };
    const clampX = (n: number) => Math.max(lim.x0, Math.min(lim.x1, n));
    const clampY = (n: number) => Math.max(lim.y0, Math.min(lim.y1, n));

    let armed = !touch, dragging = false;
    let last = { x: from.x, y: from.y, t: performance.now() }, vx = 0, vy = 0;

    const lift = () => {
      dragging = true;
      try { el.setPointerCapture(pointerId); } catch { /* already released */ }
      el.classList.add('is-held');
      boardEl.classList.add('is-dragging');
      el.style.transition = 'rotate .18s ease, scale .18s ease';
      optsRef.current.onMove?.();
    };

    // After the hold the toy is armed: the board's touch guard (useTouchGuard)
    // then keeps the page from scrolling under the drag.
    const hold = touch ? window.setTimeout(() => { armed = true; el.classList.add('is-armed'); }, HOLD_MS) : 0;

    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - startX, dy = ev.clientY - startY;
      if (!dragging) {
        if (Math.hypot(dx, dy) < 6) return;
        if (!armed) { cleanup(); return; }     // a swipe before the hold: let it scroll
        lift();
      }
      const x = clampX(from.x + dx), y = clampY(from.y + dy);
      const now = performance.now(), dt = Math.max(1, now - last.t);
      vx = vx * .6 + ((x - last.x) / dt) * .4;   // smoothed px per ms
      vy = vy * .6 + ((y - last.y) / dt) * .4;
      last = { x, y, t: now };
      el.style.setProperty('--dx', `${x}px`);
      el.style.setProperty('--dy', `${y}px`);
    };

    const cleanup = () => {
      clearTimeout(hold);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', cancel);
      el.classList.remove('is-held', 'is-armed');
      boardEl.classList.remove('is-dragging');
    };

    const cancel = () => {
      const wasDragging = dragging;
      cleanup();
      if (wasDragging) { place(el, last.x, last.y); goHome(el); }
    };

    const up = (ev: PointerEvent) => {
      const wasDragging = dragging;
      cleanup();
      if (!wasDragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 6) optsRef.current.onTap?.(el, target);
        return;
      }
      optsRef.current.onDrop?.(el);

      // Released moving: it carries on about 220ms worth of its speed and
      // eases to a stop, still inside the board. Released still: it stays.
      const idle = performance.now() - last.t > 80;
      const fling = reduced() || idle ? 0 : 220;
      const to = { x: clampX(last.x + vx * fling), y: clampY(last.y + vy * fling) };
      el.style.transition = 'translate .6s cubic-bezier(.16,1,.3,1), rotate .3s ease, scale .3s ease';
      place(el, to.x, to.y);
      goHome(el);
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', cancel);
  }, [goHome]);

  /* Shuffle: every toy jumps a little way in a random direction, inside the
     board, then springs home on the same 1.5s rule. */
  const shake = useCallback((root: HTMLElement | null) => {
    if (!root) return;
    const b = root.getBoundingClientRect();
    root.querySelectorAll<HTMLElement>('[data-drift]').forEach(el => {
      const r = el.getBoundingClientRect();
      const span = Math.min(140, b.width * .14);
      const x = Math.max(b.left - r.left, Math.min(b.right - r.right, (Math.random() - .5) * span * 2));
      const y = Math.max(b.top - r.top, Math.min(b.bottom - r.bottom, (Math.random() - .5) * span * 2));
      const base = { x: +(el.dataset.dx ?? 0), y: +(el.dataset.dy ?? 0) };
      el.style.transition = reduced() ? 'none' : 'translate .45s cubic-bezier(.34,1.56,.64,1)';
      place(el, base.x + x, base.y + y);
      goHome(el);
    });
  }, [goHome]);

  /* Reset: everything straight back home, nothing pending. */
  const reset = useCallback((root: HTMLElement | null) => {
    if (!root) return;
    root.querySelectorAll<HTMLElement>('[data-drift]').forEach(el => {
      const old = timers.current.get(el);
      if (old) { clearTimeout(old); timers.current.delete(el); }
      el.style.transition = reduced() ? 'none' : 'translate .5s cubic-bezier(.22,1,.36,1)';
      place(el, 0, 0);
    });
  }, []);

  return { onPointerDown, shake, reset };
}

/* Slide to open. The knob follows the finger along the pill; let go past
   two thirds and it runs to the end and opens the board, short of that it
   springs back. A press that does not move nudges it along a little, to
   show it slides. Enter or Space opens straight away. With `again` it comes
   back after it fires, ready for the next swipe (the full board uses it to
   mix the pieces up). */
export function ExploreSlider({ onDone, onStart, again = false, label = 'Open the full playground', className = '' }: {
  onDone: () => void; onStart?: () => void; again?: boolean; label?: string; className?: string;
}) {
  const pill = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLButtonElement>(null);
  const done = useRef(false);

  // --p is how far along, 0 to 1; --span is the run in pixels.
  const set = (p: number) => {
    const el = pill.current, k = knob.current;
    if (!el || !k) return;
    el.style.setProperty('--span', `${el.clientWidth - k.offsetWidth - k.offsetLeft * 2}px`);
    el.style.setProperty('--p', String(p));
  };
  const finish = () => {
    if (done.current) return;
    done.current = true;
    set(1);
    window.setTimeout(() => {
      onDone();
      if (again) { done.current = false; set(0); }
    }, reduced() ? 0 : 300);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0 || done.current) return;
    onStart?.();
    const el = pill.current!, k = knob.current!;
    const span = el.clientWidth - k.offsetWidth - k.offsetLeft * 2;
    const x0 = e.clientX;
    let p = 0, moved = false;
    k.setPointerCapture(e.pointerId);
    el.classList.add('is-sliding');
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - x0;
      if (Math.abs(dx) > 4) moved = true;
      p = Math.max(0, Math.min(1, dx / span));
      set(p);
    };
    const up = () => {
      k.removeEventListener('pointermove', move);
      k.removeEventListener('pointerup', up);
      k.removeEventListener('pointercancel', up);
      el.classList.remove('is-sliding');
      if (p > .66) return finish();
      if (!moved && !reduced()) {
        // A tap: show the way, then come back.
        set(.28);
        window.setTimeout(() => set(0), 320);
        return;
      }
      set(0);
    };
    k.addEventListener('pointermove', move);
    k.addEventListener('pointerup', up);
    k.addEventListener('pointercancel', up);
  };

  return (
    <div ref={pill} className={`pg-controls pg-slider ${className}`}>
      <span className="pg-slider-trail" aria-hidden />
      <span className="pg-controls-label" aria-hidden>{P.controls}</span>
      <span className="pg-round pg-slider-end" aria-hidden><FigIcon name="arrow" /></span>
      <button ref={knob} type="button" className="pg-round pg-slider-knob"
              aria-label={label}
              onPointerDown={onPointerDown}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onStart?.(); finish(); } }}>
        <FigIcon name="hand" />
      </button>
    </div>
  );
}

const LABELS: Record<string, string> = {
  dress: 'Dress up card.', chest: 'Wood chest.', shake: 'Shake me.', egg: 'Egg, day 4 of 5.',
  today: 'Today list.', polaroid: 'Photo pinned to the board.', card: 'Mylo Queen, a Legendary outfit card.',
  gift: 'Gift a card.', buddy: 'Pet Zap.', key: 'Key.', note: 'Note.'
};

export default function Playground() {
  const [fit, setFit] = useState(0);
  const [ticked, setTicked] = useState(() => P.today.rows.map(r => r.done));
  const [pop, setPop] = useState(-1);
  const outfit = P.dressUp.outfits[fit];

  const tick = (i: number) => {
    setTicked(list => list.map((v, j) => (j === i ? !v : v)));
    if (!ticked[i]) { setPop(i); window.setTimeout(() => setPop(-1), 900); }
  };
  const tap = (el: HTMLElement, target: Element) => {
    const row = target.closest<HTMLElement>('[data-row]');
    if (row) tick(Number(row.dataset.row));
    else if (el.dataset.key === 'today') tick(Math.max(0, ticked.indexOf(false)));
    else bounce(el);
  };

  // The full board, fetched the moment a finger lands on the canvas so it
  // is usually there by the time the toy is let go.
  const [Board, setBoard] = useState<ComponentType<{ intro?: boolean }> | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const fromHeight = useRef(0);
  const loading = useRef<Promise<unknown> | null>(null);
  const loadBoard = () => (loading.current ??= import('./PlaygroundBoard').then(m => setBoard(() => m.default)));
  const explore = () => {
    if (open) return;
    fromHeight.current = wrap.current?.offsetHeight ?? 0;
    loadBoard().then(() => setOpen(true));
  };
  // Grow from the canvas's height to the board's, once, as it swaps in.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!open || !el || !fromHeight.current || reduced()) return;
    const to = el.offsetHeight;
    el.animate([{ height: `${fromHeight.current}px` }, { height: `${to}px` }],
               { duration: 760, easing: 'cubic-bezier(.22,1,.36,1)' });
    fromHeight.current = 0;
  }, [open]);

  const { onPointerDown } = useDrift({ onTap: tap });
  const canvas = useRef<HTMLDivElement>(null);
  useTouchGuard(canvas);

  const toys: Toy[] = [
    {
      key: 'dress', float: 0,
      d: { x: 40, y: 60, w: 250, h: 310, r: 5 },
      m: { x: 18, y: 34, w: 170, h: 214, r: 5 },
      className: 'pg-card pg-dress',
      children: (
        <>
          {/* The Mylo itself is the tap target, which is the handoff's
              rule and the only way to change the outfit on a phone, the
              swatch row below is wide-screen only, as Figma has it. */}
          <button
            type="button"
            className="pg-stage"
            aria-label={`${P.dressUp.hint}. Wearing ${outfit.name}.`}
            style={{ '--a': outfit.stage[0], '--b': outfit.stage[1] } as React.CSSProperties}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setFit(f => (f + 1) % P.dressUp.outfits.length)}
          >
            <img loading="lazy" decoding="async" src={`/figma/${outfit.shot}.svg`} alt="" />
          </button>
          <span className="pg-title">{P.dressUp.title}</span>
          <span className="pg-sub pg-wide">{P.dressUp.hint}</span>
          <span className="pg-swatches">
            {P.dressUp.outfits.map((o, i) => (
              <button
                key={o.swatch}
                type="button"
                aria-label={`Try ${o.name}`}
                aria-pressed={i === fit}
                className={i === fit ? 'is-on' : undefined}
                style={{ background: o.swatch }}
                onPointerDown={e => e.stopPropagation()}
                onClick={() => setFit(i)}
              />
            ))}
          </span>
        </>
      )
    },
    {
      key: 'chest', float: 1.3,
      d: { x: 330, y: 40, w: 230, h: 240, r: -4 },
      m: { x: 206, y: 30, w: 160, h: 170, r: -5 },
      className: 'pg-card pg-dark-warm',
      children: <Art src="/figma/pg-chest.svg" cx={47.48} cy={45.58} w={69.57} unTilt={4} />
    },
    {
      key: 'shake',
      d: { x: 470, y: 36, w: 107, h: 30, r: -8 },
      m: null,
      className: 'pg-chip',
      children: <><FigIcon name="hand" />{P.shakeMe}</>
    },
    {
      key: 'egg', float: 2.1,
      d: { x: 620, y: 70, w: 200, h: 250, r: 4 },
      m: null,
      className: 'pg-card pg-dark-violet',
      children: (
        <>
          <Art src="/figma/pg-egg.svg" cx={50} cy={42} w={65.25} unTilt={-4} />
          <span className="pg-egg-day">{P.eggDay}</span>
        </>
      )
    },
    {
      key: 'today', float: 0.7,
      d: { x: 840, y: 50, w: 240, h: 250, r: -6 },
      m: null,
      className: 'pg-card pg-list',
      children: (
        <>
          <span className="pg-title pg-list-title">{P.today.title}</span>
          <ul>
            {P.today.rows.map((r, i) => (
              <li key={r.text} data-row={i} className={ticked[i] ? 'is-done' : undefined}>
                <span className="pg-check">
                  {ticked[i] && <FigIcon name="check" />}
                  {pop === i && (
                    <span className="pgp-burst" aria-hidden style={{ left: '50%', top: '50%' }}>
                      {Array.from({ length: 10 }, (_, k) => <i key={k} style={{ '--a': `${k * 36}deg` } as React.CSSProperties} />)}
                    </span>
                  )}
                </span>
                <span role="checkbox" aria-checked={ticked[i]} tabIndex={0}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); tick(i); } }}>
                  {r.text}
                </span>
              </li>
            ))}
          </ul>
        </>
      )
    },
    {
      key: 'polaroid', float: 1.8,
      d: { x: 320, y: 330, w: 200, h: 240, r: 7 },
      m: { x: 190, y: 236, w: 140, h: 170, r: 6 },
      className: 'pg-polaroid',
      children: (
        <>
          <Art src="/figma/pg-photo.svg" cx={50} cy={43.33} w={96.5} unTilt={-7} />
          <Art src="/figma/pg-pin.svg" cx={50} cy={2.5} w={23.25} unTilt={-7} />
          <span className="pg-polaroid-caption">{P.polaroid}</span>
        </>
      )
    },
    {
      key: 'card', float: 2.6,
      d: { x: 560, y: 330, w: 190, h: 279, r: -8 },
      m: { x: 250, y: 420, w: 130, h: 191, r: 8 },
      className: 'pg-queen',
      children: <Art src="/figma/pg-card.svg" alt="A Legendary outfit card: Mylo Queen." cx={50} cy={50} w={119.47} unTilt={8} />
    },
    {
      key: 'gift', float: 1.1,
      d: { x: 790, y: 330, w: 220, h: 230, r: 5 },
      m: null,
      className: 'pg-card pg-gift',
      children: (
        <>
          <span className="pg-gift-box"><FigIcon name="gift" /></span>
          <span className="pg-title">{P.gift.title}</span>
          <span className="pg-gift-to">
            <span className="pg-avatar">{P.gift.initial}</span>{P.gift.to}
          </span>
        </>
      )
    },
    {
      key: 'buddy', float: 3.1,
      d: { x: 60, y: 420, w: 210, h: 220, r: -7 },
      m: { x: 24, y: 280, w: 150, h: 160, r: -6 },
      className: 'pg-card pg-buddy',
      children: (
        <>
          <Art src="/figma/pg-zap.svg" cx={50} cy={45.45} w={74.52} unTilt={7} />
          <span className="pg-heart">♥</span>
          <span className="pg-pet-name pg-wide">{P.petName}</span>
        </>
      )
    },
    {
      key: 'key', float: 2.4,
      d: { x: 560, y: 600, w: 90, h: 90, r: 20 },
      m: { x: 40, y: 470, w: 64, h: 64, r: 18 },
      className: 'pg-key',
      children: <Art src="/figma/pg-key.svg" cx={50} cy={50} w={128.33} unTilt={-20} />
    },
    {
      key: 'note', float: 0.4,
      d: { x: 40, y: 670, w: 180, h: 80, r: -4 },
      m: null,
      className: 'pg-note',
      children: P.note
    }
  ];

  if (open && Board) return <div ref={wrap} className="pg-expand"><Board intro /></div>;

  return (
    <div ref={wrap} className="pg-expand">
    <div ref={canvas} className="pg-canvas" data-board="" onPointerDownCapture={loadBoard}>
      {toys.map(t => (
        <div
          key={t.key}
          data-drift=""
          data-key={t.key}
          // The dress card holds its own buttons; every other toy is one.
          role={t.key === 'dress' ? undefined : 'button'}
          tabIndex={t.key === 'dress' ? undefined : 0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tap(e.currentTarget, e.target as Element); } }}
          onPointerDown={onPointerDown}
          className={`pg-toy ${t.className ?? ''}${t.m ? '' : ' pg-wide-only'}`}
          style={{
            '--dx2': t.d.x, '--dy2': t.d.y, '--dw': t.d.w, '--dh': t.d.h, '--dr': `${t.d.r}deg`,
            '--mx': (t.m ?? t.d).x, '--my': (t.m ?? t.d).y,
            '--mw': (t.m ?? t.d).w, '--mh': (t.m ?? t.d).h, '--mr': `${(t.m ?? t.d).r}deg`,
            '--float': `${t.float ?? 0}s`
          } as React.CSSProperties}
        >
          {t.key !== 'dress' && <span className="sr-only">{LABELS[t.key]}</span>}
          {t.children}
        </div>
      ))}

      {/* Not a control, the design draws a cursor resting on the canvas,
          and it is the clearest hint that the toys move. */}
      <span className="pg-cursor" aria-hidden><FigIcon name="hand" /></span>

      <ExploreSlider onDone={explore} onStart={loadBoard} />
    </div>
    </div>
  );
}
