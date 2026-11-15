'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import Icon from '../Icon';
import Sheet from '../Sheet';
import { useStore } from '@/lib/store';
import { addDays, clock, iso, todayIso } from '@/lib/dates';
import { DAY_LONG, isPlanned, merge, plannedDays, uid, useMeta, type Goal } from '@/lib/goals';
import { useCelebrate } from './Tick';

/* C4 · Task detail sheet (877:109320): what it is, when, its steps, a note,
   how it has gone, and the actions. Opens over the screen for any goal,
   system or task by id. */
function when(g: Goal) {
  if (!g.time) return null;
  const h = Number(g.time.slice(0, 2));
  const part = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
  const end = g.minutes ? (() => { const [hh, mm] = g.time!.split(':').map(Number); const t = hh * 60 + mm + g.minutes!; return `${Math.floor(t / 60) % 24}:${String(t % 60).padStart(2, '0')}`; })() : null;
  return `${part} · ${clock(g.time, false)}${end ? ` – ${clock(end.padStart(5, '0'), false)}` : ''}`;
}

/* "Done 5 of the last 6 Mondays": the last six times it was on, before today. */
export function history(g: Goal) {
  if (g.repeat === 'once') return null;
  const days: string[] = [];
  for (let d = addDays(new Date(), -1); days.length < 6 && iso(d) >= g.date; d = addDays(d, -1)) if (isPlanned(g, d)) days.push(iso(d));
  if (!days.length) return null;
  const n = days.filter(d => g.log.includes(d)).length;
  const p = plannedDays(g);
  return `Done ${n} of the last ${days.length} ${p.length === 1 ? DAY_LONG[p[0]] : 'times'}`;
}

export function repeatLabel(g: Goal) {
  if (g.repeat === 'daily') return 'Every day';
  if (g.repeat === 'days') return `Repeats ${plannedDays(g).map(d => DAY_LONG[d]).join(', ')}`;
  return null;
}

/* Marks the goal done today (or not), with the tick moment. */
export function useMarkDone() {
  const { toggle } = useStore();
  const { patch } = useMeta();
  const celebrate = useCelebrate();
  return (g: Goal) => {
    const today = todayIso();
    const was = g.repeat === 'once' ? g.done : g.log.includes(today);
    if (g.repeat === 'once') toggle(g.id);
    else patch(g.id, m => ({ log: was ? (m.log ?? []).filter(d => d !== today) : [...(m.log ?? []), today] }));
    if (!was) celebrate({ sub: g.with ? `${g.with} sees it too` : undefined, href: g.room ? '/rooms' : undefined });
    return !was;
  };
}

export default function TaskSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { items } = useStore();
  const { all, patch } = useMeta();
  const router = useRouter();
  const mark = useMarkDone();
  const [draft, setDraft] = useState('');
  const item = id ? items.find(i => i.id === id) : undefined;
  const g = item ? merge(item, all[item.id]) : null;

  function addStep(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim(); if (!title || !g) return;
    patch(g.id, m => ({ steps: [...(m.steps ?? []), { id: uid(), title, done: false }] }));
    setDraft('');
  }

  const isDone = g ? (g.repeat === 'once' ? g.done : g.log.includes(todayIso())) : false;
  const sub = g ? [when(g), g.with ? `with ${g.with}` : 'solo'].filter(Boolean).join(' · ') : '';
  const hist = g ? history(g) : null;
  const rep = g ? repeatLabel(g) : null;
  const isGoal = g && (g.kind === 'goal' || g.kind === 'system');

  return (
    <Sheet open={!!g} onClose={onClose} title={g?.title ?? ''} sub={sub} labelId="task-sheet-title">
      {g && <>
        {(g.tag || rep) && (
          <div className="g-chips">
            {g.tag && <span className="g-chip"><Icon name={g.tag.label === 'Work' ? 'goals/briefcase' : 'chip-tag'} size={16} />{g.tag.label}</span>}
            {rep && <span className="g-chip"><Icon name="goals/repeat" size={16} />{rep}</span>}
          </div>
        )}
        <div className="g-label-row"><span className="t-label c-3">Steps</span><span className="spacer" />{g.steps.length > 0 && <span className="g-meta">{g.steps.filter(s => s.done).length} of {g.steps.length}</span>}</div>
        <div className="g-steps">
          {g.steps.map(s => (
            <button key={s.id} type="button" className={`g-step${s.done ? ' is-done' : ''}`} aria-pressed={s.done}
                    onClick={() => patch(g.id, m => ({ steps: (m.steps ?? []).map(x => x.id === s.id ? { ...x, done: !x.done } : x) }))}>
              <span className={`g-check${s.done ? ' is-done' : ''}`} style={{ '--c': '22px' } as React.CSSProperties}>{s.done && <Icon name="goals/check-bold-16" size={13} />}</span>
              <span className="t-body">{s.title}</span>
            </button>
          ))}
          <form className="g-step g-step-add" onSubmit={addStep}>
            <span className="todo-plus"><Icon name="plus-sm" size={16} /></span>
            <label className="sr-only" htmlFor="g-step-input">Add a step</label>
            <input id="g-step-input" className="t-body todo-input" placeholder="Add a step" value={draft} onChange={e => setDraft(e.target.value)} enterKeyHint="done" />
          </form>
        </div>
        <label className="g-note">
          <span className="t-label c-3">Note</span>
          <textarea className="t-body g-note-input" rows={2} value={all[g.id]?.note ?? ''} onChange={e => patch(g.id, { note: e.target.value })} />
        </label>
        {hist && <p className="g-hist"><Icon name="goals/history" size={18} />{hist}</p>}
        <div className="g-actions">
          <button type="button" className="btn-primary g-grow" aria-pressed={isDone} onClick={() => mark(g)}>
            <Icon name="goals/check-bold-16" size={20} />{isDone ? 'Done' : 'Mark done'}
          </button>
          <button type="button" className="g-icon-44" aria-label="Focus" onClick={() => router.push(`/focus?id=${g.id}`)}><Icon name="goals/timer" size={20} /></button>
          <button type="button" className="g-icon-44" aria-label="Edit" onClick={() => router.push(`/goals/new?edit=${g.id}`)}><Icon name="goals/pencil" size={20} /></button>
          {isGoal && <button type="button" className="g-icon-44" aria-label="Delete" onClick={() => { patch(g.id, { hidden: true }); onClose(); }}><Icon name="goals/trash" size={20} /></button>}
        </div>
      </>}
    </Sheet>
  );
}
