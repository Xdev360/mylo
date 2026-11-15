'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRef, useState, type FormEvent } from 'react';
import Icon from '../Icon';
import ScreenHeader from '../ScreenHeader';
import TaskSheet, { useMarkDone } from './TaskSheet';
import { Check, XpPill, useBurst, useCelebrate } from './Tick';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/lib/local';
import { iso, todayIso } from '@/lib/dates';
import { isPlanned, lastWeeks, merge, progress, uid, useMeta, weekOf, weeksInRow, type Goal } from '@/lib/goals';

/* E2 · Goal detail (877:110907) on a phone, DT4 (946:27524) from 1024. The
   list is this week's days for a goal that repeats, or its steps for a
   one-off. Ticking a row is the C3 tick moment. */
type Row = { key: string; title: string; sub?: string; done: boolean; disabled?: boolean; toggle: () => void };

function useRows(g: Goal | null) {
  const { patch } = useMeta();
  if (!g) return [];
  const today = todayIso();
  if (g.repeat !== 'once') {
    return weekOf().filter(d => isPlanned(g, d)).map<Row>(d => {
      const day = iso(d); const done = g.log.includes(day);
      return {
        key: day, done, disabled: day > today,
        title: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
        sub: done ? 'Done' : ['Planned', g.time].filter(Boolean).join(' · '),
        toggle: () => patch(g.id, m => ({ log: done ? (m.log ?? []).filter(x => x !== day) : [...(m.log ?? []), day] }))
      };
    });
  }
  return g.steps.map<Row>(s => ({
    key: s.id, title: s.title, done: s.done,
    toggle: () => patch(g.id, m => ({ steps: (m.steps ?? []).map(x => x.id === s.id ? { ...x, done: !x.done } : x) }))
  }));
}

function Ring({ done, total }: { done: number; total: number }) {
  const r = 28; const c = 2 * Math.PI * r;
  return (
    <span className="g-ring" role="img" aria-label={`${done} of ${total}`}>
      <svg viewBox="0 0 64 64" width="64" height="64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="g-ring-track" />
        <circle cx="32" cy="32" r={r} className="g-ring-fill" strokeDasharray={c} strokeDashoffset={c * (1 - (total ? done / total : 0))} />
      </svg>
      <span className="g-ring-n">{done}/{total}</span>
    </span>
  );
}

