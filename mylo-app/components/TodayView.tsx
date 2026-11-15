'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import Icon from './Icon';
import QuickTodo from './QuickTodo';
import { DailyMoments } from './goals/Moments';
import { Roll, TICK_XP, XpPill, useBurst } from './goals/Tick';
import { useToggleThing } from './goals/DayItems';
import { Me } from './Sidebar';
import { useSession } from '@/lib/session';
import { MyloNoticed } from './ai/Noticed';
import { useStore } from '@/lib/store';
import { dayThings, useMeta, useStreak, type DayThing } from '@/lib/goals';
import { clock, dayLetter, greeting, iso, thisWeek, todayIso } from '@/lib/dates';

/* "Thursday, 22 October", with the comma C2 and DT2 write. */
const longDate = (d: Date) => `${d.toLocaleDateString('en-GB', { weekday: 'long' })}, ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;

/* Today. On a phone: C2 (877:108572) once there is something on the day, and
   O17 (877:108446) before that. On a wide screen: DT2 (943:27301), with the
   same empty state in its list column. Everything shown is the person's own:
   no room yet means no room progress, and levels wait for the server. */
const TONE = { blue: ['var(--tint-blue)', 'var(--blue)'], green: ['var(--tint-green)', 'var(--green)'], amber: ['var(--tint-amber)', 'var(--amber)'], red: ['var(--tint-red)', 'var(--red)'] } as const;
const STARTERS = ['10 min walk', 'Read 5 pages', 'Drink water'];

/* The day, counted once for both layouts: everything on it (tasks, to-dos,
   one-off goals dated today and today's systems, lib/goals dayThings), what
   is left, the next thing still ahead, and the week's dots. */
function useDay() {
  const { items, ready } = useStore();
  const { all } = useMeta();
  const streak = useStreak();
  return useMemo(() => {
    const now = new Date();
    const today = todayIso();
    const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const mine = dayThings(items, all, today);
    const left = mine.filter(i => !i.done).length;
    // "Next" is the next thing still ahead today; times already gone don't count.
    const next = mine.find(i => !i.done && i.time && i.time >= hm);
    const week = thisWeek(now).map(d => {
      const day = dayThings(items, all, iso(d));
      // Today always carries its dot, as O17 draws it on an empty day.
      const dot = iso(d) === today ? 'today' : !day.length ? 'empty' : day.every(i => i.done) ? 'done' : 'part';
      return { date: d, today: iso(d) === today, future: iso(d) > today, dot };
    });
    return { ready, now, mine, left, done: mine.length - left, next, week, streak };
  }, [items, all, ready, streak]);
}

/* Rows that arrive after the screen opened slide in; the ones there from
   the start just sit. */
function useFresh(ids: string[]) {
  const [seen] = useState(() => new Set(ids));
  return (id: string) => !seen.has(id);
}

function EmptyDay({ big = false }: { big?: boolean }) {
  const { openCapture, add } = useStore();
  return (
    <section className={`empty-day${big ? ' is-big' : ''}`} aria-label="Nothing on today yet">
      <span className="empty-disc" />
      <img className="empty-mylo" src="/figma/mylo-empty.svg" alt="" width={96} height={115} />
      <p className="t-label c-3">Nothing on today yet</p>
      <h2 className="t-title-m">Give today one thing.</h2>
      <p className="t-body-s c-2">Start tiny. One task you can finish today.</p>
      <button type="button" className="btn-primary empty-btn" onClick={openCapture}>
        <Icon name="plus-20" size={20} />Add your first task
      </button>
      <div className="empty-chips">
        {STARTERS.map(s => (
          <button key={s} type="button" className="chip chip-plain" onClick={() => add({ kind: 'task', title: s, date: todayIso() })}>{s}</button>
        ))}
      </div>
    </section>
  );
}

function TaskRow({ item, onTick, burst }: { item: DayThing; onTick: () => void; burst: boolean }) {
  const tone = item.tag ? TONE[item.tag.tone] : null;
  const when = [item.time ? clock(item.time) : null, item.minutes ? `${item.minutes} min` : null, item.with ? `with ${item.with}` : null, item.repeat ? 'Routine' : null].filter(Boolean).join(' · ');
  return (
    <button type="button" className={`task-row${item.done ? ' is-done' : ''}${burst ? ' is-burst' : ''}`} aria-pressed={item.done} onClick={onTick}>
      <span className="task-bar" style={{ background: tone ? tone[1] : 'var(--text-3)' }} />
      <span className="task-text"><span className="t-body task-title">{item.title}</span>{when && <span className="t-body-s c-2">{when}</span>}</span>
      {burst ? <XpPill on /> : item.tag && tone && <span className="tag" style={{ background: tone[0], color: tone[1] }}>{item.tag.label}</span>}
    </button>
  );
}

function Hero({ left, done, total, next, desk = false }: { left: number; done: number; total: number; next?: DayThing; desk?: boolean }) {
  // DT2's "Today live" (943:27497): the count stacks over its words, Mylo at
  // the right, and the two plain chips run underneath.
  if (desk) return (
    <section className="hero-card is-desk" aria-label="Today, live">
      <div className="hero-desk-top">
        <div className="hero-desk-text">
          <p className="t-label hero-desk-label">Today · Live</p>
          <p className="hero-desk-count"><Roll value={left} /></p>
          <p className="hero-desk-words">{left === 1 ? 'task left' : 'tasks left'}</p>
        </div>
        <img className="hero-mylo-desk" src="/figma/mylo-desk.svg" alt="" width={92} height={110} />
      </div>
      <p className="hero-desk-chips">
        <span className="hero-desk-chip"><Roll value={done} /> of {total} done</span>
        {next?.time && <span className="hero-desk-chip">Next {clock(next.time, false)}</span>}
      </p>
    </section>
  );
  return (
    <section className="hero-card" aria-label="Today, live">
      <div className="hero-text">
        <p className="t-label hero-live"><span className="live-dot" />Today · Live</p>
        <p className="hero-count"><Roll value={left} className="t-display" /><span className="t-body">{left === 1 ? 'task left' : 'tasks left'}</span></p>
        <p className="hero-chips">
          <span className="hero-chip t-caption"><Icon name="check-circle" size={16} /><span><Roll value={done} /> of {total} done</span></span>
          {next?.time && <span className="hero-chip t-caption"><Icon name="clock" size={16} />Next {clock(next.time, false)}</span>}
        </p>
      </div>
      <img className="hero-mylo" src="/figma/mylo-hero.svg" alt="" width={112} height={135} />
    </section>
  );
}

export default function TodayView() {
  const { openCapture } = useStore();
  const [burst, fire] = useBurst();
  const toggleThing = useToggleThing(todayIso());
  // A tick plays C3's moment: the burst on the row and the toast.
  const tick = (i: DayThing) => { toggleThing(i); if (!i.done) fire(i.id); };
  const { session, loading, name, profile } = useSession();
  const d = useDay();
  const fresh = useFresh(d.mine.map(i => i.id));
  const [startedEmpty] = useState(() => d.mine.length === 0);
  const [q, setQ] = useState('');
  if (!d.ready) return <main className="screen" aria-busy="true" />;

  const empty = d.mine.length === 0;
  // Up next is everything but the quick to-dos, which have their own card.
  // A ticked row stays for its burst, then folds away.
  const tasks = d.mine.filter(i => i.kind !== 'todo');
  const upNext = tasks.filter(i => !i.done || i.id === burst);
  const arrive = !d.ready || !startedEmpty ? '' : ' is-arriving';
  const line = empty ? 'Day one. Start with something small.' : d.left === 0 ? 'All done for today.' : `${d.left} left today.`;
  const listed = d.mine
    .filter(i => !q || i.title.toLowerCase().includes(q.toLowerCase()))
    // In the day's own order, so a row stays where it is when it is ticked.
    .sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));

  // Each day opens somewhere useful: a day to come opens its plan (N7), today
  // and the days gone open the calendar on that day (E3).
  const week = (
    <nav className="week" aria-label="This week">
      {d.week.map(w => (
        <Link key={w.date.toISOString()} href={w.future ? `/plan?day=${iso(w.date)}` : `/calendar?day=${iso(w.date)}`}
              className={`day${w.today ? ' is-today' : ''}${w.future ? ' is-future' : ''}`} aria-current={w.today ? 'date' : undefined}
              aria-label={w.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}>
          <span className="t-caption day-d">{dayLetter(w.date)}</span>
          <span className="day-n">{w.date.getDate()}</span>
          <span className={`day-dot dot-${w.dot}`} />
        </Link>
      ))}
    </nav>
  );

  return (
    <>
      {/* C1, C9 and C10 open themselves at their moment; AI9 when something slipped twice. */}
      <DailyMoments />
      <MyloNoticed />
      {/* ── Phone: C2, or O17 before anything is added ─────────────────── */}
      <main className="screen only-phone">
        <header className="today-top">
          {!loading && !session
            ? <Link href="/welcome" className="today-signin">Sign in</Link>
            : <Link href="/profile" className="today-me" aria-label="Your profile">
                <Me photo={profile?.avatar_url ?? null} name={name} size={38} />
                <span className="today-online" />
              </Link>}
          <div className="today-top-right">
            <Link href="/streak" className="streak" aria-label={`${d.streak} day streak`}>
              <img src="/figma/flame.svg" alt="" width={18} height={18} />
              <Roll value={d.streak} className="t-title-s" />
            </Link>
            <Link href="/notifications" className="round-btn" aria-label="Notifications"><Icon name="bell" /></Link>
          </div>
        </header>
        <section className="today-hello">
          <p className="t-body-s c-2">{longDate(d.now)}</p>
          <h1 className="today-greeting">{greeting(d.now)}{name ? `, ${name}` : ''}</h1>
          <p className="t-body c-2">{line}</p>
        </section>
        <div className="card week-card">{week}</div>
        {empty ? <EmptyDay /> : <>
          <div className={`today-arrive${arrive}`}><Hero left={d.left} done={d.done} total={d.mine.length} next={d.next} /></div>
          <QuickTodo />
          {upNext.length > 0 && <>
            <div className="section-head"><h2 className="t-title-m">Up next</h2><Link href="/calendar" className="t-body-s c-2">See all</Link></div>
            <div className="card list">
              {upNext.map(t => (
                <div key={t.id} className={`row-wrap${fresh(t.id) ? ' is-new' : ''}${t.done && burst === t.id ? ' is-out' : ''}`}>
                  <div><TaskRow item={t} burst={burst === t.id} onTick={() => tick(t)} /></div>
                </div>
              ))}
            </div>
          </>}
        </>}
      </main>

      {/* ── Desktop: DT2 ──────────────────────────────────────────────── */}
      <main className="desk only-desk">
        <header className="desk-head">
          <div className="desk-hello">
            <p className="desk-date">{longDate(d.now)}</p>
            <h1 className="desk-greeting">{greeting(d.now)}{name ? `, ${name}` : ''}</h1>
            <p className="desk-line">{line}</p>
          </div>
          <label className="desk-search">
            <Icon name="search" size={18} />
            <span className="sr-only">Search</span>
            <input type="search" placeholder="Search tasks, goals, rooms" value={q} onChange={e => setQ(e.target.value)} />
          </label>
          <Link href="/notifications" className="desk-bell" aria-label="Notifications"><Icon name="nav-bell" size={20} /></Link>
          <button type="button" className="desk-new" onClick={openCapture}><Icon name="plus-18" size={18} />New task</button>
        </header>
        <div className="desk-week">{week}</div>
        <div className="desk-cols">
          <section className="desk-tasks">
            {empty ? <EmptyDay big /> : <>
              <div className="desk-list-head"><h2 className="desk-list-title">Today</h2><span className="desk-list-count"><Roll value={d.done} /> of {d.mine.length} done</span></div>
              {listed.map(i => (
                <button key={i.id} type="button" className={`desk-task${i.done ? ' is-done' : ''}${fresh(i.id) ? ' is-new' : ''}${burst === i.id ? ' is-burst' : ''}`} aria-pressed={i.done} onClick={() => tick(i)}>
                  <span className="desk-check">{i.done && <Icon name="check-14" size={14} />}</span>
                  <span className="task-text">
                    <span className="desk-task-title">{i.title}</span>
                    <span className="desk-task-sub">{[i.time ?? (i.kind === 'todo' ? 'To-do' : 'Any time'), i.repeat ? 'Routine' : null, i.tag?.label].filter(Boolean).join(' · ')}</span>
                  </span>
                  {i.done
                    ? <span className="tag" style={{ background: i.tag ? TONE[i.tag.tone][0] : 'var(--tint-green)' }}>{TICK_XP}</span>
                    : i.tag && <span className="tag" style={{ background: TONE[i.tag.tone][0] }}>{i.tag.label}</span>}
                </button>
              ))}
              {q && listed.length === 0 && <p className="t-body c-2">Nothing on today matches &ldquo;{q}&rdquo;.</p>}
            </>}
          </section>
          {!empty && (
            <aside className="desk-rail">
              <Hero left={d.left} done={d.done} total={d.mine.length} next={d.next} desk />
            </aside>
          )}
        </div>
      </main>
    </>
  );
}
