'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { stampNav } from '@/components/NavMotion';
import { useHydrated } from '@/lib/local';
import { useSession } from '@/lib/session';
import { EMPTY_ONBOARDING, ONBOARDING_KEY, isStep, stepPath, type Onboarding } from '@/lib/signin';
import { Art, Cta, Screen } from './ui';

/* O1 Splash (877:107697), then O2 Welcome (877:107708). The splash shows
   once a visit; a person who is already signed in goes on to Today. */
const SPLASH_KEY = 'mylo.signin.splash';

/* The four sticky notes as O2 draws them: each 118 x 96, turned a little,
   held to its edge of the screen, and set above or below the ring by the
   distance the frame gives from the ring's centre to the note's centre. A
   pin's place is in the note's own (unturned) frame. */
type Note = { text: string; tone: string; side: 'l' | 'r'; edge: number; dy: number; rot: number; pin?: { c: string; x: number; y: number } };
const NOTE_W = 118, NOTE_H = 96;
const NOTES: Note[] = [
  { text: 'Gym at 6. No excuses.', tone: '#FFF1A8', side: 'l', edge: 51.1, dy: -184.65, rot: -8, pin: { c: '#E5484D', x: 49.2, y: 3.7 } },
  { text: 'Read 20 pages', tone: '#FFE0E6', side: 'r', edge: 78.3, dy: -145.15, rot: 7, pin: { c: '#3E7BFA', x: 49.8, y: -10.9 } },
  { text: 'Call mum Sunday', tone: '#E3ECFF', side: 'l', edge: 43.7, dy: 363.9, rot: 6 },
  { text: 'Ship the thing', tone: '#E2F5EA', side: 'r', edge: 48.6, dy: 330.45, rot: -7, pin: { c: '#F5A524', x: 49.35, y: 2.82 } }
];
const SCALES = [1, 0.92, 0.84, 0.76];
const GAP = 8;

type Box = { l: number; t: number; r: number; b: number };
type Placed = { x: number; y: number; s: number } | null;
const hits = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

/* Where each note can sit on this screen. The frame's place first; on a
   shorter screen the notes close up toward the ring and the text, then get a
   little smaller, and a note with no room left stays off. A note never
   covers the title, the line under it, the ring, the buttons or the sign-in
   line. */
function placeNotes(root: HTMLElement, ring: HTMLElement, guard: HTMLElement[], cta: HTMLElement): Placed[] {
  const R = root.getBoundingClientRect();
  const rel = (b: DOMRect): Box => ({ l: b.left - R.left, t: b.top - R.top, r: b.right - R.left, b: b.bottom - R.top });
  const W = R.width;
  const rg = rel(ring.getBoundingClientRect());
  const cx0 = (rg.l + rg.r) / 2, cy0 = (rg.t + rg.b) / 2, rad = (rg.r - rg.l) / 2 + GAP;
  // Text is guarded line by line, so a note can sit beside a short line.
  const keep: Box[] = [];
  for (const el of guard) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const lines = el.tagName === 'BUTTON' ? [] : [...range.getClientRects()];
    for (const b of lines.length ? lines : [el.getBoundingClientRect()]) {
      const x = rel(b);
      keep.push({ l: x.l - GAP, t: x.t - GAP, r: x.r + GAP, b: x.b + GAP });
    }
  }
  const top = parseFloat(getComputedStyle(root).paddingTop) - 8;
  const floor = rel(cta.getBoundingClientRect()).t - GAP - 2;
  const touchesRing = (b: Box) => {
    const px = Math.max(b.l, Math.min(cx0, b.r)), py = Math.max(b.t, Math.min(cy0, b.b));
    return (px - cx0) ** 2 + (py - cy0) ** 2 < rad * rad;
  };

  return NOTES.map(n => {
    const a = (Math.abs(n.rot) * Math.PI) / 180;
    for (const s of SCALES) {
      const hw = ((NOTE_W * Math.cos(a) + NOTE_H * Math.sin(a)) * s) / 2;
      const hh = ((NOTE_W * Math.sin(a) + NOTE_H * Math.cos(a)) * s) / 2;
      const x = n.side === 'l' ? n.edge * s : W - n.edge * s;
      let y = cy0 + n.dy;
      if (n.dy < 0) {
        y = Math.max(y, top + hh);
        // Clear of anything drawn above the ring (the Look around link).
        for (const k of keep) if (k.b < rg.t && hits({ l: x - hw, t: y - hh, r: x + hw, b: y + hh }, k)) y = Math.max(y, k.b + hh);
      } else y = Math.min(y, floor - hh);
      const box = { l: x - hw, t: y - hh, r: x + hw, b: y + hh };
      // A pin standing above its note needs that room too.
      const pinUp = n.pin && n.pin.y < 0 ? -n.pin.y * s : 0;
      if (box.t - pinUp < top) { y += top - (box.t - pinUp); box.t = y - hh; box.b = y + hh; }
      if (box.t - pinUp < top || box.b > floor) continue;
      if (touchesRing(box) || keep.some(k => hits(box, k))) continue;
      return { x, y, s };
    }
    return null;
  });
}

