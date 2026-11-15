'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated } from '@/lib/local';
import { uid, useRewards, type Reward } from '@/lib/apps';
import { Head, Toggle } from './ui';

/* W6 · Edit reward (528:103098). A reward you set yourself ("after 3 tasks,
   one episode"). /apps/rewards/new starts one. While a reward is ready to
   claim it can't be changed. */
type Panel = 'what' | 'when' | 'limit' | 'history' | 'delete' | null;
const LIMITS = [15, 30, 45, 60];

export default function RewardEdit({ id }: { id: string }) {
  const router = useRouter();
  const ready = useHydrated();
  const [all, setAll] = useRewards();
  const [panel, setPanel] = useState<Panel>(id === 'new' ? 'what' : null);
  const [newId] = useState(uid);
  const [draft, setDraft] = useState('');
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const found = all.find(r => r.id === id);
  const r: Reward = found ?? { id: newId, what: '', after: 3, paused: false, history: [] };
  const locked = !!r.ready;
  const put = (patch: Partial<Reward>) => {
    const next = { ...r, ...patch };
    setAll(a => (a.some(x => x.id === next.id) ? a.map(x => (x.id === next.id ? next : x)) : [...a, next]));
    if (!found) router.replace(`/apps/rewards/${next.id}`);
  };
  const open = (p: Panel) => { if (locked && p !== 'history') return; setDraft(r.what); setPanel(p); };
  const sub = [`After ${r.after} ${r.after === 1 ? 'task' : 'tasks'}`, r.minutes ? `${r.minutes} min` : null, r.paused ? 'Paused' : null].filter(Boolean).join(' · ');

  const row = (icon: string, label: string, onClick: () => void) => (
    <button type="button" className="ax-wrow" onClick={onClick} disabled={locked && label !== 'See history'}>
      <Icon name={`apps/${icon}`} size={24} />
      <span className="ax-wrow-t">{label}</span>
      <Icon name="chevron-right" size={20} className="c-3" />
    </button>
  );

  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-reward-edit">
      <Head title="Edit reward" fallback="/rewards" />
      <div className="ax-wcard">
        <span className="ax-wlogo"><Icon name="apps/i-gift-16" size={26} /></span>
        <span><span className="t-title-s">{r.what || 'Edit what you earn'}</span><span className="t-body-s c-2">{sub}</span></span>
      </div>
      <div className="ax-wrows">
        {row('i-pencil', 'Edit what you earn', () => open('what'))}
        {row('i-repeat', 'Change when you earn it', () => open('when'))}
        {row('i-timer', 'Time limit', () => open('limit'))}
        <div className={`ax-wrow${!found || locked ? ' is-off' : ''}`}>
          <Icon name="apps/i-pause" size={24} />
          <span className="ax-wrow-t">Pause this reward</span>
          <Toggle on={r.paused} onChange={v => { if (found && !locked) put({ paused: v }); }} label="Pause this reward" />
        </div>
        {row('i-chart', 'See history', () => open('history'))}
      </div>
      {found && (
        <button type="button" className="ax-wrow is-delete" disabled={locked} onClick={() => open('delete')}>
          <img src="/figma/apps/i-trash.svg" alt="" width={24} height={24} />
          <span className="ax-wrow-t">Delete reward</span>
        </button>
      )}
      <p className="ax-note ax-center">Rewards cannot be changed while one is ready to claim.</p>

      <Sheet open={panel === 'what'} onClose={() => setPanel(null)} title="Edit what you earn">
        <form className="ax-form" onSubmit={e => { e.preventDefault(); if (draft.trim()) { put({ what: draft.trim() }); setPanel(null); } }}>
          <input autoFocus className="ax-input" value={draft} onChange={e => setDraft(e.target.value)} placeholder="1 episode of Netflix" aria-label="What you earn" maxLength={60} />
          <button type="submit" className="ax-btn" disabled={!draft.trim()}>Save</button>
        </form>
      </Sheet>
      <Sheet open={panel === 'when'} onClose={() => setPanel(null)} title="Change when you earn it">
        <div className="ax-stepper">
          <button type="button" className="ax-round" aria-label="Fewer" onClick={() => put({ after: Math.max(1, r.after - 1) })}>&minus;</button>
          <span className="t-title-m">After {r.after} {r.after === 1 ? 'task' : 'tasks'}</span>
          <button type="button" className="ax-round" aria-label="More" onClick={() => put({ after: Math.min(20, r.after + 1) })}><Icon name="plus-20" size={18} /></button>
        </div>
        <button type="button" className="ax-btn" onClick={() => setPanel(null)}>Save</button>
      </Sheet>
      <Sheet open={panel === 'limit'} onClose={() => setPanel(null)} title="Time limit">
        <div className="ax-chips">
          {LIMITS.map(m => <button key={m} type="button" className={`ax-chip${r.minutes === m ? ' is-on' : ''}`} aria-pressed={r.minutes === m} onClick={() => put({ minutes: r.minutes === m ? undefined : m })}>{m} min</button>)}
        </div>
        <button type="button" className="ax-btn" onClick={() => setPanel(null)}>Save</button>
      </Sheet>
      <Sheet open={panel === 'history'} onClose={() => setPanel(null)} title="See history">
        <div className="card list">
          {r.history.map((h, i) => <p key={i} className="ax-row"><span className="ax-row-t">{new Date(h).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span></p>)}
        </div>
      </Sheet>
      <Sheet open={panel === 'delete'} onClose={() => setPanel(null)} title="Delete reward" sub={r.what}>
        <button type="button" className="ax-btn is-danger" onClick={() => { setAll(a => a.filter(x => x.id !== r.id)); router.replace('/rewards'); }}>Delete reward</button>
        <button type="button" className="ax-btn ax-btn-soft" onClick={() => setPanel(null)}>Keep it</button>
      </Sheet>
    </main>
  );
}
