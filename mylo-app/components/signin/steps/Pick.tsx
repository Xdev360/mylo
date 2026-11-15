'use client';

import Icon from '@/components/Icon';
import { nextStep, type Onboarding } from '@/lib/signin';
import type { StepProps } from '../OnboardingStep';
import { Art, Cta, Foot, OnboardHeader, Screen } from '../ui';

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

export function Want({ ob, update, go }: StepProps) {
  const picked = ob.want;
  const flip = (id: string) => {
    if (picked.includes(id)) update({ want: picked.filter(w => w !== id) });
    else if (picked.length < MAX_WANTS) update({ want: [...picked, id] });
  };
  return (
    <Screen>
      <OnboardHeader progress={1} skip={nextStep('want')} fallback="/welcome" />
      <h1 className="si-title si-title-top">What do you want more of?</h1>
      <p className="t-body c-2 si-sub">Pick up to three</p>
      <div className="si-wants" role="group" aria-label="Pick up to three">
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
      <Foot note={<span className={picked.length ? '' : 'si-hide'}>{picked.length} picked. Change these anytime</span>}>
        <Cta disabled={!picked.length} onClick={() => go(nextStep('want'))}>Continue</Cta>
      </Foot>
    </Screen>
  );
}

/* ── O4 Best time (877:107800) ─────────────────────────────────────────── */
const TIMES: { id: NonNullable<Onboarding['time']>; title: string; sub: string; icon: string; tone: string; ink: string }[] = [
  { id: 'early', title: 'Early bird', sub: 'Before 9 AM', icon: 'signin/i-sunrise', tone: 'var(--tint-amber)', ink: 'var(--amber)' },
  { id: 'day', title: 'Daytime', sub: '9 AM to 5 PM', icon: 'signin/i-sun', tone: 'var(--tint-blue)', ink: 'var(--blue)' },
  { id: 'night', title: 'Night owl', sub: 'After 8 PM', icon: 'signin/i-moon', tone: 'var(--tint-blue)', ink: 'var(--blue)' }
];

export function Time({ ob, update, go }: StepProps) {
  return (
    <Screen>
      <OnboardHeader progress={2} skip={nextStep('time')} />
      <h1 className="si-title si-title-top">When do you get things done?</h1>
      <div className="si-times" role="radiogroup" aria-label="When do you get things done?">
        {TIMES.map(t => {
          const on = ob.time === t.id;
          return (
            <button key={t.id} type="button" role="radio" aria-checked={on} className={`si-time${on ? ' is-on' : ''}`} onClick={() => update({ time: t.id })}>
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
      <Foot>
        <Cta disabled={!ob.time} onClick={() => go(nextStep('time'))}>Continue</Cta>
      </Foot>
    </Screen>
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

export function Who({ ob, update, go }: StepProps) {
  return (
    <Screen>
      <OnboardHeader progress={3} skip={nextStep('who')} />
      <h1 className="si-title si-title-top">Who keeps you honest?</h1>
      <div className="si-who" role="radiogroup" aria-label="Who keeps you honest?">
        {WHO.map(w => {
          const on = ob.who === w.id;
          return (
            <button key={w.id} type="button" role="radio" aria-checked={on} className={`si-who-card${on ? ' is-on' : ''}`} onClick={() => update({ who: w.id })}>
              <WhoArt id={w.id} />
              <span className="t-title-s">{w.title}</span>
              <span className="t-caption c-2">{w.sub}</span>
            </button>
          );
        })}
      </div>
      <Foot>
        <Cta disabled={!ob.who} onClick={() => go(nextStep('who'))}>Continue</Cta>
      </Foot>
    </Screen>
  );
}
