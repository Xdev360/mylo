'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import { useMarkDone } from './TaskSheet';
import { useStore } from '@/lib/store';
import { useLocal, useHydrated } from '@/lib/local';
import { merge, useMeta } from '@/lib/goals';
import { canGoBack, goBack } from '@/components/NavMotion';

/* C5 · Focus timer (877:109567). Counts down the task's length (25 minutes
   when it has none), keeps going if you leave and come back, plays a quiet
   sound if you pick one, and "Done early" ticks the task. */
type Sound = 'Silence' | 'Rain' | 'Café' | 'Lo-fi';
const SOUNDS: Sound[] = ['Silence', 'Rain', 'Café', 'Lo-fi'];
type Run = { id: string; total: number; startedAt: number | null; spent: number };

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/* Generated noise, so nothing is downloaded: rain is bright, the café is
   low and round, lo-fi is soft and warm. */
function useNoise(sound: Sound, on: boolean) {
  const ctx = useRef<AudioContext | null>(null);
  useEffect(() => {
    if (!on || sound === 'Silence') return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ac = ctx.current ?? (ctx.current = new AC());
    void ac.resume();
    const len = ac.sampleRate * 4;
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = sound === 'Rain' ? white : (last + 0.02 * white) / 1.02;
      data[i] = sound === 'Rain' ? last * 0.35 : last * 3.2;
    }
    const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ac.createBiquadFilter();
    filter.type = sound === 'Rain' ? 'highpass' : 'lowpass';
    filter.frequency.value = sound === 'Rain' ? 900 : sound === 'Café' ? 700 : 420;
    const gain = ac.createGain(); gain.gain.value = sound === 'Lo-fi' ? 0.5 : 0.35;
    src.connect(filter).connect(gain).connect(ac.destination);
    src.start();
    return () => { try { src.stop(); } catch { /* already stopped */ } src.disconnect(); };
  }, [sound, on]);
}

export default function Focus() {
  const ready = useHydrated();
  return ready ? <Timer /> : <main className="screen on-desk" aria-busy="true" />;
}

function Timer() {
  const router = useRouter();
  const q = useSearchParams();
  const { items } = useStore();
  const { all } = useMeta();
  const mark = useMarkDone();
  const id = q.get('id') ?? '';
  const item = items.find(i => i.id === id);
  const g = item ? merge(item, all[item.id]) : null;
  const total = (Number(q.get('min')) || g?.minutes || 25) * 60;

  const [saved, setSaved] = useLocal<Run | null>('mylo.goals.focus.v1', null);
  const [sound, setSound] = useLocal<Sound>('mylo.goals.sound.v1', 'Silence');
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // Pick up the same task's run where it was left; anything else starts over.
  const [cur, setCur] = useState<Run>(() => {
    const t = Date.now();
    const live = saved && saved.id === id && saved.total === total && saved.spent + (saved.startedAt ? (t - saved.startedAt) / 1000 : 0) < saved.total;
    return live ? saved : { id, total, startedAt: t, spent: 0 };
  });
  const closed = useRef(false);

  useEffect(() => { if (!closed.current) setSaved(cur); }, [cur, setSaved]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const spent = Math.min(cur.total, cur.spent + (cur.startedAt ? Math.max(0, now - cur.startedAt) / 1000 : 0));
  const left = Math.max(0, cur.total - spent);
  const running = cur.startedAt !== null && left > 0;
  useNoise(sound, running && !muted);

  const finish = () => {
    if (closed.current) return;
    closed.current = true; setSaved(null);
    if (g) { mark(g); router.push(`/goals/${g.id}`); } else router.push('/goals');
  };
  const finished = left <= 0;
  useEffect(() => { if (finished) finish(); }, [finished]); // eslint-disable-line react-hooks/exhaustive-deps

  const pause = () => setCur(running ? { ...cur, spent, startedAt: null } : { ...cur, startedAt: Date.now() });

  const R = 135.1; const C = 2 * Math.PI * R;
  return (
    <main className="screen on-desk g-focus g-no-tabs">
      <header className="g-focus-top">
        <button type="button" className="icon-btn" aria-label="Close" onClick={() => (canGoBack() ? goBack(router) : router.push('/goals'))}><Icon name="goals/chevron-down" size={19} /></button>
        <h1 className="g-h17">Focus</h1>
        <button type="button" className="icon-btn" aria-label={muted ? 'Sound on' : 'Sound off'} aria-pressed={!muted} onClick={() => setMuted(m => !m)}><Icon name="goals/music" size={19} /></button>
      </header>
      <p className="t-label g-focus-label">{['Focus', g?.tag?.label].filter(Boolean).join(' · ')}</p>
      <p className="g-h28 g-center">{g?.title ?? 'Focus'}</p>
      <div className="g-timer" role="timer" aria-label={`${mmss(left)} left`}>
        <svg viewBox="0 0 280 280" width="280" height="280" aria-hidden>
          <circle cx="140" cy="140" r={R} className="g-timer-track" />
          <circle cx="140" cy="140" r={R} className="g-timer-arc" strokeDasharray={C} strokeDashoffset={C * (1 - spent / cur.total)} transform="rotate(-90 140 140)" />
          {Array.from({ length: 60 }, (_, i) => {
            const long = i % 5 === 0; const a = (i * 6 - 90) * Math.PI / 180;
            const r1 = long ? 113 : 115; const r2 = long ? 123 : 120;
            return <line key={i} x1={140 + r1 * Math.cos(a)} y1={140 + r1 * Math.sin(a)} x2={140 + r2 * Math.cos(a)} y2={140 + r2 * Math.sin(a)} className="g-tick" />;
          })}
        </svg>
        <span className="g-timer-center"><span className="t-display">{mmss(left)}</span><span className="g-meta13">left of {Math.round(cur.total / 60)} min</span></span>
      </div>
      <div className="g-chips g-center-row" role="radiogroup" aria-label="Sound">
        {SOUNDS.map(s => (
          <button key={s} type="button" role="radio" aria-checked={sound === s} className="g-sound" onClick={() => { setSound(s); setMuted(false); }}>{s}</button>
        ))}
      </div>
      <div className="g-actions">
        <button type="button" className="g-pause" aria-label={running ? 'Pause' : 'Resume'} aria-pressed={!running} onClick={pause}>
          <Icon name={running ? 'goals/pause' : 'goals/arrow-right-bold'} size={running ? 25 : 22} />
        </button>
        <button type="button" className="btn-primary g-grow" onClick={finish}><Icon name="goals/check-bold-16" size={20} />Done early</button>
      </div>
    </main>
  );
}
