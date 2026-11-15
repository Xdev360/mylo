'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { onDay, useStore } from '@/lib/store';
import { todayIso } from '@/lib/dates';
import { useMoments } from '@/lib/goals';

/* C3 · Tick moment (877:109660) and C3b · settled (877:109838). Ticking a row
   fills its circle green, bursts four stars and a "+20 XP" pill, and a glass
   toast rises over the tab bar; about 1.6s later the row settles into the
   plain done style (C3b). The XP shown is the action's label from the
   design; totals are the server's. When the tick finishes the day, C6
   Perfect day follows once. */
export const TICK_XP = '+20 XP';
const SETTLE = 1600;

type Toast = { line: string; sub?: string; href?: string };
type Ctx = { celebrate: (t: { sub?: string; href?: string }) => void };
const TickCtx = createContext<Ctx>({ celebrate: () => {} });
export const useCelebrate = () => useContext(TickCtx).celebrate;

export function TickProvider({ children }: { children: React.ReactNode }) {
  const { items } = useStore();
  const [moments, setMoments] = useMoments();
  const router = useRouter();
  const [toast, setToast] = useState<Toast | null>(null);
  const [armed, setArmed] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const day = onDay(items, todayIso());
  const left = day.filter(i => !i.done).length;

  const celebrate = useCallback((t: { sub?: string; href?: string }) => {
    clearTimeout(timer.current);
    setToast({ line: TICK_XP, ...t });
    setArmed(Date.now());
    timer.current = setTimeout(() => setToast(null), 2800);
  }, []);

  // The day just finished: show C6 once, after the burst has settled.
  useEffect(() => {
    if (!armed || !day.length || left > 0 || moments.perfect === todayIso()) return;
    const t = setTimeout(() => { setMoments(m => ({ ...m, perfect: todayIso() })); router.push('/plan/done'); }, SETTLE + 200);
    return () => clearTimeout(t);
  }, [armed, day.length, left, moments.perfect, router, setMoments]);

  const doneCount = day.length - left;
  return (
    <TickCtx.Provider value={{ celebrate }}>
      {children}
      <div className={`g-toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">
        {toast && <>
          <span className="g-toast-icon"><Icon name="sparkles" size={22} /></span>
          <span className="g-toast-text">
            <span className="t-body-s c-ink">{toast.line}{day.length > 0 && <>&nbsp; · &nbsp;{doneCount} of {day.length} done</>}</span>
            {toast.sub && <span className="t-caption c-3">{toast.sub}</span>}
          </span>
          {toast.href && <Link href={toast.href} className="g-toast-open t-body-s">Open</Link>}
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
