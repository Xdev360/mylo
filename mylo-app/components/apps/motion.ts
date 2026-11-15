'use client';

import { flushSync } from 'react-dom';

/* Motion the playful screens share (apps, Mylo's world, rewards).

   - `morph(update)` swaps what a screen shows in place, as one moment: the
     old picture fades as the new one rises, and anything carrying the same
     `view-transition-name` on both sides (the chess board, a chest) moves
     between them. The look is in styles/apps.css under data-nav="moment".
   - `flyFrom(el, rect)` makes an element arrive from where something else
     was (a card from the hand to the pile, a piece from its old square).
   - Everything is skipped when the person asks for less motion. */

export const lessMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

type VTDoc = Document & { startViewTransition?: (cb: () => void | Promise<void>) => { finished: Promise<void> } };

export function morph(update: () => void) {
  const d = document as VTDoc;
  if (!d.startViewTransition || lessMotion()) { update(); return; }
  const root = document.documentElement;
  const prev = root.dataset.nav;
  root.dataset.nav = 'moment';
  try {
    const t = d.startViewTransition(() => { flushSync(update); });
    t.finished.catch(() => {}).finally(() => {
      if (root.dataset.nav !== 'moment') return;
      if (prev) root.dataset.nav = prev; else delete root.dataset.nav;
    });
  } catch {
    if (prev) root.dataset.nav = prev; else delete root.dataset.nav;
    update();
  }
}

export function flyFrom(el: Element | null | undefined, from: DOMRect | null | undefined, opts: {
  duration?: number; delay?: number; easing?: string; scale?: boolean; rotate?: number; fade?: boolean;
} = {}) {
  if (!el || !from || lessMotion()) return null;
  const to = el.getBoundingClientRect();
  if (!to.width) return null;
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const s = opts.scale ? from.width / to.width : 1;
  return el.animate([
    { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(${opts.rotate ?? 0}deg)`, opacity: opts.fade ? 0 : 1 },
    { transform: 'none', opacity: 1 }
  ], { duration: opts.duration ?? 360, delay: opts.delay ?? 0, easing: opts.easing ?? 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' });
}

/* A quick squash and stretch, for "something about this just changed". */
export function bump(el: Element | null | undefined, amount = 0.05) {
  if (!el || lessMotion()) return;
  el.animate([
    { scale: '1 1' }, { scale: `${1 + amount} ${1 - amount}` }, { scale: `${1 - amount / 2} ${1 + amount / 2}` }, { scale: '1 1' }
  ], { duration: 420, easing: 'cubic-bezier(.34,1.56,.64,1)' });
}

/* Waits, unless motion is off. */
export const pause = (ms: number) => new Promise<void>(r => setTimeout(r, lessMotion() ? 0 : ms));
