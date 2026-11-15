'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { AchBadge, DAY_LETTERS } from './bits';
import BadgeWatcher from './BadgeWatcher';
import { iso, thisWeek, todayIso } from '@/lib/dates';
import { useRewards } from '@/lib/rewards';
import { useStore } from '@/lib/store';

/* L8 · Streak (877:110450): the run of days in a row with something ticked,
   this week, the month and the streak badges. All from the person's ticks:
   streak() in lib/store, the best run, and how much of each day got done. */

const STREAK_BADGES = ['streak_3', 'streak_7', 'streak_14', 'streak_21', 'streak_30'];

export default function StreakView() {
  const r = useRewards();
  const { items } = useStore();
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const now = new Date();
  const today = todayIso();
  const { current, best, days } = r;

  /* How much of each day got done, for the month's shades. */
  const share = (day: string) => {
    const on = items.filter(i => (i.kind === 'task' || i.kind === 'todo') && i.date === day);
    const ticked = items.filter(i => i.done && i.doneAt && iso(new Date(i.doneAt)) === day).length;
    if (!ticked) return 0;
    return on.length ? Math.min(1, on.filter(i => i.done).length / on.length) : 1;
  };
  const y = now.getFullYear(); const m = now.getMonth();
  const inMonth = new Date(y, m + 1, 0).getDate();
  const month = Array.from({ length: inMonth }, (_, i) => iso(new Date(y, m, i + 1)));
  const elapsed = now.getDate();
  const activeInMonth = month.filter(d => d <= today && days.has(d)).length;

  return (
    <main className="screen rw rw-g16 on-desk">
      <BadgeWatcher badges={r.badges} seen={r.state.seenBadges} onSeen={r.seeBadges} onPin={r.pin} />
      <ScreenHeader title="Streak" fallback="/today" />
      <section className="rw-streak">
        <Icon name="rewards/i-streak" size={56} className="rw-streak-flame" />
        <p className="t-display rw-streak-n">{current}</p>
        <p className="t-body-s c-2">day streak · best {best}</p>
        <div className="rw-streak-week">
          {thisWeek(now).map((d, i) => {
            const day = iso(d);
            const done = days.has(day);
            const isToday = day === today;
            return (
              <span key={day} className="rw-streak-day">
                <span className={`rw-streak-dot${done ? ' is-done' : isToday ? ' is-today' : ''}`}>
                  {done ? <Icon name="rewards/i-check" size={16} /> : isToday ? <Icon name="rewards/i-streak" size={16} /> : null}
                </span>
                <span className="t-caption c-2">{DAY_LETTERS[i]}</span>
              </span>
            );
          })}
        </div>
      </section>

      <div className="section-head">
        <h2 className="t-title-s">{now.toLocaleDateString('en-GB', { month: 'long' })}</h2>
        <span className="t-body-s c-2">{activeInMonth} of {elapsed} days</span>
      </div>
      <section className="card rw-month" aria-label="This month">
        {month.map((day, i) => {
          const future = day > today;
          const s = future ? -1 : share(day);
          const cls = future ? 'is-future' : s >= 1 ? 'is-full' : s >= 0.5 ? 'is-most' : s > 0 ? 'is-some' : 'is-miss';
          return <span key={day} className={`rw-month-day ${cls}`} aria-label={day}>{i + 1}</span>;
        })}
      </section>

      <Link href="/apps" className="rw-freeze">
        <Icon name="rewards/i-shield" size={24} className="rw-freeze-icon" />
        <span><span className="t-body">0 streak freezes</span><span className="t-caption c-2 rw-block">Saves your streak on a missed day</span></span>
      </Link>

      <Link href="/badges" className="t-title-s rw-block">Streak badges</Link>
      <div className="rw-sbadges">
        {STREAK_BADGES.map(id => {
          const b = r.badges.find(x => x.id === id)!;
          return (
            <Link key={id} href="/badges" className="rw-sbadge">
              <AchBadge id={id} earned={b.earned} size={58} glow={b.glow} />
              <span className={`t-caption${b.earned ? '' : ' c-3'}`}>{b.days} days</span>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
