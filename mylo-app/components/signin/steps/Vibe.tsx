'use client';

import { useRef, useState } from 'react';
import { DEFAULT_MYLO_NAME, nextStep, type Vibe } from '@/lib/signin';
import type { StepProps } from '../OnboardingStep';
import { Art, Cta, Foot, OnboardHeader, Screen } from '../ui';

/* ── O6 Meet your Mylo (877:107943), XT1a Gentle (797:90783), XT1b Coach
   (797:90898): one card in the middle, its neighbours smaller and faded on
   either side. Swipe, tap a neighbour, or use the arrow keys. ──────────── */
export const VIBES: { id: Vibe; label: string; tag: string; line: string; tone: string }[] = [
  { id: 'gentle', label: 'Gentle', tag: 'GENTLE', line: 'Small steps. No guilt.', tone: '#ECFAF3' },
  { id: 'playful', label: 'Playful', tag: 'PLAYFUL', line: 'Cheers loud. Makes it fun.', tone: '#FFF3EC' },
  { id: 'coach', label: 'Coach', tag: 'COACH', line: 'Firm nudges when you drift.', tone: '#EEF4FF' }
];
const GAP = 246;

export function VibePick({ ob, update, go }: StepProps) {
  const [at, setAt] = useState(() => Math.max(0, VIBES.findIndex(v => v.id === ob.vibe)));
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const moved = useRef(false);
  const v = VIBES[at];
  const to = (i: number) => setAt(Math.max(0, Math.min(VIBES.length - 1, i)));

  return (
    <Screen>
      <OnboardHeader progress={4} />
      <h1 className="si-title si-title-top">Who matches your vibe?</h1>
      <div className="si-vibes" role="radiogroup" aria-label="Who matches your vibe?"
           onKeyDown={e => { if (e.key === 'ArrowRight') to(at + 1); if (e.key === 'ArrowLeft') to(at - 1); }}
           onPointerDown={e => { start.current = e.clientX; moved.current = false; }}
           onPointerMove={e => { if (start.current === null) return; const dx = e.clientX - start.current; if (Math.abs(dx) > 6) moved.current = true; setDrag(dx); }}
           onPointerUp={() => { if (drag < -50) to(at + 1); else if (drag > 50) to(at - 1); start.current = null; setDrag(0); }}
           onPointerCancel={() => { start.current = null; setDrag(0); }}
           onPointerLeave={() => { if (start.current === null) return; if (drag < -50) to(at + 1); else if (drag > 50) to(at - 1); start.current = null; setDrag(0); }}>
        {VIBES.map((c, i) => {
          const on = i === at;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} aria-label={`${c.label} Mylo. ${c.line}`}
                    tabIndex={on ? 0 : -1} className={`si-vibe${on ? ' is-on' : ''}`}
                    style={{ '--x': `${(i - at) * GAP + drag}px`, background: `linear-gradient(${c.tone}, #FFFFFF)`, transition: drag ? 'none' : undefined } as React.CSSProperties}
                    onClick={() => { if (!moved.current) to(i); }}>
              <Art name={`vibe-${c.id}`} w={170} h={204} className="si-vibe-mylo" />
              <span className="si-vibe-tag">{c.tag}</span>
              <span className="si-vibe-line">{c.line}</span>
            </button>
          );
        })}
      </div>
      <div className="si-vibe-name">
        <p className="si-name-big">{ob.myloName || DEFAULT_MYLO_NAME}</p>
        <p className="t-body-s c-2">{v.label} Mylo</p>
        <div className="si-dots-row" aria-hidden>{VIBES.map((c, i) => <span key={c.id} className={i === at ? 'is-on' : ''} />)}</div>
      </div>
      <Foot note="Swap anytime">
        <Cta onClick={() => { update({ vibe: v.id }); go(nextStep('vibe')); }}>That&apos;s my Mylo</Cta>
      </Foot>
    </Screen>
  );
}

/* ── O7 Name your Mylo (877:107987) ────────────────────────────────────── */
const NAMES = ['Biscuit', 'Pip', 'Nova', 'Toast'];
const MAX_NAME = 12;

export function Name({ ob, update, go }: StepProps) {
  const [name, setName] = useState(ob.myloName);
  const clean = name.trim();
  const save = () => { if (!clean) return; update({ myloName: clean }); go(nextStep('name')); };
  return (
    <Screen>
      <OnboardHeader progress={5} />
      <h1 className="si-title si-title-top">Give your Mylo a name</h1>
      <span className="si-ring si-name-ring"><Art name="mylo-love" w={141} h={169} /></span>
      <form className="si-name-form" onSubmit={e => { e.preventDefault(); save(); }}>
        <label className="si-name-field">
          <span className="sr-only">Your Mylo&apos;s name</span>
          <input value={name} maxLength={MAX_NAME} onChange={e => setName(e.target.value)} autoComplete="off" autoCapitalize="words" enterKeyHint="next" />
          <span className="t-caption c-3">{name.length}/{MAX_NAME}</span>
        </label>
        <div className="si-chips">
          {NAMES.map(n => <button key={n} type="button" className="si-chip" aria-pressed={clean === n} onClick={() => setName(n)}>{n}</button>)}
        </div>
      </form>
      <Foot>
        <Cta disabled={!clean} onClick={save}>Continue</Cta>
      </Foot>
    </Screen>
  );
}
