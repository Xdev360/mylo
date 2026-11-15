'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import type { Onboarding } from '@/lib/signin';
import { useFoot, type StepProps } from '../OnboardingFlow';
import { Art } from '../ui';

/* ── O3 What you want (877:107732) ─────────────────────────────────────── */
const WANTS = [
  { id: 'focus', title: 'Focus', sub: 'Fewer tabs, more done', tone: '#D8E9FF' },
  { id: 'fitness', title: 'Fitness', sub: 'Move most days', tone: '#D6F5E8' },
  { id: 'reading', title: 'Reading', sub: 'Pages, not scrolling', tone: '#ECE6FF' },
  { id: 'sleep', title: 'Better sleep', sub: 'Wind down on time', tone: '#FFE3EC' },
  { id: 'money', title: 'Money habits', sub: 'Spend with a plan', tone: '#FFF2C2' },
  { id: 'calm', title: 'Calm', sub: 'Breathe more, rush less', tone: '#FFE6DA' }
];
const MAX_WANTS = 3;

export function Want({ ob, update, next }: StepProps) {
  const picked = ob.want;
  const [touched, setTouched] = useState(false);
  const [full, setFull] = useState(0);
  const flip = (id: string) => {
    setTouched(true);
    if (picked.includes(id)) { setFull(0); update({ want: picked.filter(w => w !== id) }); }
    else if (picked.length < MAX_WANTS) update({ want: [...picked, id] });
    else setFull(n => n + 1); // a fourth tap: the line below says why nothing happened
  };
  useFoot({
    label: 'Continue', disabled: !picked.length, onClick: () => next(),
    note: picked.length >= MAX_WANTS && full ? 'Three is the most. Tap one to swap it' : `${picked.length} picked. Change these anytime`,
    noteHidden: !picked.length
  });
  return (
    <>
      <h1 className="si-title si-title-top">What do you want more of?</h1>
      <p className="t-body c-2 si-sub">Pick up to three</p>
      <div className="si-wants" role="group" aria-label="Pick up to three" data-touched={touched || undefined}>
        {WANTS.map(w => {
          const on = picked.includes(w.id);
          const full = !on && picked.length >= MAX_WANTS;
          return (
            <button key={w.id} type="button" className={`si-want${on ? ' is-on' : ''}`} aria-pressed={on} aria-disabled={full || undefined}
                    style={on ? { background: w.tone } : undefined} onClick={() => flip(w.id)}>
              <span className="si-want-text">
                <span className="t-title-s">{w.title}</span>
                <span className="t-caption si-want-sub">{w.sub}</span>
              </span>
              <span className="si-want-tile"><Art name={`want-${w.id}`} w={102} h={123} /></span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* ── O4 Best time (877:107800) ─────────────────────────────────────────── */
const TIMES: { id: NonNullable<Onboarding['time']>; title: string; sub: string; icon: string; tone: string; ink: string }[] = [
  { id: 'early', title: 'Early bird', sub: 'Before 9 AM', icon: 'signin/i-sunrise', tone: 'var(--tint-amber)', ink: 'var(--amber)' },
  { id: 'day', title: 'Daytime', sub: '9 AM to 5 PM', icon: 'signin/i-sun', tone: 'var(--tint-blue)', ink: 'var(--blue)' },
  { id: 'night', title: 'Night owl', sub: 'After 8 PM', icon: 'signin/i-moon', tone: 'var(--tint-blue)', ink: 'var(--blue)' }
];

export function Time({ ob, update, next }: StepProps) {
  const [touched, setTouched] = useState(false);
  useFoot({ label: 'Continue', disabled: !ob.time, onClick: () => next() });
  return (
    <>
      <h1 className="si-title si-title-top">When do you get things done?</h1>
      <div className="si-times" role="radiogroup" aria-label="When do you get things done?" data-touched={touched || undefined}
           onKeyDown={e => radioKeys(e, TIMES.map(t => t.id), ob.time, id => { setTouched(true); update({ time: id }); })}>
        {TIMES.map(t => {
          const on = ob.time === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} tabIndex={on || (!ob.time && t === TIMES[0]) ? 0 : -1}
                    className={`si-time${on ? ' is-on' : ''}`} onClick={() => { setTouched(true); update({ time: t.id }); }}>
              <span className="si-time-icon" style={{ background: t.tone, color: t.ink }}><Icon name={t.icon} size={28} /></span>
              <span className="si-time-text"><span className="t-title-s">{t.title}</span><span className="t-body-s c-2">{t.sub}</span></span>
            </button>
          );
        })}
      </div>
      <p className="si-hint">
        <Art name="mylo-wink" w={36} h={43} />
        <span className="t-body-s c-2">Mylo plans your hard stuff for this window.</span>
      </p>
    </>
  );
}

/* ── O5 Who (877:107843) ───────────────────────────────────────────────── */
const WHO: { id: NonNullable<Onboarding['who']>; title: string; sub: string }[] = [
  { id: 'me', title: 'Just me', sub: 'Mylo has your back' },
  { id: 'partner', title: 'A partner', sub: 'Two of you, one room' },
  { id: 'crew', title: 'My crew', sub: 'Up to 5 people' },
  { id: 'unsure', title: 'Not sure yet', sub: 'Decide later' }
];

function WhoArt({ id }: { id: NonNullable<Onboarding['who']> }) {
  if (id === 'partner') return (
    <span className="si-who-art">
      <span className="si-disc si-who-disc" />
      <Art name="people-peach" w={72} h={86} className="si-who-a" />
      <Art name="people-blue" w={72} h={86} className="si-who-b" />
    </span>
  );
  if (id === 'crew') return (
    <span className="si-who-art">
      <Art name="crew-mint" w={58} h={70} className="si-who-c1" />
      <Art name="crew-yellow" w={58} h={70} className="si-who-c2" />
      <Art name="crew-purple" w={58} h={70} className="si-who-c3" />
    </span>
  );
  return <span className="si-who-art"><Art name="mylo-happy" w={84} h={101} className="si-who-solo" /></span>;
}

export function Who({ ob, update, next }: StepProps) {
  const [touched, setTouched] = useState(false);
  useFoot({ label: 'Continue', disabled: !ob.who, onClick: () => next() });
  return (
    <>
      <h1 className="si-title si-title-top">Who keeps you honest?</h1>
      <div className="si-who" role="radiogroup" aria-label="Who keeps you honest?" data-touched={touched || undefined}
           onKeyDown={e => radioKeys(e, WHO.map(w => w.id), ob.who, id => { setTouched(true); update({ who: id }); })}>
        {WHO.map(w => {
          const on = ob.who === w.id;
          return (
            <button key={w.id} type="button" role="radio" aria-checked={on} tabIndex={on || (!ob.who && w === WHO[0]) ? 0 : -1}
                    className={`si-who-card${on ? ' is-on' : ''}`} onClick={() => { setTouched(true); update({ who: w.id }); }}>
              <WhoArt id={w.id} />
              <span className="t-title-s">{w.title}</span>
              <span className="t-caption c-2">{w.sub}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

/* Arrow keys move the pick round a radio group, and focus with it. */
function radioKeys<T extends string>(e: React.KeyboardEvent<HTMLElement>, ids: T[], cur: T | null, pick: (id: T) => void) {
  const step = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
  if (!step) return;
  e.preventDefault();
  const at = cur ? ids.indexOf(cur) : step > 0 ? -1 : 0;
  const i = (at + step + ids.length) % ids.length;
  pick(ids[i]);
  (e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[i])?.focus();
}
