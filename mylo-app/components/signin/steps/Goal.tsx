'use client';

import { useState } from 'react';
import { todayIso } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { nextStep } from '@/lib/signin';
import { useStore } from '@/lib/store';
import type { StepProps } from '../OnboardingStep';
import { Art, Cta, Foot, OnboardHeader, Screen } from '../ui';

/* ── O9 First goal (877:108076). The goal goes straight onto Today's list. */
const IDEAS = ['Read 12 books', 'Build a savings habit', 'Sleep by 11', 'Ship my app'];

export function Goal({ ob, update, go }: StepProps) {
  const { items, add, update: edit } = useStore();
  const [goal, setGoal] = useState(ob.goal);
  const clean = goal.trim();
  const save = () => {
    if (!clean) return;
    const mine = ob.goalId ? items.find(i => i.id === ob.goalId) : undefined;
    if (mine) { edit(mine.id, { title: clean }); update({ goal: clean }); }
    else update({ goal: clean, goalId: add({ kind: 'goal', title: clean, date: todayIso() }) });
    go(nextStep('goal'));
  };
  return (
    <Screen>
      <OnboardHeader progress={7} skip="/onboarding/save" />
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
      <Foot>
        <Cta disabled={!clean} onClick={save}>Save my goal</Cta>
      </Foot>
    </Screen>
  );
}

/* ── O10 First badge (877:108114). ─────────────────────────────────────── */
export function Badge({ go }: StepProps) {
  const { session } = useSession();
  return (
    <Screen className="si-badge-screen">
      <span className="si-rays" aria-hidden />
      <OnboardHeader progress={8} />
      <h1 className="si-title si-title-top">A good start</h1>
      <p className="t-body c-2 si-sub">You set your first goal</p>
      <Art name="level-badge" w={208} h={208} className="si-badge" />
      <h2 className="t-title-m si-badge-name">Level 1 · Spark</h2>
      <p className="t-body-s c-2 si-badge-line">Every goal you tick earns XP. Next stop: Ember.</p>
      <Foot note="Takes 10 seconds">
        <Cta onClick={() => go(session ? '/onboarding/photo' : nextStep('badge'))}>Save my progress</Cta>
      </Foot>
    </Screen>
  );
}
