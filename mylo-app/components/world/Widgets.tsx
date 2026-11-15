'use client';

import Link from 'next/link';
import Mylo from './Mylo';
import { NavButton, Scene, WorldPage, useBack, useNow } from './ui';
import { onDay, useStore } from '@/lib/store';
import { useStreak } from '@/lib/goals';
import { todayIso } from '@/lib/dates';
import { roomArt, useHouse, useLook } from '@/lib/world';

/* WG1 Home screen widgets (879:192500) and WG2 Lock screen (879:192659):
   what Mylo's widgets show, filled from the person's own day. */
function useDay() {
  const { items, toggle } = useStore();
  const streakNow = useStreak();
  const mine = onDay(items, todayIso());
  const open = mine.filter(i => !i.done);
  return { mine, open, done: mine.length - open.length, streak: streakNow, toggle };
}

export function HomeWidgets() {
  return <WorldPage className="w-widgets"><HomeBody /></WorldPage>;
}
function HomeBody() {
  const back = useBack('/apps');
  const [look] = useLook();
  const [house] = useHouse();
  const { mine, open, done, streak: s, toggle } = useDay();
  return (
    <>
      <span className="w-blobs" aria-hidden />
      <NavButton onClick={back} className="w-float-nav" />
      <div className="w-wg-row">
        <Link href="/today" className="w-wg w-wg-count">
          <span className="w-wg-n">{open.length}</span>
          <span className="t-caption c-2">left today</span>
          <span className="spacer" />
          <span className="t-caption w-pink">Streak {s}</span>
          <Mylo look={look} className="w-wg-mylo" />
        </Link>
        <Link href="/today" className="w-wg w-wg-ring">
          <span className="t-caption c-2">{done} of {mine.length} done</span>
          <span className="w-wg-big">{mine.length ? Math.round((done / mine.length) * 100) : 0}%</span>
          <span className="w-bar is-red"><span style={{ width: `${mine.length ? (done / mine.length) * 100 : 0}%` }} /></span>
        </Link>
      </div>
      <div className="w-wg w-wg-list">
        <span className="t-title-s">{open.length} tasks left</span>
        {open.slice(0, 3).map(i => (
          <button key={i.id} type="button" className="w-wg-task" onClick={() => toggle(i.id)}><span className="w-wg-check" />{i.title}</button>
        ))}
        <Mylo look={look} className="w-wg-list-mylo" />
      </div>
      <Link href="/house/bedroom" className="w-wg w-wg-room">
        <Scene art={roomArt(house, 'bedroom')} look={look} at={[0.17, 0.42, 0.37]} className="w-wg-scene" />
        <span className="w-wg-room-label t-body-s c-ink">Sleep streak</span>
      </Link>
    </>
  );
}

export function LockScreen() {
  return <WorldPage className="w-lock is-widgets"><LockBody /></WorldPage>;
}
function LockBody() {
  const back = useBack('/widgets');
  const now = useNow();
  const { mine, open, done } = useDay();
  const part = mine.length ? done / mine.length : 0;
  const r = 24, c = 2 * Math.PI * r;
  return (
    <>
      <span className="w-stars" aria-hidden />
      <NavButton onClick={back} className="w-float-nav is-light" />
      <p className="w-lock-date">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <p className="w-lock-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <div className="w-lock-row">
        <span className="w-lock-ring" role="img" aria-label={`${open.length} left today`}>
          <svg viewBox="0 0 60 60" aria-hidden><circle cx="30" cy="30" r={r} className="w-lr-track" /><circle cx="30" cy="30" r={r} className="w-lr-fill" strokeDasharray={`${c * part} ${c}`} transform="rotate(-90 30 30)" /></svg>
          <span>{open.length}</span>
        </span>
        <span className="w-lock-pill"><span className="w-lock-pill-t">{open.length} left today</span><span className="w-lock-pill-s">{done} of {mine.length} done</span></span>
      </div>
    </>
  );
}
