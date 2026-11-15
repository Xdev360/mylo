'use client';

import { useRef } from 'react';
import { todayIso } from '@/lib/dates';
import { useStore } from '@/lib/store';
import { useFoot, type StepProps } from '../OnboardingFlow';
import { Art } from '../ui';

/* ── O9 First goal (877:108076). The goal goes straight onto Today's list. */
const IDEAS = ['Read 12 books', 'Build a savings habit', 'Sleep by 11', 'Ship my app'];

export function Goal({ ob, update, next }: StepProps) {
  const { items, add, update: edit } = useStore();
  // The typed goal is kept as an answer straight away; it goes onto Today
  // once, on "Save my goal", and a second visit edits that one.
  const goal = ob.goal;
  const setGoal = (v: string) => update({ goal: v });
  const clean = goal.trim();
  const saving = useRef(false);
  const save = () => {
    if (!clean || saving.current) return;
    saving.current = true;
    const mine = ob.goalId ? items.find(i => i.id === ob.goalId) : undefined;
    if (mine) { if (mine.title !== clean) edit(mine.id, { title: clean }); update({ goal: clean }); }
    else update({ goal: clean, goalId: add({ kind: 'goal', title: clean, date: todayIso() }) });
    next();
  };
  useFoot({ label: 'Save my goal', disabled: !clean, onClick: save });
  return (
    <>
      <h1 className="si-title si-title-top">Let&apos;s start with one goal</h1>
      <p className="t-body c-2 si-sub">Big or small. Mylo breaks it down.</p>
      <form className="si-goal" onSubmit={e => { e.preventDefault(); save(); }}>
        <Art name="mylo-headphones" w={130} h={156} className="si-goal-mylo" />
        <h2 className="t-title-s si-goal-q">What are you working toward?</h2>
        <label className="si-goal-field">
          <span className="t-label c-3">YOUR GOAL</span>
          <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="Run a 10K by December" maxLength={80} enterKeyHint="done" autoComplete="off" />
        </label>
        <div className="si-chips si-goal-chips">
          {IDEAS.map(g => <button key={g} type="button" className="si-chip is-raised" aria-pressed={clean === g} onClick={() => setGoal(g)}>{g}</button>)}
        </div>
      </form>
    </>
  );
}

/* ── O10 First badge (877:108114). ─────────────────────────────────────── */
export function Badge({ next }: StepProps) {
  useFoot({ label: 'Save my progress', note: 'Takes 10 seconds', onClick: () => next() });
  return (
    <>
      <span className="si-rays" aria-hidden />
      <h1 className="si-title si-title-top">A good start</h1>
      <p className="t-body c-2 si-sub">You set your first goal</p>
      <Art name="level-badge" w={208} h={208} className="si-badge" />
      <h2 className="t-title-m si-badge-name">Level 1 · Spark</h2>
      <p className="t-body-s c-2 si-badge-line">Every goal you tick earns XP. Next stop: Ember.</p>
    </>
  );
}
