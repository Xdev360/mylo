'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { useStore } from '@/lib/store';
import { todayIso } from '@/lib/dates';
import { dayThings, useMeta, useMoments } from '@/lib/goals';
import { stampNav } from '../NavMotion';
import { haptic } from '@/lib/system';

/* C3 · Tick moment (877:109660) and C3b · settled (877:109838). Ticking a row
   fills its circle green, bursts four stars and a "+20 XP" pill, and a glass
   toast rises over the tab bar; about 1.6s later the row settles into the
   plain done style (C3b). The XP shown is the action's label from the
   design; totals are the server's. When the tick finishes the day, C6
   Perfect day follows once. */
export const TICK_XP = '+20 XP';
const SETTLE = 1600;

type Toast = { line: string; sub?: string; href?: string; tick: boolean; n: number };
type Note = { line: string; sub?: string; href?: string };
type Ctx = { celebrate: (t: { sub?: string; href?: string }) => void; announce: (t: Note) => void };
const TickCtx = createContext<Ctx>({ celebrate: () => {}, announce: () => {} });
export const useCelebrate = () => useContext(TickCtx).celebrate;
/* The same glass toast for news that is not a tick: "Added to Saturday". */
export const useAnnounce = () => useContext(TickCtx).announce;

export function TickProvider({ children }: { children: React.ReactNode }) {
  const { items } = useStore();
  const { all } = useMeta();
  const [moments, setMoments] = useMoments();
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  // The last toast stays drawn while it slides away, so it never empties mid-fade.
  const [shown, setShown] = useState<Toast | null>(null);
  if (toast && toast !== shown) setShown(toast);
  const [armed, setArmed] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const day = dayThings(items, all, todayIso());
  const left = day.filter(i => !i.done).length;

  const show = useCallback((t: Toast) => {
    clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);
  const celebrate = useCallback((t: { sub?: string; href?: string }) => {
    show({ line: TICK_XP, ...t, tick: true, n: Date.now() });
    setArmed(Date.now());
    haptic(12);
  }, [show]);
  const announce = useCallback((t: Note) => show({ ...t, tick: false, n: Date.now() }), [show]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // The day just finished: show C6 once, after the burst has settled. An
  // untick inside that wait calls it off.
  useEffect(() => {
    if (!armed || !day.length || left > 0 || moments.perfect === todayIso()) return;
    const t = setTimeout(() => { setMoments(m => ({ ...m, perfect: todayIso() })); stampNav('push'); router.push('/plan/done'); }, SETTLE + 200);
    return () => clearTimeout(t);
  }, [armed, day.length, left, moments.perfect, router, setMoments]);

  const doneCount = day.length - left;
  const t = toast ?? shown;
  return (
    <TickCtx.Provider value={{ celebrate, announce }}>
      {children}
      <div className={`g-toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite" inert={!toast}>
        {t && <>
          {/* A second tick while the toast is up pops it again rather than swapping words silently. */}
          <span key={t.n} className="g-toast-icon"><Icon name={t.tick ? 'sparkles' : 'check-14'} size={t.tick ? 22 : 16} /></span>
          <span className="g-toast-text">
            <span className="t-body-s c-ink">{t.line}{t.tick && day.length > 0 && <>&nbsp; · &nbsp;<Roll value={doneCount} /> of {day.length} done</>}</span>
            {t.sub && <span className="t-caption c-3">{t.sub}</span>}
          </span>
          {t.href && <Link href={t.href} className="g-toast-open t-body-s" onClick={() => setToast(null)}>Open</Link>}
        </>}
      </div>
    </TickCtx.Provider>
  );
}

/* Which row is mid-burst. `fire(id)` starts it; it settles on its own. */
export function useBurst() {
  const [id, setId] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(t.current), []);
  const fire = useCallback((next: string) => {
    clearTimeout(t.current); setId(next);
    t.current = setTimeout(() => setId(null), SETTLE);
  }, []);
  return [id, fire] as const;
}

/* The completion circle, in its three states. */
export function Check({ done, burst = false, size = 22 }: { done: boolean; burst?: boolean; size?: number }) {
  return (
    <span className={`g-check${done ? ' is-done' : ''}${burst ? ' is-burst' : ''}`} style={{ '--c': `${size}px` } as React.CSSProperties} aria-hidden>
      {done && <Icon name="goals/check-bold-16" size={Math.round(size * 0.57)} />}
      {burst && <>
        <i className="g-star s1" /><i className="g-star s2" /><i className="g-star s3" /><i className="g-star s4" />
      </>}
    </span>
  );
}

/* The "+20 XP" pill that pops at the right of a ticked row. */
export function XpPill({ on }: { on: boolean }) {
  return on ? <span className="g-xp-pill" aria-hidden>{TICK_XP}</span> : null;
}

/* A number that rolls to its new value: up when it grows, down when it
   shrinks, so a tick reads in the counts as well as on the row. */
export function Roll({ value, className = '' }: { value: number; className?: string }) {
  const [prev, setPrev] = useState(value);
  const [dir, setDir] = useState<'up' | 'down' | null>(null);
  if (value !== prev) { setDir(value > prev ? 'up' : 'down'); setPrev(value); }
  return (
    <span className={`roll ${className}`}>
      <span key={value} className={dir ? `roll-${dir}` : undefined}>{value}</span>
    </span>
  );
}
