'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import Sheet from '../Sheet';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/lib/local';
import { todayIso } from '@/lib/dates';
import { TONE, TYPES, goalsOf, merge, useMeta, type Meta, type Repeat, type Tag } from '@/lib/goals';
import { goBack } from '@/components/NavMotion';

/* D3 · New goal, repeat built in (878:114556). One form for a one-off goal,
   a routine on some days or every day; ?edit=<id> opens it filled in. */
const REPEATS: { id: Repeat; label: string }[] = [{ id: 'once', label: 'Once' }, { id: 'daily', label: 'Every day' }, { id: 'days', label: 'Some days' }];
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function NewGoal() {
  const ready = useHydrated();
  return ready ? <Form /> : <main className="screen on-desk" aria-busy="true" />;
}

function Form() {
  const router = useRouter();
  const q = useSearchParams();
  const { items, add } = useStore();
  const { all, patch } = useMeta();
  const editId = q.get('edit');
  const editing = editId ? items.find(i => i.id === editId) : undefined;
  const start = editing ? merge(editing, all[editing.id]) : null;

  const [title, setTitle] = useState(start?.title ?? q.get('title') ?? '');
  const [tag, setTag] = useState<Tag | undefined>(start?.tag);
  const [repeat, setRepeat] = useState<Repeat>(start?.repeat ?? (q.get('repeat') === 'daily' ? 'daily' : 'once'));
  const [days, setDays] = useState<number[]>(start?.days.length ? start.days : []);
  const [time, setTime] = useState(start?.time ?? '');
  const [room, setRoom] = useState(!!start?.room);
  const [parent, setParent] = useState(start?.parent);
  const [picking, setPicking] = useState(false);
  const [pending, setPending] = useState<{ before: Set<string>; meta: Meta; title: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  const parents = goalsOf(items, all).filter(g => g.id !== editId && !g.done);
  const parentGoal = parents.find(g => g.id === parent);

  // The store names a new item itself; once it lands, give it its details.
  useEffect(() => {
    if (!pending) return;
    const made = items.find(i => !pending.before.has(i.id) && i.title === pending.title);
    if (!made) return;
    patch(made.id, pending.meta);
    router.replace(`/goals/${made.id}`);
  }, [items, pending, patch, router]);

  function save() {
    const t = title.trim();
    if (!t) { input.current?.focus(); return; }
    const rep: Repeat = repeat === 'days' && !days.length ? 'once' : repeat;
    const meta: Meta = { repeat: rep, days: rep === 'days' ? days : [], room, parent, time: time || undefined, tag };
    if (editing) {
      patch(editing.id, { ...meta, title: t });
      router.replace(`/goals/${editing.id}`);
      return;
    }
    setPending({ before: new Set(items.map(i => i.id)), meta, title: t });
    add({ kind: rep === 'once' ? 'goal' : 'system', title: t, date: q.get('date') ?? todayIso(), time: time || undefined, tag });
  }

  const close = () => (window.history.length > 1 ? goBack(router) : router.push('/goals'));

  return (
    <main className="screen on-desk g-form">
      <header className="screen-header">
        <button type="button" className="back-btn" aria-label="Close" onClick={close}><Icon name="goals/nav-close" size={20} /></button>
        <h1 className="screen-header-title">{editing ? 'Edit' : 'New goal'}</h1>
        <div className="screen-header-actions" />
      </header>

      <label className="g-field">
        <span className="t-body-s c-2">What do you want to do?</span>
        <input ref={input} className="g-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Run 3 times a week" enterKeyHint="done" />
      </label>

      <div className="g-field">
        <span className="t-body-s c-2" id="g-type">Type</span>
        <div className="g-types" role="radiogroup" aria-labelledby="g-type">
          {TYPES.map(t => {
            const on = tag?.label === t.label;
            return (
              <button key={t.label} type="button" role="radio" aria-checked={on} className={`g-type${on ? ' is-on' : ''}`}
                      style={on ? { background: TONE[t.tone].tint } : undefined} onClick={() => setTag(on ? undefined : t)}>
                <span className="g-type-dot" style={{ background: TONE[t.tone].ink }} />{t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="g-field">
        <span className="t-body-s c-2" id="g-repeat">Repeat</span>
        <div className="g-seg g-seg-40" role="radiogroup" aria-labelledby="g-repeat">
          {REPEATS.map(r => (
            <button key={r.id} type="button" role="radio" aria-checked={repeat === r.id} className="g-seg-btn" onClick={() => setRepeat(r.id)}>{r.label}</button>
          ))}
        </div>
        {repeat === 'days' && (
          <div className="g-days" role="group" aria-label="Days">
            {LETTERS.map((l, i) => (
              <button key={i} type="button" className="g-day" aria-pressed={days.includes(i)} aria-label={DAY_NAMES[i]}
                      onClick={() => setDays(d => d.includes(i) ? d.filter(x => x !== i) : [...d, i].sort())}>{l}</button>
            ))}
          </div>
        )}
      </div>

      <div className="g-rows">
        <label className="g-set">
          <span className="g-set-icon"><Icon name="goals/time" size={24} /></span>
          <span className="g-set-text"><span className="g-set-title">Time</span></span>
          <span className="g-set-value">{time || 'Any time'}</span>
          <input ref={timeRef} type="time" className="g-time-input" value={time} onChange={e => setTime(e.target.value)} aria-label="Time" />
        </label>
        <button type="button" className="g-set is-tall" role="switch" aria-checked={room} onClick={() => setRoom(r => !r)}>
          <span className="g-set-icon"><Icon name="goals/room" size={24} /></span>
          <span className="g-set-text"><span className="g-set-title">Share with a room</span></span>
          <span className="g-switch" aria-hidden />
        </button>
        <button type="button" className="g-set is-tall" onClick={() => setPicking(true)}>
          <span className="g-set-icon"><Icon name="goals/goal-target" size={24} /></span>
          <span className="g-set-text"><span className="g-set-title">Part of a bigger goal</span>{parentGoal && <span className="t-body-s c-2">{parentGoal.title}</span>}</span>
          <Icon name="chevron-right" size={22} className="c-3" />
        </button>
      </div>

      <p className="g-help">Habits, systems and to-dos are all just goals with a repeat. One place, one list.</p>

      <div className="g-form-foot">
        <button type="button" className="g-btn-ink" onClick={save} disabled={!!pending}>Save goal</button>
      </div>

      <Sheet open={picking} onClose={() => setPicking(false)} title="Part of a bigger goal">
        <div className="g-steps" role="radiogroup" aria-label="Part of a bigger goal">
          {parents.map(g => (
            <button key={g.id} type="button" role="radio" aria-checked={parent === g.id} className="g-step"
                    onClick={() => { setParent(parent === g.id ? undefined : g.id); setPicking(false); }}>
              <span className={`g-check${parent === g.id ? ' is-done' : ''}`} style={{ '--c': '22px' } as React.CSSProperties}>{parent === g.id && <Icon name="goals/check-bold-16" size={13} />}</span>
              <span className="t-body">{g.title}</span>
            </button>
          ))}
          {parents.length === 0 && <p className="g-step t-body c-2">No goals yet.</p>}
        </div>
      </Sheet>
    </main>
  );
}
