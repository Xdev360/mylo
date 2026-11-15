'use client';

import { useState, type FormEvent } from 'react';
import Sheet from '../Sheet';
import { useStore } from '@/lib/store';
import { addDays, iso, todayIso } from '@/lib/dates';
import { QUICK_LIMIT } from '@/lib/goals';

/* N4 · Quick to-do (877:109146): no time, no scope. Today, tomorrow or
   someday (kept undated). Five a day, as the sheet says. */
type When = 'Today' | 'Tomorrow' | 'Someday';
export const SOMEDAY = 'someday';

export default function QuickTodoSheet({ open, onClose, day }: { open: boolean; onClose: () => void; day?: string }) {
  const { items, add } = useStore();
  const [text, setText] = useState('');
  const [when, setWhen] = useState<When>('Today');
  const today = todayIso();
  const used = items.filter(i => i.kind === 'todo' && i.date === today).length;
  const full = used >= QUICK_LIMIT && when === 'Today' && !day;
  const target = day && day !== today ? day : when === 'Today' ? today : when === 'Tomorrow' ? iso(addDays(new Date(), 1)) : SOMEDAY;

  function submit(e: FormEvent) {
    e.preventDefault();
    const title = text.trim(); if (!title || full) return;
    add({ kind: 'todo', title, date: target });
    setText(''); onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title="Quick to-do" sub="No time, no scope. Just write it down." labelId="quick-todo-title">
      <form className="g-quick" onSubmit={submit}>
        <label className="g-field8">
          <span className="g-meta11">To-do</span>
          <input className="g-input g-input-idle" value={text} onChange={e => setText(e.target.value)} placeholder="Call the bank about the card" enterKeyHint="done" />
        </label>
        {!day || day === today ? <>
          <span className="t-label c-3">When</span>
          <div className="g-chips" role="radiogroup" aria-label="When">
            {(['Today', 'Tomorrow', 'Someday'] as When[]).map(w => (
              <button key={w} type="button" role="radio" aria-checked={when === w} className="g-sound" onClick={() => setWhen(w)}>{w}</button>
            ))}
          </div>
        </> : null}
        <p className="g-meta11">{used} of {QUICK_LIMIT} quick to-dos used today.</p>
        <button type="submit" className="btn-primary" disabled={full}>Add</button>
      </form>
    </Sheet>
  );
}
