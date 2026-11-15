'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '../Icon';
import DayItems, { thingsOn } from './DayItems';
import QuickTodoSheet from './QuickTodoSheet';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/lib/local';
import { fromIso, iso, todayIso, weekdayName } from '@/lib/dates';
import { useMeta } from '@/lib/goals';

/* E3 · Calendar, month (877:110956). Each day shows up to three dots: done,
   shared with someone, and still planned. Pick a day to see and tick what is
   on it. "Mine" leaves out what is shared. */
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function Calendar() {
  const ready = useHydrated();
  const { items } = useStore();
  const { all } = useMeta();
  // /calendar?day=YYYY-MM-DD opens on that day (Today's week strip links here).
  const [picked, setPicked] = useState(() => {
    const d = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('day') : null;
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayIso();
  });
  const [month, setMonth] = useState(() => { const d = fromIso(picked); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [mine, setMine] = useState(false);
  const [quick, setQuick] = useState(false);
  if (!ready) return <main className="screen" aria-busy="true" />;

  const today = todayIso();
  const lead = (month.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((lead + count) / 7) * 7 }, (_, i) => {
    const n = i - lead + 1;
    return n >= 1 && n <= count ? new Date(month.getFullYear(), month.getMonth(), n) : null;
  });
  const on = (day: string) => thingsOn(items, all, day).filter(t => !mine || !t.with);
  const things = on(picked);
  const pd = fromIso(picked);
  const shift = (n: number) => setMonth(m => new Date(m.getFullYear(), m.getMonth() + n, 1));

  return (
    <main className="screen on-desk g-cal">
      <header className="g-cal-top">
        <Link href="/profile" className="g-face g-face-32" aria-label="Your profile"><img src="/figma/goals/mylo-face-white.svg" alt="" /></Link>
        <Link href="/notifications" className="back-btn" aria-label="Notifications"><Icon name="bell" size={19} /></Link>
      </header>
      <div className="g-month-head">
        <h1 className="g-h28">{month.toLocaleDateString('en-GB', { month: 'long' })} <span className="c-3">{month.getFullYear()}</span></h1>
        <span className="spacer" />
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shift(-1)}><Icon name="chevron-right" size={19} className="flip" /></button>
        <button type="button" className="icon-btn" aria-label="Next month" onClick={() => shift(1)}><Icon name="chevron-right" size={19} /></button>
      </div>
      <div className="g-chips" role="radiogroup" aria-label="Whose">
        <button type="button" role="radio" aria-checked={!mine} className="g-sound" onClick={() => setMine(false)}>Everyone</button>
        <button type="button" role="radio" aria-checked={mine} className="g-sound" onClick={() => setMine(true)}>Mine</button>
      </div>
      <div className="g-month">
        <div className="g-month-row">{LETTERS.map((l, i) => <span key={i} className="g-month-letter">{l}</span>)}</div>
        <div className="g-month-grid">
          {cells.map((d, i) => {
            if (!d) return <span key={i} className="g-mday is-blank" />;
            const day = iso(d); const t = on(day);
            const dots = [t.some(x => x.done) && 'done', t.some(x => x.with || x.room) && 'shared', t.some(x => !x.done) && 'planned'].filter(Boolean) as string[];
            return (
              <button key={i} type="button" className={`g-mday${day < today ? ' is-past' : ''}${day === today ? ' is-today' : ''}`}
                      aria-pressed={day === picked} aria-label={`${d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}, ${t.length} things`}
                      onClick={() => setPicked(day)}>
                <span>{d.getDate()}</span>
                <span className="g-mdots">{dots.map(k => <i key={k} className={`g-mdot is-${k}`} />)}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="g-legend">
        <span><i className="g-mdot is-done" />Done</span>
        <span><i className="g-mdot is-shared" />Shared</span>
        <span><i className="g-mdot is-planned" />Planned by Mylo</span>
      </div>
      <p className="t-label c-3">{pd.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {things.length} {things.length === 1 ? 'thing' : 'things'}</p>
      <DayItems day={picked} things={things} />
      {picked >= today && (
        <div className="g-chips">
          <Link href={`/plan?day=${picked}`} className="chip chip-plain">Plan {picked === today ? 'today' : weekdayName(pd)}.</Link>
          <button type="button" className="chip chip-plain" onClick={() => setQuick(true)}>Add a quick to-do</button>
        </div>
      )}
      <QuickTodoSheet open={quick} onClose={() => setQuick(false)} day={picked} />
    </main>
  );
}
