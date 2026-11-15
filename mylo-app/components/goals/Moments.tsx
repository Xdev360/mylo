'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '../Icon';
import VoiceSheet from './VoiceSheet';
import { thingsOn } from './DayItems';
import { useStore } from '@/lib/store';
import { useHydrated } from '@/lib/local';
import { addDays, fromIso, iso, todayIso, weekdayName } from '@/lib/dates';
import { dayThings, momentOver, useJournal, useMeta, useMoments, useStreak, type Moments as Seen, type Mood } from '@/lib/goals';
import { canGoBack, goBack, stampNav } from '../NavMotion';

/* The daily loop's full-screen moments: C1 start your day, C6 perfect day,
   C9 welcome back and C10 evening wrap. `DailyMoments` decides when each
   one opens; mount it on Today. */
const dayLine = (d: Date) => `${weekdayName(d)} · ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;
const daysBetween = (a: string, b: string) => Math.round((fromIso(b).getTime() - fromIso(a).getTime()) / 86400000);

/* Opens the right moment once a day: welcome back after three days or more
   away, start your day before noon, the evening wrap from 21:30 on a day
   that had something on it. A moment counts as seen the moment it opens, so
   closing it, going back or reloading never brings it straight back. */
export function DailyMoments() {
  const ready = useHydrated();
  const router = useRouter();
  const { items } = useStore();
  const { all } = useMeta();
  const [m, setM] = useMoments();
  useEffect(() => {
    if (!ready) return;
    const today = todayIso(); const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    const away = m.lastOpen ? daysBetween(m.lastOpen, today) : 0;
    let go: string | null = null; let seen: Seen = {};
    if (away >= 3 && m.back !== today) { go = `/plan/back?days=${away}`; seen = { back: today, morning: today }; }
    // The very first open is onboarding's, not ours; and only someone with
    // something in the app gets a morning: a visitor looking around keeps Today.
    else if (m.lastOpen && now.getHours() < 12 && m.morning !== today && items.length > 0) { go = '/plan/morning'; seen = { morning: today }; }
    else if (m.lastOpen && mins >= 21 * 60 + 30 && m.evening !== today && dayThings(items, all, today).length > 0) { go = '/plan/evening'; seen = { evening: today }; }
    if (m.lastOpen !== today || go) setM(x => ({ ...x, lastOpen: today, ...seen }));
    if (go) { momentOver(true); stampNav('push'); router.push(go); }
  }, [ready]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/* Leaving a moment: back to the screen it opened over, or to Today. */
function useLeave() {
  const router = useRouter();
  return () => {
    if (momentOver() && canGoBack()) { momentOver(false); goBack(router); return; }
    stampNav('pop'); router.replace('/today');
  };
}

/* ── C1 · Start your day ────────────────────────────────────────────────── */
export function Morning() {
  const ready = useHydrated();
  const { items } = useStore();
  const { all } = useMeta();
  const [, setM] = useMoments();
  const s = useStreak();
  const leave = useLeave();
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const now = new Date(); const today = todayIso();
  const things = thingsOn(items, all, today).filter(t => !t.done);
  const h = now.getHours();
  const start = () => { setM(x => ({ ...x, morning: today })); leave(); };
  return (
    <main className="screen on-desk g-moment g-c1 g-no-tabs">
      {s > 0 && <Link href="/streak" className="g-streak"><img src="/figma/flame.svg" alt="" width={16} height={16} />Day {s} · don’t break it</Link>}
      <div className="g-mylo-box">
        <span className="g-disc g-disc-177" />
        <img className="g-mylo" src="/figma/goals/mylo-white-smile.svg" alt="" width={95} height={120} />
      </div>
      <p className="t-label c-3">{dayLine(now)}</p>
      <h1 className="g-h40">{h < 12 ? 'Morning.' : h < 18 ? 'Afternoon.' : 'Evening.'}</h1>
      <p className="g-lede">{things.length ? `${things.length} ${things.length === 1 ? 'thing' : 'things'} today.` : 'Day one. Start with something small.'}</p>
      {things.length > 0 && (
        <div className="card g-agenda">
          {things.slice(0, 4).map(t => {
            const hh = t.time ? Number(t.time.slice(0, 2)) : 12;
            return (
              <div key={t.id} className="g-agenda-row">
                <Icon name={hh < 12 ? 'goals/sunrise' : hh < 18 ? 'goals/sun' : 'goals/moon'} size={20} className="c-3" />
                <span className="t-body g-ellipsis">{t.title}</span><span className="spacer" />
                {t.time && <span className="g-meta13 g-agenda-time">{t.time.replace(/^0/, '')}</span>}
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="btn-primary g-full" onClick={start}><Icon name="goals/arrow-right-bold" size={20} />Start my day</button>
      <Link href="/ai" className="g-ghost" onClick={() => momentOver(false)}><Icon name="sparkles" size={18} />Plan it with Mylo first</Link>
    </main>
  );
}

/* ── C6 · Perfect day ───────────────────────────────────────────────────── */
const CONFETTI = Array.from({ length: 40 }, (_, i) => ({
  x: (i * 97) % 390, y: 70 + ((i * 53) % 247), r: (i * 37) % 360, dot: i % 2 === 1,
  c: ['rgba(255,181,71,.85)', 'rgba(255,90,95,.85)', 'rgba(250,250,250,.85)', 'rgba(229,229,232,.85)'][i % 4]
}));
export function Confetti({ pieces = CONFETTI }: { pieces?: typeof CONFETTI }) {
  return (
    <div className="g-confetti" aria-hidden>
      {pieces.map((p, i) => <i key={i} className={p.dot ? 'is-dot' : ''} style={{ left: `${(p.x / 390) * 100}%`, top: p.y, rotate: `${p.r}deg`, background: p.c, animationDelay: `${(i % 8) * 0.06}s` }} />)}
    </div>
  );
}

export function Perfect() {
  const ready = useHydrated();
  const { items } = useStore();
  const { all } = useMeta();
  const s = useStreak();
  const leave = useLeave();
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const now = new Date();
  const things = thingsOn(items, all, todayIso());
  const done = things.filter(t => t.done).length;
  return (
    <main className="screen on-desk g-moment g-perfect g-c6 g-no-tabs">
      <Confetti />
      <header className="g-moment-nav is-right"><button type="button" className="back-btn" aria-label="Close" onClick={leave}><Icon name="close" size={20} /></button></header>
      <div className="g-mylo-box is-165">
        <span className="g-disc g-disc-165" />
        <img className="g-mylo" src="/figma/goals/mylo-laugh.svg" alt="" width={119} height={150} />
      </div>
      <p className="t-label c-ink">{done} of {things.length} · {weekdayName(now)}</p>
      <h1 className="g-h40">Perfect day.</h1>
      <p className="g-lede">You did everything.</p>
      <div className="g-tiles">
        <div className="g-tile"><span className="t-label c-3">Done</span><span className="g-tile-n">{done}</span><span className="g-meta11 c-2">Today</span></div>
        <Link href="/streak" className="g-tile"><span className="t-label c-3">Streak</span><span className="g-tile-n">{s}</span><span className="g-meta11 c-2">days</span></Link>
      </div>
      <Link href="/feed/new" className="btn-primary g-full"><Icon name="goals/camera" size={20} />Post proof to the room</Link>
      <Link href="/plan" className="g-ghost">Peek at tomorrow</Link>
    </main>
  );
}

/* ── C9 · Welcome back ──────────────────────────────────────────────────── */
const RESTARTS = ['10-minute walk', 'Read 5 pages', 'Drink water'];
export function Back({ days }: { days?: number }) {
  const { add } = useStore();
  const [, setM] = useMoments();
  const [pick, setPick] = useState(0);
  const leave = useLeave();
  const back = () => {
    add({ kind: 'task', title: RESTARTS[pick], date: todayIso() });
    setM(x => ({ ...x, back: todayIso(), morning: todayIso(), lastOpen: todayIso() }));
    leave();
  };
  return (
    <main className="screen on-desk g-moment g-c9 g-no-tabs">
      <header className="g-moment-nav"><button type="button" className="back-btn" aria-label="Back" onClick={leave}><Icon name="goals/back" size={20} /></button></header>
      <div className="g-mylo-box is-143">
        <span className="g-disc g-disc-143" />
        <img className="g-mylo" src="/figma/goals/mylo-sad.svg" alt="" width={103} height={130} />
      </div>
      {days && days > 1 ? <p className="t-label c-2">{days} days away</p> : null}
      <h1 className="g-h28 g-center">Missed you.<br />No guilt, just a restart.</h1>
      <p className="g-lede">Your level stays.</p>
      <div className="card g-pick" role="radiogroup" aria-label="Start with one thing">
        <p className="t-label c-3">Start with one thing</p>
        {RESTARTS.map((r, i) => (
          <button key={r} type="button" role="radio" aria-checked={pick === i} className="g-pick-row" onClick={() => setPick(i)}>
            <span className={`g-check${pick === i ? ' is-done' : ''}`} style={{ '--c': '28px' } as React.CSSProperties}>{pick === i && <Icon name="goals/check-bold-16" size={16} />}</span>
            <span className="t-body">{r}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary g-full" onClick={back}>I’m back</button>
    </main>
  );
}

/* ── C10 · Evening wrap ─────────────────────────────────────────────────── */
const WRAP_MOODS: { id: Mood; label: string; art: string }[] = [
  { id: 'rough', label: 'Rough', art: 'mylo-sad' }, { id: 'okay', label: 'Okay', art: 'mylo-plain' },
  { id: 'good', label: 'Good', art: 'mylo-smile' }, { id: 'great', label: 'Great', art: 'mylo-laugh' }
];
export function Evening() {
  const ready = useHydrated();
  return ready ? <Wrap /> : <main className="screen on-desk" aria-busy="true" />;
}
function Wrap() {
  const router = useRouter();
  const { items, add } = useStore();
  const { all, patch } = useMeta();
  const [journal, setJournal] = useJournal();
  const [, setM] = useMoments();
  const today = todayIso();
  const [mood, setMood] = useState<Mood | undefined>(() => journal[today]?.mood);
  const [line, setLine] = useState(() => journal[today]?.line ?? '');
  const [voice, setVoice] = useState(false);
  const [moved, setMoved] = useState(false);
  const leave = useLeave();

  const things = thingsOn(items, all, today);
  const wins = things.filter(t => t.done);
  const left = things.find(t => !t.done && !t.repeat);
  const leftItem = left && items.find(i => i.id === left.id);
  const move = () => {
    if (!leftItem) return;
    const tomorrow = iso(addDays(new Date(), 1));
    add({ kind: leftItem.kind, title: leftItem.title, date: tomorrow, time: leftItem.time, minutes: leftItem.minutes, with: leftItem.with, tag: leftItem.tag });
    patch(leftItem.id, { hidden: true });
    setMoved(true);
  };
  const save = () => {
    setJournal(j => ({ ...j, [today]: { ...j[today], tags: j[today]?.tags ?? [], mood: mood ?? j[today]?.mood, line: line.trim(), at: new Date().toISOString() } }));
    setM(x => ({ ...x, evening: today }));
    // The wrap gives way to tomorrow's plan; back from there lands on Today.
    momentOver(false); stampNav('push'); router.replace('/plan');
  };

  return (
    <main className="screen on-desk g-wrap-screen g-no-tabs">
      <header className="g-wrap-head">
        <span className="t-label c-3">Evening wrap</span>
        <button type="button" className="icon-btn" aria-label="Close" onClick={leave}><Icon name="close" size={19} /></button>
      </header>
      <h1 className="g-h28">Good work today. How did it feel?</h1>
      <div className="g-moods4" role="radiogroup" aria-label="How did it feel?">
        {WRAP_MOODS.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={mood === x.id} className="g-mood4" onClick={() => setMood(x.id)}>
            <img className="g-mylo" src={`/figma/goals/${x.art}.svg`} alt="" width={36} height={46} />
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      {things.length > 0 && (
        <div className="card g-wins">
          <p className="t-label c-3">Today’s wins · {wins.length} of {things.length}</p>
          {wins.slice(0, 5).map(w => <p key={w.id} className="g-win"><Icon name="goals/check-18" size={18} />{w.title}</p>)}
          {left && !moved && (
            <button type="button" className="g-win g-win-move" onClick={move}>
              <Icon name="goals/arrow-right" size={18} />{left.title}. Move to tomorrow?
            </button>
          )}
        </div>
      )}
      <div className="card g-jline">
        <label className="t-label c-3" htmlFor="g-jline">One line for your journal</label>
        <textarea id="g-jline" className="t-body g-note-input" rows={2} value={line} onChange={e => setLine(e.target.value)} />
        <button type="button" className="g-tell" onClick={() => setVoice(true)}><Icon name="goals/mic-18" size={18} />Or just tell Mylo</button>
      </div>
      <button type="button" className="btn-primary g-full" onClick={save}>Save &amp; plan tomorrow</button>
      <VoiceSheet open={voice} onClose={() => setVoice(false)} onDone={t => setLine(l => (l ? `${l} ${t}` : t))} onType={() => document.getElementById('g-jline')?.focus()} />
    </main>
  );
}
