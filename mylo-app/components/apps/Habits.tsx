'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated } from '@/lib/local';
import { streak, useStore } from '@/lib/store';
import { iso, thisWeek, todayIso } from '@/lib/dates';
import { ANCHORS, IDENTITIES, uid, useHard, useIdentities, useOwnIdentities, useStacks, type Identity } from '@/lib/apps';
import { CloseBtn, Head, Toggle } from './ui';

const TONE_BG: Record<Identity['tone'], string> = { green: 'var(--tint-green)', blue: 'var(--tint-blue)', amber: 'var(--tint-amber)', red: 'var(--tint-red)', grey: 'var(--surface-2)' };

/* LX7 · Who you are becoming (884:117791). Pick up to two; a third choice
   lets go of the oldest. */
export function Becoming() {
  const router = useRouter();
  const ready = useHydrated();
  const [picked, setPicked] = useIdentities();
  const [own, setOwn] = useOwnIdentities();
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const all = [...IDENTITIES, ...own];
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id].slice(-2)));
  const addOwn = () => {
    const label = text.trim(); if (!label) return;
    const id = `own-${uid()}`;
    setOwn(o => [...o, { id, label, icon: 'i-sparkle', tone: 'amber' }]);
    setPicked(p => [...p, id].slice(-2));
    setText(''); setWriting(false);
  };
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow ax-becoming">
      <Head fallback="/apps" />
      <div className="ax-flow-top">
        <p className="ax-step">Step 3 of 6</p>
        <h1 className="ax-h1">Who are you becoming?</h1>
      </div>
      <p className="t-body c-2 ax-lead">Every task you tick is a vote for this person. Pick up to 2.</p>
      <div className="ax-ids">
        {all.map(i => {
          const on = picked.includes(i.id);
          return (
            <button key={i.id} type="button" className={`ax-id${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(i.id)}
                    style={on ? { background: TONE_BG[i.tone] } : undefined}>
              <span className="ax-id-icon"><Icon name={`apps/${i.icon}`} size={24} /></span>
              <span className="ax-id-label">{i.label}</span>
              {on && <Icon name="apps/i-picked" size={24} />}
            </button>
          );
        })}
      </div>
      {writing ? (
        <form className="ax-own" onSubmit={e => { e.preventDefault(); addOwn(); }}>
          <input autoFocus className="ax-input" value={text} onChange={e => setText(e.target.value)} placeholder="Or write your own" aria-label="Write your own" maxLength={60} />
          <button type="submit" className="ax-pill-btn" disabled={!text.trim()}>Add</button>
        </form>
      ) : (
        <button type="button" className="ax-link-btn" onClick={() => setWriting(true)}>Or write your own</button>
      )}
      <span className="spacer" />
      <button type="button" className="ax-btn ax-cta" disabled={!picked.length} onClick={() => router.push('/apps/stack')}>Continue</button>
    </main>
  );
}

/* LX8 · Stack it on a habit (884:117865). Saving adds the habit to the day
   as a system and keeps the "after I" with it for the nudge. */
export function StackIt() {
  const router = useRouter();
  const ready = useHydrated();
  const { add } = useStore();
  const [, setStacks] = useStacks();
  const [identities] = useIdentities();
  const [anchor, setAnchor] = useState('');
  const [habit, setHabit] = useState('');
  const [smallOn, setSmallOn] = useState(true);
  const [small, setSmall] = useState('');
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const chip = ANCHORS.find(a => a.toLowerCase() === anchor.trim().toLowerCase());
  const save = () => {
    if (!anchor.trim() || !habit.trim()) return;
    const itemId = uid();
    add({ kind: 'system', title: habit.trim(), date: todayIso() });
    setStacks(s => [...s, { id: itemId, anchor: anchor.trim(), habit: habit.trim(), small: small.trim() || undefined, smallOn, identity: identities[0], at: new Date().toISOString() }]);
    router.push('/today');
  };
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow ax-stackit">
      <Head title="When will you do it?" fallback="/apps" />
      <div className="ax-stack">
        <label className="ax-stack-k" htmlFor="ax-after">After I</label>
        <input id="ax-after" className="ax-stack-v" value={anchor} onChange={e => setAnchor(e.target.value)} placeholder="make my morning coffee" maxLength={60} />
        <label className="ax-stack-k" htmlFor="ax-will">I will</label>
        <input id="ax-will" className="ax-stack-v" value={habit} onChange={e => setHabit(e.target.value)} placeholder="read 2 pages" maxLength={60} />
      </div>
      <section className="ax-block">
        <h2 className="ax-14 ax-600">Pick something you already do</h2>
        <div className="ax-chips">
          {ANCHORS.map(a => (
            <button key={a} type="button" className={`ax-chip${chip === a ? ' is-on' : ''}`} aria-pressed={chip === a} onClick={() => setAnchor(a.toLowerCase())}>{a}</button>
          ))}
        </div>
      </section>
      <div className="ax-two">
        <Icon name="apps/i-timer" size={24} />
        <div className="ax-two-text">
          <p className="t-body ax-600">Two minute version</p>
          {smallOn
            ? <label className="t-body-s c-2 ax-two-line">On a bad day, <input className="ax-inline" value={small} onChange={e => setSmall(e.target.value)} placeholder="1 page" aria-label="The two minute version" maxLength={40} size={Math.max(6, small.length + 1)} /> still counts.</label>
            : null}
        </div>
        <Toggle on={smallOn} onChange={setSmallOn} label="Two minute version" />
      </div>
      <p className="ax-note">Mylo will nudge you right after you {anchor.trim() || 'do it'}, not at a random time.</p>
      <span className="spacer" />
      <button type="button" className="ax-btn ax-cta" disabled={!anchor.trim() || !habit.trim()} onClick={save}>Save</button>
    </main>
  );
}

/* LX9 · Never miss twice (884:117914). Offers the two minute versions set
   on LX8 as today's tasks. */
export function NeverMiss() {
  const router = useRouter();
  const ready = useHydrated();
  const { add } = useStore();
  const [stacks] = useStacks();
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const easy = stacks.filter(s => s.smallOn && s.small);
  const useEasy = () => {
    if (!easy.length) { router.push('/apps/stack'); return; }
    easy.forEach(s => add({ kind: 'task', title: s.small!, date: todayIso() }));
    router.push('/today');
  };
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow ax-miss">
      <div className="ax-miss-close"><CloseBtn href="/today" /></div>
      <span className="ax-miss-hero"><img src="/figma/apps/mylo-slipped.svg" alt="" width={100} height={120} /></span>
      <h1 className="ax-moment-title is-24">Yesterday slipped. That is fine.</h1>
      <p className="ax-moment-body">One miss is life. Two in a row starts a new habit. Today is the one that counts.</p>
      {easy.length > 0 && (
        <div className="ax-easy">
          <p className="t-body ax-600">Make it easy today</p>
          {easy.map(s => (
            <p key={s.id} className="ax-easy-row">
              <span className="ax-easy-from">{s.habit}</span>
              <Icon name="apps/i-arrow" size={20} className="c-2" />
              <span className="ax-easy-to">{s.small}</span>
            </p>
          ))}
        </div>
      )}
      <span className="spacer" />
      <div className="ax-moment-btns">
        <button type="button" className="ax-btn" onClick={useEasy}>Use the easy versions</button>
        <Link href="/today" className="ax-btn ax-btn-soft">Keep my plan</Link>
      </div>
    </main>
  );
}

/* LX10 · Sunday review (884:117964). Votes are this week's ticks: every
   one is a vote for who you are becoming. The XP total, Mylo's tip and the
   chest come from the server and stay off until it sends them. */
const HARD = ['Late nights', 'Too many tasks', 'Busy work week', 'Nothing, I flew'];
export function Review() {
  const ready = useHydrated();
  const { items } = useStore();
  const [picked] = useIdentities();
  const [own] = useOwnIdentities();
  const [stacks] = useStacks();
  const [hard, setHard] = useHard();
  const week = useMemo(() => thisWeek().map(iso), []);
  const weekKey = week[0];
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const done = items.filter(i => i.done && i.doneAt && week.includes(iso(new Date(i.doneAt))));
  const ids = [...IDENTITIES, ...own].filter(i => picked.includes(i.id));
  const votes = ids.map(i => {
    const mine = stacks.filter(s => s.identity === i.id).flatMap(s => [s.habit, s.small].filter(Boolean).map(t => t!.toLowerCase()));
    const n = mine.length ? done.filter(d => mine.includes(d.title.toLowerCase())).length : done.length;
    return { ...i, n };
  });
  const most = Math.max(1, ...votes.map(v => v.n));
  const mineHard = hard[weekKey] ?? [];
  const flip = (h: string) => setHard(all => ({ ...all, [weekKey]: mineHard.includes(h) ? mineHard.filter(x => x !== h) : [...mineHard, h] }));
  const tones = ['var(--blue)', 'var(--green)'];
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow ax-review">
      <div className="ax-flow-top">
        <p className="ax-step">Sunday review</p>
        <h1 className="ax-h1">Your week, in votes</h1>
        <p className="t-body c-2">Each tick is a vote for who you are becoming.</p>
      </div>
      {votes.length > 0 ? (
        <div className="ax-votes">
          {votes.map((v, k) => (
            <div key={v.id} className="ax-vote">
              <p className="ax-vote-row"><span className="t-body ax-600">{v.label}</span><span className="ax-14 c-2">{v.n} {v.n === 1 ? 'vote' : 'votes'}</span></p>
              <span className="ax-track"><span style={{ width: `${(v.n / most) * 100}%`, background: tones[k % 2] }} /></span>
            </div>
          ))}
        </div>
      ) : (
        <Link href="/apps/becoming" className="ax-votes ax-votes-empty">
          <span className="t-body ax-600">Who are you becoming?</span>
          <Icon name="chevron-right" size={20} className="c-3" />
        </Link>
      )}
      <div className="ax-stats">
        <div className="ax-stat"><img src="/figma/apps/i-streak.svg" alt="" width={24} height={24} /><span className="t-body ax-600">{streak(items)} {streak(items) === 1 ? 'day' : 'days'}</span></div>
        <div className="ax-stat"><Icon name="apps/i-done" size={24} /><span className="t-body ax-600">{done.length} {done.length === 1 ? 'task' : 'tasks'}</span></div>
      </div>
      <section className="ax-block">
        <h2 className="t-body ax-600">What made it hard?</h2>
        <div className="ax-chips ax-hard">
          {HARD.map(h => <button key={h} type="button" className={`ax-chip${mineHard.includes(h) ? ' is-on' : ''}`} aria-pressed={mineHard.includes(h)} onClick={() => flip(h)}>{h}</button>)}
        </div>
      </section>
      <span className="spacer" />
      <Link href="/chest" className="ax-btn ax-cta"><Icon name="apps/i-gift" size={22} />Open my chest</Link>
    </main>
  );
}
