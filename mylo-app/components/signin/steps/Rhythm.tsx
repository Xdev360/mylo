'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { clock } from '@/lib/dates';
import { useFoot, type StepProps } from '../OnboardingFlow';

/* ── O8 Daily rhythm (877:108021). The dial runs once round for an hour, in
   five minute steps: drag the knob, tap the ring, use the arrow keys, or
   pick one of the three chips. ───────────────────────────────────────── */
const R = 110;
const C = 2 * Math.PI * R;
const CHIPS = [15, 30, 60];
const clampMin = (m: number) => Math.max(5, Math.min(60, m));

function Dial({ minutes, onChange }: { minutes: number; onChange: (m: number) => void }) {
  const ref = useRef<SVGSVGElement>(null);
  const frac = minutes / 60;
  const a = frac * 2 * Math.PI;
  const knob = { x: 120 + R * Math.sin(a), y: 120 - R * Math.cos(a) };

  const fromPointer = (e: React.PointerEvent) => {
    const box = ref.current!.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = e.clientY - (box.top + box.height / 2);
    let f = (Math.atan2(dx, -dy) / (2 * Math.PI) + 1) % 1;
    // Past the top from a full hour stays full rather than jumping to empty.
    if (minutes >= 45 && f < 0.25) f = 1;
    if (minutes <= 15 && f > 0.75) f = 0;
    onChange(clampMin(Math.round(f * 12) * 5));
  };

  return (
    <svg ref={ref} className="si-dial" viewBox="0 0 240 240" role="slider" tabIndex={0}
         aria-label="Minutes a day" aria-valuemin={5} aria-valuemax={60} aria-valuenow={minutes} aria-valuetext={`${minutes} minutes a day`}
         onPointerDown={e => { (e.currentTarget as Element).setPointerCapture(e.pointerId); fromPointer(e); }}
         onPointerMove={e => { if (e.buttons) fromPointer(e); }}
         onKeyDown={e => {
           if (e.key === 'ArrowUp' || e.key === 'ArrowRight') { e.preventDefault(); onChange(clampMin(minutes + 5)); }
           if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') { e.preventDefault(); onChange(clampMin(minutes - 5)); }
         }}>
      <circle cx="120" cy="120" r={R} className="si-dial-track" />
      <circle cx="120" cy="120" r={R} className="si-dial-arc" strokeDasharray={`${frac * C} ${C}`} transform="rotate(-90 120 120)" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x="119" y={120 - 112 - 4} width="2" height="8" className="si-dial-tick" transform={`rotate(${i * 30} 120 120)`} />
      ))}
      <circle cx={knob.x} cy={knob.y} r="13.5" className="si-dial-knob" />
    </svg>
  );
}

export function Rhythm({ ob, update, next }: StepProps) {
  // A draft until "Set my rhythm"; Back and forward keep it, Skip leaves the
  // saved answer as it was.
  const [minutes, setMinutes] = useState(() => draft?.minutes ?? ob.minutes ?? 30);
  const [nudge, setNudge] = useState(() => draft?.nudge ?? ob.nudge);
  const [at, setAt] = useState(() => draft?.at ?? ob.nudgeTime);
  useEffect(() => { draft = { minutes, nudge, at }; }, [minutes, nudge, at]);
  useFoot({
    label: 'Set my rhythm', onClick: () => { update({ minutes, nudge, nudgeTime: at }); next(); },
    note: 'Skip for now', onNote: () => next({ skipped: true })
  });
  const timeRef = useRef<HTMLInputElement>(null);
  const pickTime = () => {
    const el = timeRef.current; if (!el) return;
    try { el.showPicker(); } catch { el.focus(); el.click(); }
  };
  return (
    <>
      <h1 className="si-title si-title-top">Small time, big wins</h1>
      <p className="t-body c-2 si-sub">How long can you give each day?</p>
      <div className="si-dial-wrap">
        <Dial minutes={minutes} onChange={setMinutes} />
        <p className="si-dial-value" aria-hidden><span>{minutes}</span><span className="t-label c-3">MIN / DAY</span></p>
      </div>
      <div className="si-chips si-rhythm-chips">
        {CHIPS.map(m => (
          <button key={m} type="button" className={`si-chip${minutes === m ? ' is-blue' : ''}`} aria-pressed={minutes === m} onClick={() => setMinutes(m)}>{m} min</button>
        ))}
      </div>
      <div className="si-nudge">
        <Icon name="signin/i-bell" size={22} />
        <span className="si-nudge-text">
          <span className="t-body">A little nudge</span>
          <button type="button" className="t-caption c-2 si-nudge-time" onClick={pickTime}>{clock(at)} · your call</button>
          <input ref={timeRef} type="time" className="si-time-input" value={at} step={300} tabIndex={-1} aria-label="Nudge time"
                 onChange={e => e.target.value && setAt(e.target.value)} />
        </span>
        <button type="button" role="switch" aria-checked={nudge} aria-label="A little nudge" className="si-switch" onClick={() => setNudge(n => !n)} />
      </div>
    </>
  );
}
let draft: { minutes: number; nudge: boolean; at: string } | null = null;
