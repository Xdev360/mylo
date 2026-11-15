'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated } from '@/lib/local';
import { useStore } from '@/lib/store';
import { fromIso, todayIso } from '@/lib/dates';
import { uid, useMilestones, type Milestone } from '@/lib/apps';
import { Head } from './ui';

/* I4 · Milestones (516:101169). The big moments on the way to a goal, one
   goal at a time (the chips are your goals). Tick the next one when it
   happens; each can carry a reward for when it does. ?goal=<id> opens on
   that goal. */
const short = (d: string) => fromIso(d).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }).replace(/^(\d+) (\w+)$/, '$2 $1');

export default function Milestones() {
  const ready = useHydrated();
  const params = useSearchParams();
  const { items } = useStore();
  const [all, setAll] = useMilestones();
  const goals = items.filter(i => i.kind === 'goal');
  const [chosen, setChosen] = useState<string | null>(params.get('goal'));
  const [edit, setEdit] = useState<Milestone | 'new' | null>(null);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const goal = goals.find(g => g.id === chosen) ?? goals[0];
  const list = goal ? all.filter(m => m.goalId === goal.id).sort((a, b) => Number(b.done) - Number(a.done) || (a.date ?? '9999').localeCompare(b.date ?? '9999')) : [];
  const done = list.filter(m => m.done).length;
  const next = list.find(m => !m.done);
  const days = next?.date ? Math.round((fromIso(next.date).getTime() - fromIso(todayIso()).getTime()) / 864e5) : null;
  const toggle = (m: Milestone) => setAll(a => a.map(x => (x.id === m.id ? { ...x, done: !x.done, doneAt: !x.done ? todayIso() : undefined } : x)));

  return (
    <main className="screen on-desk ax-miles">
      <Head title="Milestones" fallback="/apps"
            right={goal ? <button type="button" className="ax-round is-40 is-line" aria-label="Add a milestone" onClick={() => setEdit('new')}><Icon name="plus-20" size={20} /></button>
              : <Link href="/goals/new" className="ax-round is-40 is-line" aria-label="New goal"><Icon name="plus-20" size={20} /></Link>} />
      {goals.length > 0 && (
        <div className="ax-chips ax-goal-chips" role="tablist" aria-label="Goals">
          {goals.map(g => <button key={g.id} type="button" role="tab" aria-selected={goal?.id === g.id} className={`ax-chip is-sm is-line${goal?.id === g.id ? ' is-on' : ''}`} onClick={() => setChosen(g.id)}>{g.title}</button>)}
        </div>
      )}
      {goal && (
        <div className="ax-miles-box">
          <span>
            <span className="t-title-s">{done} of {list.length} milestones</span>
            {days !== null && days > 0 && <span className="t-body-s c-2">Next one in about {days} {days === 1 ? 'day' : 'days'}</span>}
          </span>
          <span className="t-title-m">{list.length ? Math.round((done / list.length) * 100) : 0}%</span>
        </div>
      )}
      {!goals.length && <Link href="/goals/new" className="ax-btn ax-btn-soft">New goal</Link>}
      {list.length > 0 && (
        <ol className="ax-line">
          {list.map(m => {
            const state = m.done ? 'done' : m === next ? 'next' : 'later';
            return (
              <li key={m.id} className={`ax-mile is-${state}`}>
                <button type="button" className="ax-mile-dot" aria-label={m.done ? `Undo ${m.title}` : state === 'next' ? `Mark ${m.title} done` : `${m.title}, later`}
                        disabled={state === 'later'} onClick={() => toggle(m)}>
                  {state === 'done' && <Icon name="apps/i-check" size={20} />}
                  {state === 'next' && <img src="/figma/apps/mylo-next.svg" alt="" width={45} height={54} />}
                  {state === 'later' && <img src="/figma/apps/i-lock.svg" alt="" width={16} height={16} />}
                </button>
                <button type="button" className="ax-mile-text" onClick={() => setEdit(m)}>
                  <span className="t-title-s ax-mile-t">{m.title}</span>
                  <span className="t-caption c-3">{m.done ? short(m.doneAt ?? m.date ?? todayIso()) : state === 'next' ? 'Next' : m.date ? short(m.date) : 'Later'}</span>
                  {m.reward && <span className={`ax-mile-reward${m.done ? '' : ' is-ahead'}`}><Icon name={m.done ? 'apps/i-sparkle' : 'apps/i-gift-16'} size={16} />{m.reward}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {goal && <MilestoneSheet key={edit === 'new' ? 'new' : edit?.id ?? 'none'} edit={edit} goalId={goal.id} onClose={() => setEdit(null)}
                               onSave={m => setAll(a => (a.some(x => x.id === m.id) ? a.map(x => (x.id === m.id ? m : x)) : [...a, m]))}
                               onDelete={id => setAll(a => a.filter(x => x.id !== id))} />}
    </main>
  );
}

function MilestoneSheet({ edit, goalId, onClose, onSave, onDelete }: {
  edit: Milestone | 'new' | null; goalId: string; onClose: () => void; onSave: (m: Milestone) => void; onDelete: (id: string) => void;
}) {
  const base = edit && edit !== 'new' ? edit : null;
  const [title, setTitle] = useState(base?.title ?? '');
  const [date, setDate] = useState(base?.date ?? '');
  const [reward, setReward] = useState(base?.reward ?? '');
  const save = () => {
    if (!title.trim()) return;
    onSave({ id: base?.id ?? uid(), goalId, title: title.trim(), date: date || undefined, reward: reward.trim() || undefined, done: base?.done ?? false, doneAt: base?.doneAt });
    onClose();
  };
  return (
    <Sheet open={!!edit} onClose={onClose} title={base ? base.title : 'Add a milestone'} sub="Mark the big moments">
      <form className="ax-form" onSubmit={e => { e.preventDefault(); save(); }}>
        <input className="ax-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Run 4K" aria-label="Milestone" maxLength={60} />
        <input className="ax-input" type="date" value={date} onChange={e => setDate(e.target.value)} aria-label="Date" />
        <input className="ax-input" value={reward} onChange={e => setReward(e.target.value)} placeholder="Movie night" aria-label="Reward" maxLength={40} />
        <button type="submit" className="ax-btn" disabled={!title.trim()}>Save</button>
        {base && <button type="button" className="ax-btn ax-btn-soft c-red" onClick={() => { onDelete(base.id); onClose(); }}>Delete</button>}
      </form>
    </Sheet>
  );
}
