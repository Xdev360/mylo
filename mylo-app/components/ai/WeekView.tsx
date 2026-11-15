'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Icon from '../Icon';
import { useHydrated, useLocal } from '@/lib/local';
import { useStore } from '@/lib/store';
import {
  CAT_LOOK, DAILY, SLIPS_KEY, USAGE_KEY, readWeek, slipId, useNow, usedToday, weekRange,
  type Slip, type SlipNote, type Usage
} from '@/lib/ai';
import { iso } from '@/lib/dates';
import { FixRow, NoticedSheet, useApplyFix } from './Noticed';
import Limit from './Limit';
import { canGoBack, goBack } from '@/components/NavMotion';

/* AI10 · Your week, read by Mylo. Done, missed and on time come from the
   person's own Today this week; what slipped is every missed thing by name,
   with the reason they gave (AI9) and the fix Mylo suggested. */
export default function WeekView() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { items, ready } = useStore();
  const now = useNow();
  const [notes, setNotes] = useLocal<Record<string, SlipNote>>(SLIPS_KEY, {});
  const [usage, setUsage] = useLocal<Usage>(USAGE_KEY, { day: '', n: 0 });
  const [open, setOpen] = useState<Slip | null>(null);
  const [limit, setLimit] = useState(false);
  const apply = useApplyFix();
  const week = useMemo(() => (now ? readWeek(items, new Date(now)) : null), [items, now]);

  if (!hydrated || !ready || !week) return <main className="screen on-desk ai-week" aria-busy="true" />;
  const used = usedToday(usage, iso(new Date(now)));
  if (limit) return <div className="ai-week-limit"><Limit used={used} onBack={() => setLimit(false)} /></div>;

  const noteOf = (s: Slip) => notes[slipId(week.start, s.key)];
  const save = (s: Slip) => (n: SlipNote) => setNotes(all => ({ ...all, [slipId(week.start, s.key)]: n }));
  const close = () => (canGoBack() ? goBack(router) : router.push('/ai'));

  return (
    <main className="screen on-desk ai-week">
      <header className="ai-week-top">
        <div className="ai-week-hello">
          <h1 className="ai-week-title">Your week</h1>
          <p className="t-body-s c-2">Read by Mylo · {weekRange(week.start, week.end)}</p>
        </div>
        <button type="button" className="back-btn ai-week-close" aria-label="Close" onClick={close}><Icon name="ai/close" size={20} /></button>
      </header>

      <div className="ai-stats">
        <p className="ai-stat" style={{ background: 'var(--tint-green)' }}><span className="ai-stat-n" style={{ color: 'var(--green)' }}>{week.done}</span><span className="t-caption c-2">done</span></p>
        <p className="ai-stat" style={{ background: 'var(--tint-red)' }}><span className="ai-stat-n" style={{ color: 'var(--red)' }}>{week.missed}</span><span className="t-caption c-2">missed</span></p>
        <p className="ai-stat" style={{ background: 'var(--tint-blue)' }}><span className="ai-stat-n" style={{ color: 'var(--blue)' }}>{week.onTime === null ? '–' : `${week.onTime}%`}</span><span className="t-caption c-2">on time</span></p>
      </div>

      {week.slips.length > 0 && <>
        <h2 className="t-title-s">What slipped, and a fix</h2>
        <div className="ai-slips">
          {week.slips.map(s => {
            const note = noteOf(s);
            return (
              <article key={s.key} className="ai-slip">
                <button type="button" className="ai-slip-head" onClick={() => setOpen(s)}>
                  <span className="ai-slip-icon" style={{ background: s.cat ? CAT_LOOK[s.cat].tint : 'var(--surface-2)' }}>
                    <Icon name={s.cat ? `ai/${CAT_LOOK[s.cat].icon}` : 'ai/sparkle'} size={22} />
                  </span>
                  <span className="ai-slip-text">
                    <span className="ai-slip-title">{s.title}</span>
                    <span className="t-caption c-2">Missed {s.missed} · {note?.reason ? <>you said &ldquo;{note.reason.toLowerCase()}&rdquo;</> : s.days.join(', ')}</span>
                  </span>
                </button>
                {note?.fix
                  ? <FixRow note={note} onApply={() => apply(note, save(s))} />
                  : (
                    <button type="button" className="ai-fix ai-fix-ask" onClick={() => setOpen(s)}>
                      <Icon name="ai/sparkle" size={16} className="ai-fix-spark" />
                      <span className="ai-fix-label">Ask Mylo for a fix</span>
                    </button>
                  )}
              </article>
            );
          })}
        </div>
      </>}

      <NoticedSheet slip={open} note={open ? noteOf(open) : undefined} onNote={n => { if (open) save(open)(n); }}
                    left={Math.max(0, DAILY - used)}
                    onSpend={() => setUsage(u => { const d = iso(new Date()); return { day: d, n: (u.day === d ? u.n : 0) + 1 }; })}
                    onLimit={() => { setOpen(null); setLimit(true); }} onClose={() => setOpen(null)} />
    </main>
  );
}
