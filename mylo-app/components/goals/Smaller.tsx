'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '../Icon';
import ScreenHeader from '../ScreenHeader';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/lib/local';
import { addDays, clock, iso } from '@/lib/dates';
import { merge, plannedDays, DAY_SHORT, useMeta, type Goal } from '@/lib/goals';

/* C4b · Make it smaller (877:109518), "Mylo's fix": the goal as it is, a
   two-minute version to try for a week, and a few other ways to shrink it. */
const meta = (time?: string, minutes?: number, days?: number[], daily?: boolean) =>
  [time ? clock(time) : null, minutes ? `${minutes} min` : null, daily ? 'daily' : days?.length ? days.map(d => DAY_SHORT[d]).join(', ') : null].filter(Boolean).join(' · ');

export default function Smaller() {
  const ready = useHydrated();
  const { id } = useParams<{ id: string }>();
  const { items } = useStore();
  const { all } = useMeta();
  const item = items.find(i => i.id === id);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  if (!item) return <main className="screen on-desk"><ScreenHeader fallback="/goals" /></main>;
  return <Fix g={merge(item, { ...all[item.id], smaller: undefined })} />;
}

function Fix({ g }: { g: Goal }) {
  const router = useRouter();
  const { patch } = useMeta();
  const { items } = useStore();
  const [title, setTitle] = useState(g.title);
  const [later, setLater] = useState(false);
  const [fewer, setFewer] = useState(false);
  const [together, setTogether] = useState(false);
  const time = later ? '18:00' : g.time;
  const days = fewer ? [0, 2, 4] : plannedDays(g);
  const daily = !fewer && g.repeat === 'daily';

  const small = items.filter(i => i.minutes && i.minutes <= 20);
  const tip = small.length > 0 ? `Small wins stick. You finish ${small.filter(i => i.done).length} of ${small.length} tasks under 20 minutes.` : null;
  const back = () => router.push(`/goals/${g.id}`);

  function apply() {
    patch(g.id, m => ({
      smaller: { title: title.trim() || g.title, time, minutes: 2, until: iso(addDays(new Date(), 7)) },
      ...(fewer ? { repeat: 'days', days: [0, 2, 4] } : {}),
      ...(together && g.with ? { note: [m.note, `With ${g.with}`].filter(Boolean).join('\n') } : {})
    }));
    back();
  }

  return (
    <main className="screen on-desk g-fix">
      <ScreenHeader title="Mylo’s fix" fallback={`/goals/${g.id}`} />
      <section className="g-fix-hero">
        <span className="g-disc g-disc-147" />
        <img className="g-mylo" src="/figma/goals/mylo-focused-headphones.svg" alt="" width={120} height={144} />
        <h1 className="t-title-m g-center">Too long? Let’s make it smaller.</h1>
      </section>
      <div className="card g-compare">
        <div className="g-cmp-row">
          <span className="task-bar" style={{ background: 'var(--text-3)', height: 40 }} />
          <span className="task-text"><span className="t-label c-3">Now</span><span className="t-body c-3 g-struck">{g.title}</span><span className="t-caption c-2">{meta(g.time, g.minutes, plannedDays(g), g.repeat === 'daily')}</span></span>
        </div>
        <div className="g-cmp-row">
          <span className="task-bar" style={{ background: 'var(--green)', height: 40 }} />
          <label className="task-text">
            <span className="t-label c-3">Try this week</span>
            <input className="t-body g-cmp-input" value={title} onChange={e => setTitle(e.target.value)} aria-label="Try this week" />
            <span className="t-caption c-2">{meta(time, 2, days, daily)}</span>
          </label>
        </div>
      </div>
      {tip && <p className="g-tip"><Icon name="sparkles" size={20} />{tip}</p>}
      <h2 className="t-title-s">Or try</h2>
      <div className="g-wrap">
        <button type="button" className="g-try" aria-pressed={later} onClick={() => setLater(v => !v)}><Icon name="goals/moon" size={18} />Move to 6 PM</button>
        {g.with && <button type="button" className="g-try" aria-pressed={together} onClick={() => setTogether(v => !v)}><Icon name="goals/people" size={18} />With {g.with}</button>}
        <button type="button" className="g-try" aria-pressed={fewer} onClick={() => setFewer(v => !v)}><Icon name="goals/calendar" size={18} />3 days a week</button>
      </div>
      <div className="g-fix-foot">
        <button type="button" className="g-pill-2" onClick={back}>Keep as is</button>
        <button type="button" className="btn-primary g-grow" onClick={apply}>Try for a week</button>
      </div>
    </main>
  );
}
