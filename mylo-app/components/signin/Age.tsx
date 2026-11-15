'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { iso } from '@/lib/dates';
import { EMPTY_ONBOARDING, MIN_AGE, ageOn, blockUnder13, isBlocked } from '@/lib/signin';
import { haptic } from '@/lib/system';
import { useFoot, type StepProps } from './OnboardingFlow';
import { Art } from './ui';

/* S1 Age check (877:107895) and S2 Under 13 (877:107920), the step between
   "who" and "vibe". Under 13 stops sign-up for a day and drops the answers
   typed so far, as S2 says. */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/* ── The wheel ──────────────────────────────────────────────────────────────
   A loop with no ends: after December comes January, after the last day the
   1st, after this year the year a hundred back. The position is a row number
   that runs on forever in both directions; each row shows the item at that
   number round the list, so wrapping has no seam to see.

   Drag it (it carries on with the flick and settles on a row, as an iPhone
   picker does), turn the mouse wheel, tap a row, or focus it and use the
   arrow keys, Page Up/Down, Home/End, or type the start of a value.        */
const ROW = 40;           // row pitch, as drawn
const MID = 110;          // the band's centre in the 220 high wheel
const TAU = 325;          // how quickly a flick slows (ms), iOS-like
const mod = (a: number, n: number) => ((a % n) + n) % n;

