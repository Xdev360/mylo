'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Icon from '../Icon';
import ScreenHeader from '../ScreenHeader';
import DayItems, { thingsOn } from './DayItems';
import QuickTodoSheet from './QuickTodoSheet';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/lib/local';
import { addDays, fromIso, iso, todayIso, weekdayName } from '@/lib/dates';
import { useMeta, weekOf } from '@/lib/goals';

/* N7 · Plan another day (368:13716). Tomorrow unless ?day= says otherwise;
   the strip moves between days; what is already on the day can be ticked. */
export default function PlanDay() {
  const ready = useHydrated();
  return ready ? <Plan /> : <main className="screen on-desk" aria-busy="true" />;
}

function Plan() {
  const q = useSearchParams();
  const router = useRouter();
  const { items } = useStore();
  const { all } = useMeta();
  const [quick, setQuick] = useState(false);
  const today = todayIso();
  const tomorrow = iso(addDays(new Date(), 1));
  const day = q.get('day') && q.get('day')! >= today ? q.get('day')! : tomorrow;
  const d = fromIso(day);
  const name = weekdayName(d);
  const things = thingsOn(items, all, day);
  const rel = day === today ? 'Today' : day === tomorrow ? 'Tomorrow' : null;

  return (
    <main className="screen on-desk g-plan">
      <ScreenHeader fallback="/today" />
      <section className="g-plan-head">
        <p className="t-label c-3">{[d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }), rel].filter(Boolean).join(' · ')}</p>
        <h1 className="sheet-title">Plan {name}.</h1>
        {things.length === 0 && <p className="g-meta13">Nothing yet. Add what matters.</p>}
      </section>
      <nav className="g-pweek" aria-label="Days">
        {weekOf(d).map(w => {
          const wd = iso(w); const t = thingsOn(items, all, wd);
          const dot = !t.length ? '' : wd < today ? (t.every(x => x.done) ? 'is-green' : t.some(x => x.done) ? 'is-amber' : 'is-red') : 'is-ink';
          return (
            <button key={wd} type="button" className="g-pday" aria-pressed={wd === day} disabled={wd < today}
                    onClick={() => router.replace(`/plan?day=${wd}`)}>
              <span className="g-pday-d">{w.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <span className="g-pday-n">{w.getDate()}</span>
              <i className={`g-pday-dot ${dot}`} />
            </button>
          );
        })}
      </nav>
      <section className="card g-plan-card">
        <h2 className="g-h15">Set goals for {name}</h2>
        <p className="g-meta13">Tap Today to come back.</p>
        <div className="g-chips">
          <Link href={`/goals/new?date=${day}`} className="g-chip-btn is-primary"><Icon name="plus-18" size={18} />Add goal</Link>
          <Link href="/today" className="g-chip-btn">Back to Today</Link>
        </div>
      </section>
      <p className="t-label c-3">Already on {name} · {things.length}</p>
      <DayItems day={day} things={things} />
      <button type="button" className="chip chip-plain g-self-start" onClick={() => setQuick(true)}>Add a quick to-do</button>
      <QuickTodoSheet open={quick} onClose={() => setQuick(false)} day={day} />
    </main>
  );
}