export default function GoalDetail() {
  const { id } = useParams<{ id: string }>();
  const ready = useHydrated();
  const { items } = useStore();
  const { all, patch } = useMeta();
  const mark = useMarkDone();
  const celebrate = useCelebrate();
  const [burst, fire] = useBurst();
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState('');
  const addRef = useRef<HTMLInputElement>(null);
  const item = items.find(i => i.id === id);
  const g = item && !all[item.id]?.hidden ? merge(item, all[item.id]) : null;
  const rows = useRows(g);
  if (!ready) return <main className="screen" aria-busy="true" />;

  if (!g) return (
    <main className="screen on-desk">
      <ScreenHeader fallback="/goals" />
      <p className="t-body c-2">This goal isn&rsquo;t here any more.</p>
      <Link href="/goals" className="btn-primary">Goals</Link>
    </main>
  );

  const p = progress(g);
  const isDone = g.repeat === 'once' ? g.done : g.log.includes(todayIso());
  const tick = (r: Row) => {
    if (r.disabled) return;
    r.toggle();
    if (!r.done) { fire(r.key); celebrate({ sub: g.with ? `${g.with} sees it too` : undefined, href: g.room ? '/rooms' : undefined }); }
  };
  function addStep(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim(); if (!title || !g) return;
    patch(g.id, m => ({ steps: [...(m.steps ?? []), { id: uid(), title, done: false }] }));
    setDraft('');
  }
  const addForm = (desk: boolean) => g.repeat === 'once' && (
    <form className={desk ? 'g-drow g-drow-add' : 'g-run g-run-add'} onSubmit={addStep}>
      <span className="todo-plus"><Icon name="plus-sm" size={16} /></span>
      <label className="sr-only" htmlFor={desk ? 'g-add-desk' : 'g-add'}>Add a step</label>
      <input id={desk ? 'g-add-desk' : 'g-add'} ref={desk ? addRef : undefined} className="t-body todo-input" placeholder="Add a step" value={draft} onChange={e => setDraft(e.target.value)} enterKeyHint="done" />
    </form>
  );
  const chip = [g.tag?.label, g.repeat === 'once' ? null : 'Week'].filter(Boolean).join(' · ');
  const shared = g.with ? `Shared with ${g.with}` : 'Private';
  const weeks = weeksInRow(g);
  const chart = lastWeeks(g);
  const max = Math.max(1, ...chart);

  return (
    <>
      {/* ── Phone: E2 ─────────────────────────────────────────────────── */}
      <main className="screen g-detail g-no-tabs only-phone">
        <ScreenHeader fallback="/goals" actions={
          <button type="button" className="back-btn" aria-label="More" onClick={() => setSheet(true)}><Icon name="goals/more" size={19} /></button>
        } />
        <section className="g-detail-head">
          <div className="g-detail-text">
            {chip && <span className="g-chip"><Icon name="chip-tag" size={16} />{chip}</span>}
            <h1 className="g-h28">{g.title}</h1>
            <p className="g-meta13">{shared}{g.repeat !== 'once' ? ' · resets Monday' : ''}</p>
          </div>
          <Ring done={p.done} total={p.total} />
        </section>
        <div className="g-both">
          <div className="g-who">
            <span className="g-who-row"><span className="g-face"><img src="/figma/goals/mylo-face-white.svg" alt="" /></span><span className="g-meta13 c-ink">You</span></span>
            <span className="g-h17">{p.done} of {p.total}</span>
            <span className="g-thin"><span style={{ width: `${p.pct}%` }} /></span>
          </div>
        </div>
        {(rows.length > 0 || g.repeat === 'once') && <>
          <p className="t-label c-3">{g.repeat === 'once' ? 'Steps' : 'This week'}</p>
          <div className="g-runs">
            {rows.map(r => (
              <button key={r.key} type="button" className={`g-run${burst === r.key ? ' is-burst' : ''}`} aria-pressed={r.done} disabled={r.disabled} onClick={() => tick(r)}>
                <Check done={r.done} burst={burst === r.key} />
                <span className="g-run-text"><span className={`t-body${r.done && g.repeat === 'once' ? ' g-struck' : ''}`}>{r.title}</span>{r.sub && <span className="g-meta11">{r.sub}</span>}</span>
                <XpPill on={burst === r.key} />
              </button>
            ))}
            {addForm(false)}
          </div>
        </>}
        <div className="g-actions">
          <button type="button" className="btn-primary g-grow" aria-pressed={isDone} onClick={() => mark(g)}>
            <Icon name={isDone ? 'goals/check-bold-16' : 'plus-20'} size={20} />{isDone ? 'Done' : 'Mark done'}
          </button>
          <button type="button" className="g-icon-44" aria-label="Remind me" aria-pressed={!!g.remind} onClick={() => patch(g.id, { remind: !g.remind })}><Icon name="bell" size={20} /></button>
        </div>
      </main>

      {/* ── Desktop: DT4 ──────────────────────────────────────────────── */}
      <main className="desk g-desk only-desk">
        <nav className="g-crumb" aria-label="Breadcrumb">
          <Link href="/goals" className="g-crumb-back" aria-label="Back to Goals"><Icon name="goals/back" size={18} /></Link>
          <Link href="/goals" className="c-2">Goals</Link><span className="c-3">/</span><span aria-current="page">{g.title}</span>
        </nav>
        <header className="g-desk-head">
          <div className="g-desk-title">
            <p className="t-body-s c-2">{[g.tag?.label, shared].filter(Boolean).join(' · ')}</p>
            <h1 className="desk-greeting">{g.title}</h1>
          </div>
          <Link href={`/goals/new?edit=${g.id}`} className="g-btn-2"><Icon name="goals/pencil-fill" size={18} />Edit</Link>
          {g.repeat === 'once'
            ? <button type="button" className="desk-new" onClick={() => addRef.current?.focus()}><Icon name="plus-18" size={18} />Add task</button>
            : <button type="button" className="desk-new" aria-pressed={isDone} onClick={() => mark(g)}><Icon name={isDone ? 'check-14' : 'plus-18'} size={18} />{isDone ? 'Done' : 'Mark done'}</button>}
        </header>
        <div className="g-body">
          <div className="g-main">
            <div className="g-stats">
              <div className="g-stat"><span className="t-body-s c-2">Progress</span><span className="g-stat-n">{p.pct}%</span></div>
              <div className="g-stat"><span className="t-body-s c-2">{g.repeat === 'once' ? 'Steps' : 'This week'}</span><span className="g-stat-n">{p.done} of {p.total}</span></div>
              <div className="g-stat"><span className="t-body-s c-2">Streak</span><span className="g-stat-n">{weeks} {weeks === 1 ? 'week' : 'weeks'}</span></div>
              {g.repeat === 'once' && g.date > todayIso() && <div className="g-stat"><span className="t-body-s c-2">Target</span><span className="g-stat-n">{new Date(g.date + 'T00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div>}
            </div>
            <h2 className="g-h17">Tasks in this goal</h2>
            {rows.map(r => (
              <div key={r.key} className={`g-drow${r.done ? ' is-done' : ''}${burst === r.key ? ' is-burst' : ''}`}>
                <button type="button" className="g-dcheck-btn" aria-pressed={r.done} aria-label={`${r.done ? 'Undo' : 'Tick'} ${r.title}`} disabled={r.disabled} onClick={() => tick(r)}>
                  <span className="desk-check">{r.done && <Icon name="check-14" size={14} />}</span>
                </button>
                <span className="task-text"><span className="g-drow-title">{r.title}</span>{r.sub && <span className="t-body-s c-2">{r.sub}</span>}</span>
                <XpPill on={burst === r.key} />
                <Link href={`/goals/${g.id}/smaller`} className="g-dchip is-white">Two minute version</Link>
              </div>
            ))}
            {addForm(true)}
          </div>
          {g.repeat !== 'once' && (
            <aside className="g-rail">
              <section className="g-rail-card">
                <h2 className="g-h15">Last 5 weeks</h2>
                <div className="g-chart" role="img" aria-label={`Check-ins per week: ${chart.join(', ')}`}>
                  {chart.map((n, i) => <span key={i} className={i === chart.length - 1 ? 'is-now' : ''} style={{ height: `${Math.max(6, (n / max) * 100)}%` }} />)}
                </div>
              </section>
            </aside>
          )}
        </div>
      </main>

      <TaskSheet id={sheet ? g.id : null} onClose={() => setSheet(false)} />
    </>
  );
}