function Wheel({ items, value, onChange, label, className, align = 'center' }: {
  items: string[]; value: number; onChange: (i: number) => void; label: string; className: string; align?: 'left' | 'center';
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The list being drawn; it lags `items` while the wheel walks off a day
  // the new month does not have (31 April turns into 30 by moving there).
  const [shown, setShown] = useState(items);
  const [pos, setPosState] = useState(value);
  const posRef = useRef(value);
  const shownRef = useRef(items);
  const anim = useRef<{ raf: number; from: number; to: number; t0: number; tau: number } | null>(null);
  const drag = useRef<{ id: number; y0: number; p0: number; moved: boolean; samples: { t: number; p: number }[] } | null>(null);
  const wheelIdle = useRef<number | undefined>(undefined);
  const typed = useRef({ text: '', at: 0 });
  const lastTick = useRef(Math.round(value));
  const props = useRef({ items, value, onChange });
  useLayoutEffect(() => { props.current = { items, value, onChange }; });
  const settleRef = useRef<() => void>(() => {});

  const setPos = useCallback((p: number) => {
    posRef.current = p;
    setPosState(p);
    const r = Math.round(p);
    if (r !== lastTick.current) { lastTick.current = r; haptic(3); }
  }, []);

  const stop = () => { if (anim.current) cancelAnimationFrame(anim.current.raf); anim.current = null; };

  const animateTo = useCallback((target: number, tau = 120) => {
    stop();
    // Where it will land is known now, so the screen hears it now: Continue
    // pressed while a flick is still slowing reads the row it slows to.
    const list = shownRef.current;
    const land = mod(target, list.length);
    if (land < props.current.items.length && land !== props.current.value) props.current.onChange(land);
    const a = { raf: 0, from: posRef.current, to: target, t0: performance.now(), tau };
    const frame = (t: number) => {
      const left = (a.to - a.from) * Math.exp(-(t - a.t0) / a.tau);
      if (Math.abs(left) < 0.002) { anim.current = null; setPos(a.to); settleRef.current(); return; }
      setPos(a.to - left);
      a.raf = requestAnimationFrame(frame);
    };
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { setPos(target); settleRef.current(); return; }
    a.raf = requestAnimationFrame(frame);
    anim.current = a;
  }, [setPos]);

  /* Once still: swap in a new list if one is waiting, follow the value the
     screen asks for, or report the row it came to rest on. */
  const settle = useCallback(() => {
    const { items: want, value: v, onChange: report } = props.current;
    const list = shownRef.current;
    const at = Math.round(posRef.current);
    const c = mod(at, list.length);
    if (want.length !== list.length || want[0] !== list[0]) {
      if (c < want.length) {
        shownRef.current = want; setShown(want);
        setPos(c);
        lastTick.current = c;
      } else { animateTo(at + (want.length - 1 - c), 140); return; }
    }
    const n = shownRef.current.length;
    const now = mod(Math.round(posRef.current), n);
    if (now !== v) report(now);
  }, [setPos, animateTo]);
  useLayoutEffect(() => { settleRef.current = settle; }, [settle]);

  /* The screen changed the value (a day the month lacks) or the list. */
  useLayoutEffect(() => {
    if (drag.current || anim.current) return;
    const list = shownRef.current;
    if (items.length !== list.length || items[0] !== list[0]) { settle(); return; }
    const at = Math.round(posRef.current);
    const c = mod(at, list.length);
    if (c === value) return;
    let d = mod(value - c, list.length);
    if (d > list.length / 2) d -= list.length;
    animateTo(at + d, 120);
  }, [items, value, settle, animateTo]);

  useEffect(() => () => { stop(); window.clearTimeout(wheelIdle.current); }, []);

  /* The mouse wheel and trackpad move it row by row, then it settles. */
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      stop();
      const rows = e.deltaMode === 1 ? e.deltaY : e.deltaMode === 2 ? e.deltaY * 5 : e.deltaY / ROW;
      setPos(posRef.current + rows);
      window.clearTimeout(wheelIdle.current);
      wheelIdle.current = window.setTimeout(() => animateTo(Math.round(posRef.current), 90), 120);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setPos, animateTo]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    stop();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, y0: e.clientY, p0: posRef.current, moved: false, samples: [{ t: e.timeStamp, p: posRef.current }] };
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    const dy = e.clientY - d.y0;
    if (Math.abs(dy) > 4) d.moved = true;
    const p = d.p0 - dy / ROW;
    setPos(p);
    d.samples.push({ t: e.timeStamp, p });
    if (d.samples.length > 12) d.samples.shift();
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current; if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) {
      // A tap: the row under the finger comes to the band.
      const box = e.currentTarget.getBoundingClientRect();
      const rows = Math.round((e.clientY - box.top - MID) / ROW);
      animateTo(Math.round(posRef.current) + rows, 130);
      e.currentTarget.focus({ preventScroll: true });
      return;
    }
    // A flick carries on and slows, landing exactly on a row.
    const recent = d.samples.filter(s => e.timeStamp - s.t < 100);
    let v = 0; // rows per ms
    if (recent.length > 1) {
      const a = recent[0], b = recent[recent.length - 1];
      if (b.t > a.t) v = (b.p - a.p) / (b.t - a.t);
    }
    const target = Math.round(posRef.current + v * TAU);
    animateTo(target, Math.abs(v) > 0.002 ? TAU : 120);
  };

  const step = (n: number) => animateTo(Math.round(anim.current ? anim.current.to : posRef.current) + n, 110);
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const list = shownRef.current;
    const at = Math.round(anim.current ? anim.current.to : posRef.current);
    const jump = (i: number) => { let d = mod(i - mod(at, list.length), list.length); if (d > list.length / 2) d -= list.length; animateTo(at + d, 110); };
    const keys: Record<string, () => void> = {
      ArrowDown: () => step(1), ArrowUp: () => step(-1), PageDown: () => step(5), PageUp: () => step(-5),
      Home: () => jump(0), End: () => jump(list.length - 1)
    };
    if (keys[e.key]) { e.preventDefault(); keys[e.key](); return; }
    if (e.key.length === 1 && /[\p{L}\p{N}]/u.test(e.key)) {
      // Type the start of a value: "ju" for June, "19" then "9" for 1999.
      const now = e.timeStamp;
      typed.current = { text: (now - typed.current.at < 900 ? typed.current.text : '') + e.key.toLowerCase(), at: now };
      const i = list.findIndex(t => t.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) jump(i);
    }
  };

  const n = shown.length;
  const base = Math.floor(pos);
  const rows = [];
  for (let i = base - 3; i <= base + 3; i++) {
    const d = Math.abs(i - pos);
    // As drawn: the row in the band full ink 17/600, one away 60%, two away 35%.
    const ink = Math.max(0, 1 - d);
    const opacity = d <= 1 ? 1 - 0.4 * d : d <= 2 ? 0.6 - 0.25 * (d - 1) : Math.max(0, 0.35 - 0.35 * (d - 2));
    rows.push(
      <span key={i} className={`si-wheel-row${d < 0.5 ? ' is-on' : ''}`} aria-hidden
            style={{ translate: `0 ${MID - ROW / 2 + (i - pos) * ROW}px`, opacity, '--k': `${Math.round(ink * 100)}%`, scale: 15 / 17 + (2 / 17) * ink } as React.CSSProperties}>
        {shown[mod(i, n)]}
      </span>
    );
  }
  const cur = mod(Math.round(pos), n);
  return (
    <div ref={ref} className={`si-wheel ${className} is-${align}`} tabIndex={0} role="spinbutton" aria-label={label}
         aria-valuenow={cur + 1} aria-valuetext={shown[cur]} aria-valuemin={1} aria-valuemax={n}
         onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
         onKeyDown={onKeyDown}>
      {rows}
    </div>
  );
}

