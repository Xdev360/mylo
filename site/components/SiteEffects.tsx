'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@vercel/analytics';

/* The site-wide bits with no markup of their own.

   · ?ref=CODE on any page is kept, so a signup two pages later still
     carries it.
   · Anything marked data-cta reports a click, by name only: no personal
     data ever goes into an event.
   · "Join the waitlist" scrolls to the form when the page has one, and goes
     to the home page's form when it does not. */

export const REF_KEY = 'mylo.ref';
// Your own referral code, under the key the previous site used on this same
// domain, so someone who joined there is recognised here.
export const OWN_CODE_KEY = 'mylo:waitlist:ref';

export function readStored(key: string) {
  try { return sessionStorage.getItem(key) || localStorage.getItem(key) || ''; } catch { return ''; }
}

/* Panels the pointer lights and moves, and buttons it pulls. */
const LIVE = '.plan-tile,.how-panel,.join-panel,.play-ladder,.play-fair,.safety-card,.tp-topic-link,.bug-side';
const PULLED = '.btn-primary,.btn-secondary';
const MAX_PULL = 6;

export default function SiteEffects() {
  const path = usePathname();

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    try {
      const ref = q.get('ref');
      if (ref && /^[A-Za-z0-9]{4,12}$/.test(ref)) localStorage.setItem(REF_KEY, ref.toUpperCase());
    } catch { /* storage blocked: the signup simply goes without it */ }
  }, [path]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      const el = (e.target as Element | null)?.closest?.('a, button');
      if (!el) return;
      const cta = el.getAttribute('data-cta');
      if (cta) track('cta_click', { cta });

      if (el.getAttribute('href') === '/#join') {
        const form = document.getElementById('join');
        if (form) {
          e.preventDefault();
          form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
          history.replaceState(null, '', '#join');
          setTimeout(() => (document.getElementById('waitlist-email') as HTMLInputElement | null)?.focus({ preventScroll: true }), 500);
        }
      }
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (prefers-reduced-motion: no-preference)').matches) return;
    let target: Element | null = null, x = 0, y = 0, frame = 0;
    let live: HTMLElement | null = null, pulled: HTMLElement | null = null;
    const clear = (el: HTMLElement | null, ...names: string[]) => names.forEach(n => el?.style.removeProperty(n));
    function draw() {
      frame = 0;
      const nextLive = target?.closest<HTMLElement>(LIVE) ?? null;
      if (nextLive !== live) { clear(live, '--nx', '--ny'); live = nextLive; }
      if (live) {
        const r = live.getBoundingClientRect();
        live.style.setProperty('--px', `${x - r.left}px`);
        live.style.setProperty('--py', `${y - r.top}px`);
        live.style.setProperty('--nx', ((x - r.left) / r.width * 2 - 1).toFixed(3));
        live.style.setProperty('--ny', ((y - r.top) / r.height * 2 - 1).toFixed(3));
      }
      const nextPulled = target?.closest<HTMLElement>(PULLED) ?? null;
      if (nextPulled !== pulled) { clear(pulled, '--pull-x', '--pull-y'); pulled = nextPulled; }
      if (pulled) {
        const r = pulled.getBoundingClientRect();
        const pull = (d: number) => Math.round(Math.max(-MAX_PULL, Math.min(MAX_PULL, d * .16))) + 'px';
        pulled.style.setProperty('--pull-x', pull(x - r.left - r.width / 2));
        pulled.style.setProperty('--pull-y', pull(y - r.top - r.height / 2));
      }
    }
    function onMove(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return;
      target = e.target as Element; x = e.clientX; y = e.clientY;
      if (!frame) frame = requestAnimationFrame(draw);
    }
    function onLeave() { target = null; if (!frame) frame = requestAnimationFrame(draw); }
    document.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}
