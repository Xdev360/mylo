'use client';

import '@/styles/ai.css';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Icon from '../Icon';
import Sheet from '../Sheet';
import { useHydrated, useLocal } from '@/lib/local';
import { useStore } from '@/lib/store';
import {
  askMylo, DAILY, fromGoal, readWeek, REASONS, SLIPS_KEY, slipId, toItem, USAGE_KEY, useNow, usedToday,
  type Slip, type SlipNote, type Usage
} from '@/lib/ai';
import { addDays, iso } from '@/lib/dates';

/* AI9 · Mylo noticed. The card says what slipped this week; the sheet asks
   what got in the way and lets Mylo suggest one easier version. The answer
   is the person's to apply. */

export function NoticedCard({ slip, onOpen }: { slip: Slip; onOpen: () => void }) {
  return (
    <button type="button" className="ai-noticed" onClick={onOpen}>
      <span className="ai-noticed-head"><img src="/figma/ai/mylo-calm-head.svg" alt="" width={44} height={44} /></span>
      <span className="ai-noticed-text">
        <span className="ai-noticed-label">Mylo noticed something</span>
        <span className="ai-noticed-line">{slip.title} slipped {slip.missed} times this week.</span>
      </span>
    </button>
  );
}

export const fixLabel = (n?: SlipNote) => (n?.fix ? `${n.fix.title}${n.fix.time ? ` at ${n.fix.time}` : ''}` : '');

export function FixRow({ note, onApply }: { note: SlipNote; onApply: () => void }) {
  return (
    <div className="ai-fix">
      <Icon name="ai/sparkle" size={16} className="ai-fix-spark" />
      <span className="ai-fix-label">{fixLabel(note)}</span>
      {note.applied
        ? <span className="ai-fix-apply is-done" aria-label="Applied"><Icon name="check-14" size={14} /></span>
        : <button type="button" className="ai-fix-apply" onClick={onApply}>Apply</button>}
    </div>
  );
}

export function useApplyFix() {
  const { add } = useStore();
  return (note: SlipNote, save: (n: SlipNote) => void) => {
    if (!note.fix || note.applied) return;
    add(toItem(note.fix));
    save({ ...note, applied: true });
  };
}

export function NoticedSheet({ slip, note, onNote, left, onSpend, onLimit, onClose }: {
  slip: Slip | null; note?: SlipNote; onNote: (n: SlipNote) => void;
  left: number; onSpend: () => void; onLimit: () => void; onClose: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [forKey, setForKey] = useState(slip?.key);
  const apply = useApplyFix();
  const [forSub, setForSub] = useState('');
  if (slip && slip.key !== forKey) {
    setForKey(slip.key); setPicked(note?.reason ?? null); setFailed(false); setForSub(`${slip.title} · missed ${slip.days.join(', ')}`);
  }
  const reason = picked ?? note?.reason ?? null;

  async function ask() {
    if (!slip || !reason || busy) return;
    if (left <= 0) { onLimit(); return; }
    setBusy(true); setFailed(false);
    try {
      const times = slip.missed === 1 ? 'once' : `${slip.missed} times`;
      const r = await askMylo({
        mode: 'goals',
        text: `${slip.title} keeps slipping: missed ${times} this week, on ${slip.days.join(' ')}. What got in the way: ${reason.toLowerCase()}. Plan one easier version of it for tomorrow.`
      });
      const goal = r.engine === 'local' ? null : r.goals[0];
      if (!goal) throw new Error('no fix');
      onSpend();
      const fix = fromGoal({ ...goal, due_date: goal.due_date && goal.due_date > iso(new Date()) ? goal.due_date : iso(addDays(new Date(), 1)) });
      onNote({ reason, fix: { ...fix, cat: fix.cat ?? slip.cat }, note: r.reply, applied: false });
    } catch { setFailed(true); }
    finally { setBusy(false); }
  }

  return (
    <Sheet open={!!slip} onClose={onClose} title="What got in the way?" labelId="ai-noticed-title"
           sub={slip ? `${slip.title} · missed ${slip.days.join(', ')}` : forSub}>
      {slip && <div className="ai-why">
        <div className="ai-why-chips" role="radiogroup" aria-label="What got in the way?">
          {REASONS.map(r => (
            <button key={r.label} type="button" role="radio" aria-checked={reason === r.label}
                    className={`ai-why-chip${reason === r.label ? ' is-on' : ''}`} onClick={() => setPicked(r.label)}>
              <Icon name={`ai/${r.icon}`} size={18} />{r.label}
            </button>
          ))}
        </div>
        {note?.fix && note.reason === reason
          ? <>
              {note.note && <p className="t-body-s c-2">{note.note}</p>}
              <FixRow note={note} onApply={() => apply(note, onNote)} />
            </>
          : <>
              <button type="button" className="btn-primary ai-why-ask" onClick={ask} disabled={!reason || busy} aria-busy={busy}>
                <Icon name="ai/sparkle" size={18} />{busy ? <span className="ai-dots" aria-label="Thinking"><i /><i /><i /></span> : 'Ask Mylo for a fix'}
              </button>
              {failed && <p className="ai-not-sent" role="alert"><Icon name="ai/alert" size={18} />Not sent. Tap to retry</p>}
            </>}
        <p className="t-caption c-3">No judgement. Mylo only uses this to help.</p>
      </div>}
    </Sheet>
  );
}

/* The whole of AI9 in one piece, for Today: renders nothing until something
   slipped twice this week, then the card, and the sheet behind it.
   <MyloNoticed /> */
export function MyloNoticed() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { items, ready } = useStore();
  const now = useNow();
  const [notes, setNotes] = useLocal<Record<string, SlipNote>>(SLIPS_KEY, {});
  const [usage, setUsage] = useLocal<Usage>(USAGE_KEY, { day: '', n: 0 });
  const [open, setOpen] = useState<Slip | null>(null);
  const week = useMemo(() => (now ? readWeek(items, new Date(now)) : null), [items, now]);
  const slip = week?.slips.find(s => s.missed >= 2);
  if (!hydrated || !ready || !week || !slip) return null;
  const k = (s: Slip) => slipId(week.start, s.key);
  return (
    <>
      <NoticedCard slip={slip} onOpen={() => setOpen(slip)} />
      <NoticedSheet slip={open} note={open ? notes[k(open)] : undefined}
                    onNote={n => { if (open) setNotes(all => ({ ...all, [k(open)]: n })); }}
                    left={Math.max(0, DAILY - usedToday(usage, iso(new Date(now))))}
                    onSpend={() => setUsage(u => { const d = iso(new Date()); return { day: d, n: (u.day === d ? u.n : 0) + 1 }; })}
                    onLimit={() => router.push('/ai?limit')} onClose={() => setOpen(null)} />
    </>
  );
}
