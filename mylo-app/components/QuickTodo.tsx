'use client';

import { useState, type FormEvent } from 'react';
import Icon from './Icon';
import { useStore } from '@/lib/store';
import { XpPill, useBurst, useCelebrate } from './goals/Tick';
import { todayIso } from '@/lib/dates';

/* "Quick to-do" in C2 (877:108665 and 877:108668): an add row with its Return
   hint, then today's to-dos; ticking strikes one through. A tick plays C3's
   moment (877:109660): the row goes green with its "+20 XP" pill and the
   glass toast rises over the tab bar. */
export default function QuickTodo() {
  const { items, add, toggle } = useStore();
  const celebrate = useCelebrate();
  const [burst, fire] = useBurst();
  const [draft, setDraft] = useState('');
  const todos = items.filter(i => i.kind === 'todo' && i.date === todayIso());
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
        {todos.length > 0 && <span className="t-body-s c-2">{done} of {todos.length}</span>}
      </div>
      <div className="card list todo">
        <form className="todo-row todo-add" onSubmit={submit}>
          <span className="todo-plus"><Icon name="plus-sm" size={16} /></span>
          <label className="sr-only" htmlFor="quick-todo">Add a quick to-do</label>
          <input id="quick-todo" className="t-body todo-input" placeholder="Add a quick to-do"
                 value={draft} onChange={e => setDraft(e.target.value)} enterKeyHint="done" />
          <span className="todo-key t-caption c-3">Return</span>
        </form>
        {todos.map(t => (
          <button key={t.id} type="button" className={`todo-row${t.done ? ' is-done' : ''}${burst === t.id ? ' is-burst' : ''}`}
                  aria-pressed={t.done} onClick={() => { toggle(t.id); if (!t.done) { fire(t.id); celebrate({}); } }}>
            <span className="todo-check">{t.done && <Icon name="check" size={16} />}</span>
            <span className="t-body todo-text">{t.title}</span>
            <XpPill on={burst === t.id} />
          </button>
        ))}
      </div>
    </>
  );
}
