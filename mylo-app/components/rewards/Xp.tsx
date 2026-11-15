'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { DAY_LETTERS, LevelBadge } from './bits';
import { levelOf, num, useXp } from '@/lib/rewards';

/* L9 · XP (877:120858): the total, the level it buys, this week by day and
   the recent gains. All of it is the server's; with no XP server yet the
   total is 0, the week is flat and there is nothing recent to list. */

type Gain = { id: string; label: string; when: string; xp: number; icon: string; tone: string };

export default function XpView({ week = [0, 0, 0, 0, 0, 0, 0], recent = [] }: { week?: number[]; recent?: Gain[] }) {
  const xp = useXp();
  const { level, next } = levelOf(xp);
  const max = Math.max(1, ...week);
  const today = (new Date().getDay() + 6) % 7;
  const total = week.reduce((a, b) => a + b, 0);
  return (
    <main className="screen rw rw-g16 on-desk">
      <ScreenHeader title="XP" fallback="/level" />
      <section className="rw-xp-hero">
        <p className="rw-xp-total"><Icon name="rewards/i-bolt" size={40} className="c-amber" /><span>{num(xp)}</span></p>
        <p className="t-body-s c-2">Total XP</p>
        <Link href="/level" className="rw-xp-level">
          <LevelBadge id={level.id} size={26} />
          <span className="t-caption">{level.name}{next ? ` · ${num(next.xp - xp)} to ${next.name}` : ''}</span>
        </Link>
      </section>
      <section className="card rw-panel">
        <div className="rw-panel-row"><h2 className="t-title-s">This week</h2><span className="t-body-s rw-green">+{num(total)} XP</span></div>
        <div className="rw-bars">
          {week.map((v, i) => (
            <span key={i} className="rw-bar">
              <span className="rw-bar-track"><span className={`rw-bar-fill${i === today ? ' is-today' : ''}`} style={{ height: `${(v / max) * 100}%` }} /></span>
              <span className={`t-caption${i === today ? '' : ' c-3'}`}>{DAY_LETTERS[i]}</span>
            </span>
          ))}
        </div>
      </section>
      {recent.length > 0 && <>
        <h2 className="t-title-s">Recent</h2>
        <div className="card list rw-rows">
          {recent.map(g => (
            <div key={g.id} className="rw-row">
              <span className={`rw-row-icon is-${g.tone}`}><Icon name={g.icon} size={20} /></span>
              <span className="rw-row-text"><span className="t-body rw-block">{g.label}</span><span className="t-caption c-2">{g.when}</span></span>
              <span className="t-body-s rw-green">+{g.xp}</span>
            </div>
          ))}
        </div>
      </>}
    </main>
  );
}
