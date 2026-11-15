'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '../Icon';
import TaskSheet from './TaskSheet';
import { useStore } from '@/lib/store';
import { BOARD, TONE, goalsOf, nextUp, progress, rhythm, status, useMeta, type Goal } from '@/lib/goals';
import { useHydrated } from '@/lib/local';

/* E1 · Goals (877:110589) on a phone, DT3 · Goals (946:27380) from 1024.
   Active are one-off goals, Systems are the ones that repeat, Done is both
   once finished. Every account starts with none. */
type Tab = 'active' | 'systems' | 'done';
const TABS: { id: Tab; label: string }[] = [{ id: 'active', label: 'Active' }, { id: 'systems', label: 'Systems' }, { id: 'done', label: 'Done' }];

const doneDate = (g: Goal) => g.doneAt ? new Date(g.doneAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '';

function GoalCard({ g, onMore }: { g: Goal; onMore: () => void }) {
  const p = progress(g);
  const tone = g.tag ? TONE[g.tag.tone] : null;
  const sub = [rhythm(g) || (g.steps.length ? `${p.done} of ${p.total}` : null), g.with ? `with ${g.with}` : null].filter(Boolean).join(', ');
  return (
    <article className="g-card">
      <Link href={`/goals/${g.id}`} className="g-card-link" aria-label={g.title} />
      <div className="g-card-top">
        <span className="g-board" style={{ background: tone?.tint ?? 'var(--surface-2)' }}>
          <img src={BOARD[g.tag?.tone ?? 'blue']} alt="" width={74} height={82} />
        </span>
        <div className="g-card-text">
          {g.tag && tone && <span className="tag" style={{ background: tone.tint, color: tone.ink }}>{g.tag.label}</span>}
          <span className="t-title-s g-ellipsis">{g.title}</span>
          {sub && <span className="t-body-s c-2 g-ellipsis">{sub}</span>}
        </div>
        <button type="button" className="g-more" aria-label={`More for ${g.title}`} onClick={onMore}><Icon name="goals/more-22" /></button>
      </div>
      <span className="g-bar"><span style={{ width: `${p.pct}%`, background: tone?.ink ?? 'var(--ink)' }} /></span>
      <div className="g-card-foot"><span className="t-title-s">{p.pct}%</span><span className="t-body-s c-2">{status(g)}</span></div>
    </article>
  );
}

export default function GoalsView() {
  const ready = useHydrated();
  const { items } = useStore();
  const { all } = useMeta();
  const [tab, setTab] = useState<Tab>('active');
  const [filter, setFilter] = useState<string>('All');
  const [sheet, setSheet] = useState<string | null>(null);
  if (!ready) return <main className="screen" aria-busy="true" />;

  const goals = goalsOf(items, all);
  const open = goals.filter(g => !g.done);
  const done = goals.filter(g => g.done).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const month = new Date().toISOString().slice(0, 7);
  const doneThisMonth = done.filter(g => g.doneAt?.startsWith(month)).length;
  const shown = tab === 'done' ? done : open.filter(g => (tab === 'systems') === (g.repeat !== 'once'));

  const tags = Array.from(new Set(open.map(g => g.tag?.label).filter(Boolean))) as string[];
  const deskShown = filter === 'Done' ? done : filter === 'All' ? open : open.filter(g => g.tag?.label === filter);
  const shared = open.filter(g => g.with || g.room).length;

  return (
    <>
      {/* ── Phone: E1 ─────────────────────────────────────────────────── */}
      <main className="screen g-goals only-phone">
        <header className="g-goals-head">
          <div>
            <h1 className="g-h1">Goals</h1>
            <p className="t-body-s c-2">{open.length} active · {doneThisMonth} done this month</p>
          </div>
          <Link href="/calendar" className="round-btn" aria-label="Calendar"><Icon name="goals/calendar-22" /></Link>
        </header>
        <div className="g-seg" role="tablist" aria-label="Show">
          {TABS.map(t => (
            <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className="g-seg-btn" onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        {shown.map(g => <GoalCard key={g.id} g={g} onMore={() => setSheet(g.id)} />)}
        {shown.length === 0 && tab !== 'done' && (
          <Link href={tab === 'systems' ? '/goals/new?repeat=daily' : '/goals/new'} className="g-empty-add">
            <Icon name="plus-18" size={18} />New goal
          </Link>
        )}
      </main>

      {/* ── Desktop: DT3 ──────────────────────────────────────────────── */}
      <main className="desk g-desk only-desk">
        <header className="g-desk-head">
          <div className="g-desk-title">
            <p className="t-body-s c-2">{open.length} active · {shared} shared</p>
            <h1 className="desk-greeting">Goals</h1>
          </div>
          <Link href="/goals/new" className="desk-new"><Icon name="plus-18" size={18} />New goal</Link>
        </header>
        <div className="g-filters" role="tablist" aria-label="Filter">
          {[['All', open.length], ...tags.map(t => [t, open.filter(g => g.tag?.label === t).length]), ['Done', done.length]].map(([label, n]) => (
            <button key={label} type="button" role="tab" aria-selected={filter === label} className="g-filter" onClick={() => setFilter(String(label))}>{label} {n}</button>
          ))}
        </div>
        {deskShown.length > 0 ? (
          <div className="g-grid">
            {deskShown.map(g => {
              const p = progress(g); const tone = g.tag ? TONE[g.tag.tone] : null; const next = nextUp(g);
              return (
                <Link key={g.id} href={`/goals/${g.id}`} className="g-dcard">
                  <span className="g-dcard-top">
                    {g.tag && tone && <span className="g-dchip" style={{ background: tone.tint }}>{g.tag.label}</span>}
                    <span className="spacer" />
                    <span className="t-body-s c-2">{g.with ? `Shared with ${g.with}` : 'Private'}</span>
                  </span>
                  <span className="g-dcard-title">{g.title}</span>
                  <span className="g-dprog">
                    <span className="g-dbar"><span style={{ width: `${p.pct}%`, background: tone?.ink ?? 'var(--ink)' }} /></span>
                    <span className="g-dpct">{p.pct}%</span>
                  </span>
                  {next && <span className="g-dnext"><Icon name="goals/time" size={16} />Next: {next}</span>}
                </Link>
              );
            })}
          </div>
        ) : filter !== 'Done' && (
          <Link href="/goals/new" className="g-empty-add is-desk"><Icon name="plus-18" size={18} />New goal</Link>
        )}
        {done.length > 0 && filter !== 'Done' && (
          <section className="g-finished">
            <div className="g-finished-head">
              <h2 className="g-h17">Finished recently</h2><span className="spacer" />
              <button type="button" className="t-body-s c-2" onClick={() => setFilter('Done')}>See all {done.length}</button>
            </div>
            {done.slice(0, 3).map(g => (
              <Link key={g.id} href={`/goals/${g.id}`} className="g-drow">
                <Icon name="goals/trophy" size={20} />
                <span className="task-text"><span className="g-drow-title">{g.title}</span><span className="t-body-s c-2">{['Done', doneDate(g)].join(' ')}{g.tag ? ` · ${g.tag.label}` : ''}</span></span>
                {g.tag && <span className="g-dchip is-white">{g.tag.label}</span>}
              </Link>
            ))}
          </section>
        )}
      </main>

      <TaskSheet id={sheet} onClose={() => setSheet(null)} />
    </>
  );
}
