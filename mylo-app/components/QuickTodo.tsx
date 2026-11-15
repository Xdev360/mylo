'use client';

import { useState, type FormEvent } from 'react';
import Icon from './Icon';
import { useStore } from '@/lib/store';
import { dayThings, useMeta } from '@/lib/goals';
import { Roll, XpPill, useBurst } from './goals/Tick';
import { useToggleThing } from './goals/DayItems';
import { todayIso } from '@/lib/dates';

/* "Quick to-do" in C2 (877:108665 and 877:108668): an add row with its Return
   hint, then today's to-dos; ticking strikes one through. A tick plays C3's
   moment (877:109660): the row goes green with its "+20 XP" pill and the
   glass toast rises over the tab bar. A new to-do slides in under the field,
   which keeps the focus so the next one can follow straight away. */
export default function QuickTodo() {
  const { items, add } = useStore();
  const { all } = useMeta();
  const [burst, fire] = useBurst();
  const tick = useToggleThing(todayIso());
  const [draft, setDraft] = useState('');
  const todos = dayThings(items, all, todayIso()).filter(i => i.kind === 'todo');
  const [seen] = useState(() => new Set(todos.map(t => t.id)));
  const done = todos.filter(t => t.done).length;

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    add({ kind: 'todo', title, date: todayIso() });
    setDraft('');
  }

  return (
    <>
      <div className="section-head">
        <h2 className="t-title-m">Quick to-do</h2>
        {todos.length > 0 && <span className="t-body-s c-2"><Roll value={done} /> of {todos.length}</span>}
      </div>
      <div className="card list todo">
        <form className="todo-row todo-add" onSubmit={submit}>
          <span className="todo-plus"><Icon name="plus-sm" size={16} /></span>
          <label className="sr-only" htmlFor="quick-todo">Add a quick to-do</label>
          <input id="quick-todo" className="t-body todo-input" placeholder="Add a quick to-do" autoComplete="off" maxLength={120}
                 value={draft} onChange={e => setDraft(e.target.value)} enterKeyHint="done" />
          <span className={`todo-key t-caption c-3${draft.trim() ? ' is-ready' : ''}`}>Return</span>
        </form>
        {todos.map(t => (
          <div key={t.id} className={`row-wrap${seen.has(t.id) ? '' : ' is-new'}`}>
            <div>
              <button type="button" className={`todo-row${t.done ? ' is-done' : ''}${burst === t.id ? ' is-burst' : ''}`}
                      aria-pressed={t.done} onClick={() => { tick(t); if (!t.done) fire(t.id); }}>
                <span className="todo-check">{t.done && <Icon name="check" size={16} />}</span>
                <span className="t-body todo-text">{t.title}</span>
                <XpPill on={burst === t.id} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
