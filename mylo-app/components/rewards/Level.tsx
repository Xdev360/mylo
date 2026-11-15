'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { CloseBtn, LevelBadge } from './bits';
import { LEVELS, OPENS, levelOf, num, useRewards, useXp } from '@/lib/rewards';

/* L1 · Your level (877:120666), L7 · All levels (877:120781) and L2 · Level
   up (877:120751). XP is the server's; until it exists everyone is Spark,
   Level 1 of 8, with 0 XP. */

const EARN = [
  { icon: 'rewards/i-done', tone: 'green', label: 'Tick a task', xp: '+20' },
  { icon: 'rewards/i-repeat', tone: 'blue', label: 'Finish a system', xp: '+25' },
  { icon: 'rewards/i-heart', tone: 'red', label: 'Cheer someone', xp: '+5' },
  { icon: 'rewards/i-streak', tone: 'amber', label: 'Keep your streak', xp: '+10 / day' }
];

export function XpPill({ xp }: { xp: number }) {
  return <Link href="/xp" className="rw-xp-pill"><Icon name="rewards/i-bolt" size={18} className="c-amber" /><span>{num(xp)} XP</span></Link>;
}

export default function YourLevel() {
  const xp = useXp();
  const r = useRewards();
  const track = useRef<HTMLDivElement>(null);
  const { index, number, level, next, pct } = levelOf(xp);
  useEffect(() => {
    const el = track.current?.querySelector<HTMLElement>('[aria-current="step"]');
    if (el && track.current) track.current.scrollLeft = el.offsetLeft - 20;
  }, [r.ready]);
  return (
    <main className="screen rw on-desk">
      <LevelUp />
      <ScreenHeader title="Your level" fallback="/rewards" actions={<XpPill xp={xp} />} />
      <section className="rw-level-hero">
        <LevelBadge id={level.id} size={200} glow={level.glow} />
        <h2 className="rw-level-name">{level.name}</h2>
        <p className="t-body-s c-2">Level {number} of {LEVELS.length}</p>
      </section>
      {next && (
        <section className="card rw-panel">
          <div className="rw-panel-row"><h3 className="t-title-s">{num(next.xp - xp)} XP to {next.name}</h3><span className="t-body-s c-2">{num(xp)} / {num(next.xp)}</span></div>
          <span className="rw-track"><span style={{ width: `${pct * 100}%` }} /></span>
          {OPENS[next.id] && <p className="rw-panel-note"><Icon name="rewards/i-gift" size={18} />{OPENS[next.id]}</p>}
        </section>
      )}
      <div className="section-head"><h2 className="t-title-s">All levels</h2><Link href="/levels" className="t-body-s c-2">See all</Link></div>
      <div className="rw-ltrack" ref={track}>
        {LEVELS.map((l, i) => {
          const earned = i <= index;
          const cur = i === index;
          return (
            <Link key={l.id} href="/levels" className={`rw-ltrack-item${cur ? ' is-cur' : ''}`} aria-current={cur ? 'step' : undefined}>
              <span className="rw-ltrack-art">
                <LevelBadge id={l.id} earned={earned} size={cur ? 80 : 67} glow={l.glow} />
              </span>
              <span className={`rw-ltrack-name${earned ? '' : ' c-3'}`}>{l.name}</span>
              <span className="rw-ltrack-xp">{num(l.xp)} XP</span>
              {cur && <span className="rw-ltrack-mark" />}
            </Link>
          );
        })}
      </div>
      <h2 className="t-title-s">Earn XP</h2>
      <div className="card list rw-rows">
        {EARN.map(e => (
          <div key={e.label} className="rw-row">
            <span className={`rw-row-icon is-${e.tone}`}><Icon name={e.icon} size={20} /></span>
            <span className="t-body rw-row-text">{e.label}</span>
            <span className={`t-body-s rw-row-xp is-${e.tone}`}>{e.xp}</span>
          </div>
        ))}
      </div>
    </main>
  );
}

export function AllLevels() {
  const xp = useXp();
  const { index, pct } = levelOf(xp);
  return (
    <main className="screen rw rw-g16 on-desk">
      <ScreenHeader title="Levels" fallback="/level" />
      <div className="rw-levels">
        {LEVELS.map((l, i) => {
          const done = i < index; const cur = i === index; const locked = i > index;
          return (
            <div key={l.id} className={`card rw-lv${cur ? ' is-cur' : ''}`} aria-current={cur ? 'step' : undefined}>
              <LevelBadge id={l.id} earned={!locked} size={67} glow={l.glow} />
              <div className="rw-lv-text">
                <p className="rw-lv-top"><span className={`t-title-s${locked ? ' c-2' : ''}`}>{l.name}</span><span className="t-caption c-3">{num(l.xp)} XP</span></p>
                <p className="t-caption c-2">{l.perk}</p>
                {cur && LEVELS[i + 1] && <span className="rw-track is-thin"><span style={{ width: `${pct * 100}%` }} /></span>}
              </div>
              {done && <span className="rw-lv-done"><Icon name="rewards/i-done" size={22} /></span>}
              {cur && LEVELS[i + 1] && <span className="t-body-s">{Math.round(pct * 100)}%</span>}
              {locked && <Icon name="rewards/i-lock" size={18} className="c-3" />}
            </div>
          );
        })}
      </div>
    </main>
  );
}

/* L2 · Level up: shown once when the server's XP passes a new level. */
const PERK_LINE: Record<string, string> = { flame: 'Quick to-dos now hold 20. Mylo got a party hat.' };
export function LevelUp() {
  const r = useRewards();
  const { number, level, next } = r.level;
  if (!r.ready || number <= r.state.lastLevel) return null;
  const close = () => r.seeLevel(number);
  return (
    <div className="rw-levelup" role="dialog" aria-modal="true" aria-labelledby="rw-lu-title">
      <div className="rw-levelup-col">
        <header className="rw-top"><CloseBtn onClick={close} /><h1 className="rw-top-title">Level up</h1><span className="rw-top-gap" /></header>
        <div className="rw-levelup-art"><span className="rw-rays" /><LevelBadge id={level.id} size={240} glow={level.glow} /></div>
        <h2 id="rw-lu-title" className="rw-level-name">You hit {level.name}</h2>
        <p className="t-body c-2">Level {number} · {num(level.xp)} XP</p>
        {next && (
          <div className="rw-lu-track">
            <span className="rw-track is-thin is-violet"><span style={{ width: '8%' }} /></span>
            <span className="rw-lu-from">{num(level.xp)}<Icon name="rewards/i-bolt" size={16} /></span>
            <span className="rw-lu-to">{num(next.xp)}<Icon name="rewards/i-bolt" size={16} /></span>
          </div>
        )}
        <button type="button" className="btn-primary rw-wide" onClick={close}>Keep going<Icon name="rewards/i-arrow" size={20} /></button>
        {PERK_LINE[level.id] && (
          <div className="card rw-lu-perk">
            <img src="/figma/rewards/mylo-party.svg" alt="" width={54} height={65} />
            <p className="t-body-s c-2">{PERK_LINE[level.id]}</p>
          </div>
        )}
        <Link href="/rewards/download?kind=level" className="rw-link" onClick={close}>Download</Link>
      </div>
    </div>
  );
}