/* What was on the wheels, kept for the visit so Back and forward return to
   it before Continue saves it. */
let draft: { month: number; day: number; year: number } | null = null;

export default function Age({ ob, update, next, leave }: StepProps) {
  const [stopped, setStopped] = useState(() => isBlocked());
  const thisYear = new Date().getFullYear();
  const first = thisYear - 100;
  const [years] = useState(() => Array.from({ length: 101 }, (_, i) => String(first + i)));
  const [start] = useState(() => {
    if (draft) return draft;
    if (ob.birthday) { const [y, m, d] = ob.birthday.split('-').map(Number); return { month: m - 1, day: d - 1, year: y - first }; }
    // Nothing picked yet: a day 18 years back, so the wheels start mid-list.
    const t = new Date();
    return { month: t.getMonth(), day: t.getDate() - 1, year: t.getFullYear() - 18 - first };
  });
  const [month, setMonth] = useState(start.month);
  const [day, setDay] = useState(start.day);
  const [year, setYear] = useState(Math.max(0, Math.min(years.length - 1, start.year)));
  const y = Number(years[year]);
  const daysIn = new Date(y, month + 1, 0).getDate();
  const [dayLists] = useState(() => [28, 29, 30, 31].map(n => Array.from({ length: n }, (_, i) => String(i + 1))));
  const days = dayLists[daysIn - 28];
  const dayAt = Math.min(day, daysIn - 1);
  useEffect(() => { draft = { month, day: dayAt, year }; }, [month, dayAt, year]);

  const go = () => {
    const birth = new Date(y, month, dayAt + 1);
    if (ageOn(birth) < MIN_AGE) {
      // Nothing typed so far stays on the device.
      blockUnder13(); draft = null; update({ ...EMPTY_ONBOARDING, at: 'age' }); setStopped(true); return;
    }
    update({ birthday: iso(birth) });
    next();
  };
  useFoot(stopped
    ? { label: 'Close', size: 's', tone: 'soft', onClick: () => leave('/welcome', 'tab') }
    : { label: 'Continue', size: 's', onClick: go });

  if (stopped) return (
    <div className="si-under">
      <span className="si-under-hero"><Art name="mylo-plain" w={100} h={120} /></span>
      <h1 className="si-title-l si-center">Mylo is not for you yet</h1>
      <p className="si-under-body">You need to be 13 or older to use Mylo. We have not saved anything you typed.</p>
      <p className="si-under-note"><Icon name="signin/i-shield" size={24} />Made a mistake? You can try again in 24 hours.</p>
    </div>
  );

  return (
    <>
      <h1 className="si-title-l si-age-title">When is your birthday?</h1>
      <p className="si-age-sub">Mylo is for people 13 and up. We do not show this on your profile.</p>
      <div className="si-wheels">
        <span className="si-wheel-band" aria-hidden />
        <Wheel items={MONTHS} value={month} onChange={setMonth} label="Month" className="is-month" align="left" />
        <Wheel items={days} value={dayAt} onChange={setDay} label="Day" className="is-day" />
        <Wheel items={years} value={year} onChange={setYear} label="Year" className="is-year" />
      </div>
    </>
  );
}