function seenSplash() { try { return sessionStorage.getItem(SPLASH_KEY) === '1'; } catch { return true; } }

/* Get started picks up where the person left off, if they began before. */
function startPath() {
  try {
    const ob: Onboarding = { ...EMPTY_ONBOARDING, ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') };
    if (!ob.done && ob.at && isStep(ob.at)) return stepPath(ob.at);
  } catch { /* fresh start */ }
  return stepPath('want');
}

export default function Welcome({ handFont }: { handFont: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { session, loading } = useSession();
  const [splashDone, setSplashDone] = useState(false);
  const splash = hydrated && !splashDone && !seenSplash();
  const [placed, setPlaced] = useState<Placed[] | null>(null);
  const root = useRef<HTMLElement>(null);
  const ring = useRef<HTMLImageElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const sub = useRef<HTMLParagraphElement>(null);
  const foot = useRef<HTMLElement>(null);
  const line = useRef<HTMLAnchorElement>(null);
  const look = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!splash) return;
    const t = window.setTimeout(() => {
      try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* blocked */ }
      setSplashDone(true);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [splash]);

  useEffect(() => {
    if (!loading && session && !splash) router.replace('/today');
  }, [loading, session, splash, router]);

  const ready = hydrated && !splash;
  useLayoutEffect(() => {
    if (!ready) return;
    const els = [root.current, ring.current, title.current, sub.current, foot.current?.querySelector('button'), line.current, look.current];
    if (els.some(e => !e)) return;
    const [r, rg, t, s, c, l, lk] = els as HTMLElement[];
    const run = () => setPlaced(placeNotes(r, rg, [t, s, l, lk], c));
    run();
    const ro = new ResizeObserver(run);
    ro.observe(r);
    document.fonts?.ready.then(run).catch(() => {});
    return () => ro.disconnect();
  }, [ready]);

  if (!hydrated) return <Screen className="si-blank" />;

  if (splash) return (
    <Screen className="si-splash" label="Mylo">
      <div className="si-splash-hero">
        <span className="si-disc si-splash-disc" />
        <Art name="mylo-happy" w={200} h={240} className="si-splash-mylo" />
        <h1 className="si-wordmark">mylo</h1>
        <p className="t-body c-2">Do it together.</p>
      </div>
      <div className="si-dots" aria-label="Loading"><span /><span /><span /></div>
    </Screen>
  );

  return (
    <main ref={root} className="si-root si si-welcome">
      <button ref={look} type="button" className="si-look" onClick={() => {
        try { localStorage.setItem('mylo.explore.v1', '1'); } catch { /* still goes */ }
        stampNav('tab');
        router.push('/today');
      }}>Look around</button>

      {placed && NOTES.map((n, i) => {
        const at = placed[i];
        if (!at) return null;
        return (
          <span key={n.text} aria-hidden className={`si-sticky ${handFont}`}
                style={{ left: at.x - NOTE_W / 2, top: at.y - NOTE_H / 2, rotate: `${n.rot}deg`, scale: at.s, background: n.tone, '--i': i } as React.CSSProperties}>
            {n.text}
            {n.pin && <i className="si-pin" style={{ left: n.pin.x, top: n.pin.y, background: n.pin.c }} />}
          </span>
        );
      })}

      <span className="si-welcome-gap is-top" />
      <div className="si-welcome-hero">
        {/* The company's picture, three Mylos together, where O2 draws its ring. */}
        <img ref={ring} className="si-welcome-logo" src="/brand/mylo-logo-512.webp" alt="" width={180} height={180} draggable={false} />
        <h1 ref={title} className="si-title">Goals feel lighter with company</h1>
        <p ref={sub} className="t-body c-2 si-sub">Plan your day. Keep each other going.</p>
      </div>
      <span className="si-welcome-gap is-mid" />
      <footer ref={foot} className="si-foot">
        <Cta onClick={() => { stampNav('push'); router.push(startPath()); }}>Get started</Cta>
        <Link ref={line} className="si-note" href="/signin">Already have an account? Sign in</Link>
      </footer>
    </main>
  );
}
