'use client';

import { useState } from 'react';
import Icon from '../Icon';
import TaskSheet from './TaskSheet';
import { Check, TICK_XP, XpPill, useBurst, useCelebrate } from './Tick';
import { useStore, type Item } from '@/lib/store';
import { fromIso } from '@/lib/dates';
import { goalsOf, isPlanned, merge, useMeta, type Meta } from '@/lib/goals';

/* What is on a day: the store's tasks, to-dos and goals dated that day, and
   every repeating goal planned for it. One row each, as the TaskRow
   component draws them (E3 and N7). */
export type DayThing = { id: string; title: string; time?: string; minutes?: number; with?: string; tag?: Item['tag']; done: boolean; repeat: boolean; room?: boolean };

export function thingsOn(items: Item[], all: Record<string, Meta>, day: string): DayThing[] {
  const dated = items.filter(i => !all[i.id]?.hidden && merge(i, all[i.id]).date === day)
    .map(i => merge(i, all[i.id]))
    .filter(g => g.repeat === 'once')
    .map(g => ({ id: g.id, title: g.title, time: g.time, minutes: g.minutes, with: g.with, tag: g.tag, done: g.done, repeat: false, room: g.room }));
  const repeating = goalsOf(items, all).filter(g => g.repeat !== 'once' && g.date <= day && isPlanned(g, fromIso(day)))
    .map(g => ({ id: g.id, title: g.title, time: g.time, minutes: g.minutes, with: g.with, tag: g.tag, done: g.log.includes(day), repeat: true, room: g.room }));
  return [...dated, ...repeating].sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
}

export function useToggleThing(day: string) {
  const { toggle } = useStore();
  const { patch } = useMeta();
  const celebrate = useCelebrate();
  return (t: DayThing) => {
    if (t.repeat) patch(t.id, m => ({ log: t.done ? (m.log ?? []).filter(d => d !== day) : [...(m.log ?? []), day] }));
    else toggle(t.id);
    if (!t.done) celebrate({ sub: t.with ? `${t.with} sees it too` : undefined, href: t.room ? '/rooms' : undefined });
  };
}

export default function DayItems({ day, things }: { day: string; things: DayThing[] }) {
  const tick = useToggleThing(day);
  const [burst, fire] = useBurst();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <>
      {things.map(t => {
        const meta = [t.time ? [t.time, t.minutes ? `${t.minutes} min` : null].filter(Boolean).join(' · ') : t.minutes ? `${t.minutes} min` : null, t.with ? 'shared' : null].filter(Boolean).join(' · ');
        const key = `${t.id}:${day}`;
        return (
          <div key={key} className={`g-trow${t.done ? ' is-done' : ''}${burst === key ? ' is-burst' : ''}`}>
            <button type="button" className="g-trow-check" aria-pressed={t.done} aria-label={`${t.done ? 'Undo' : 'Tick'} ${t.title}`}
                    onClick={() => { tick(t); if (!t.done) fire(key); }}>
              <Check done={t.done} burst={burst === key} size={28} />
            </button>
            <button type="button" className="g-trow-body" onClick={() => setOpen(t.id)}>
              <span className="g-trow-title">{t.title}</span>
              {(meta || t.tag) && (
                <span className="g-trow-meta">
                  {meta && <><Icon name="goals/clock-12" size={12} />{meta}</>}
                  {meta && t.tag && <i className="g-dot4" />}
                  {t.tag?.label}
                </span>
              )}
            </button>
            {/* E3's TaskRow trails the XP a tick is worth; the burst pill takes its place. */}
            {burst === key ? <XpPill on /> : <span className="g-trow-xp">{TICK_XP.replace(' XP', '')}</span>}
          </div>
        );
      })}
      <TaskSheet id={open} onClose={() => setOpen(null)} />
    </>
  );
}
