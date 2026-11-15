'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '../Icon';
import Sheet from '../Sheet';
import { CATS, CAT_LOOK, planLine, whenLine, type Cat, type Draft } from '@/lib/ai';

/* What Mylo drafted, three ways: plan cards in the chat (AI5, and DT6's
   single card on a wide screen), the review list (AI1) and the edit sheet
   (AI7). Nothing here is saved until Add. */

function CatIcon({ cat, size }: { cat: Cat | null; size: number }) {
  return <Icon name={cat ? `ai/${CAT_LOOK[cat].icon}` : 'ai/sparkle'} size={size} />;
}
const tint = (cat: Cat | null) => (cat ? CAT_LOOK[cat].tint : 'var(--surface-2)');

export function PlanCards({ drafts, added, onAdd, onEdit }: { drafts: Draft[]; added?: boolean; onAdd: () => void; onEdit: () => void }) {
  const on = drafts.filter(d => d.on);
  return (
    <div className="ai-plan">
      {/* AI5 · phone */}
      <ul className="ai-plan-cards">
        {drafts.map(d => (
          <li key={d.id} className={`ai-plan-card${d.on ? '' : ' is-off'}`} style={{ background: tint(d.cat) }}>
            <span className="ai-plan-when">
              <span className="ai-plan-time">{d.time ?? 'Any time'}</span>
              <CatIcon cat={d.cat} size={18} />
            </span>
            <span className="ai-plan-text">
              <span className="ai-plan-title">{d.title}</span>
              {planLine(d) && <span className="ai-plan-sub">{planLine(d)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {/* DT6 · desktop */}
      <ul className="ai-plan-rows">
        {drafts.map(d => (
          <li key={d.id} className={`ai-plan-row${d.on ? '' : ' is-off'}`}>
            <span className="ai-plan-row-time">{d.time ?? 'Any time'}</span>
            <span className="ai-plan-row-title">{d.title}{d.minutes ? ` · ${d.minutes} min` : ''}</span>
            {d.cat && <span className="ai-plan-tag">{d.cat}</span>}
          </li>
        ))}
      </ul>
      <div className="ai-plan-actions">
        {added
          ? <Link href="/today" className="ai-btn ai-btn-dark"><Icon name="check-14" size={14} />Added</Link>
          : <button type="button" className="ai-btn ai-btn-dark" onClick={onAdd} disabled={!on.length}>
              <Icon name="ai/plus" size={18} className="ai-desk-only" />Add all {on.length}
            </button>}
        {!added && (
          <button type="button" className="ai-btn ai-btn-soft" onClick={onEdit}>
            <span className="ai-phone-only">Edit</span><span className="ai-desk-only">Change times</span>
          </button>
        )}
      </div>
    </div>
  );
}

/* AI1 · Drafted goals. */
export function DraftReview({ drafts, heard, onBack, onChange, onAdd }: {
  drafts: Draft[]; heard?: string; onBack: () => void; onChange: (d: Draft[]) => void; onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const on = drafts.filter(d => d.on).length;
  const edit = drafts.find(d => d.id === editing) ?? null;
  const set = (id: string, patch: Partial<Draft>) => onChange(drafts.map(d => d.id === id ? { ...d, ...patch } : d));
  return (
    <main className="ai-review">
      <header className="ai-review-top">
        <button type="button" className="back-btn" aria-label="Back" onClick={onBack}><Icon name="chevron-right" size={20} className="flip" /></button>
      </header>
      <span className="ai-review-mylo"><img src="/figma/ai/mylo-plain.svg" alt="" width={40} height={48} /></span>
      <h1 className="ai-review-title">Mylo drafted {drafts.length} {drafts.length === 1 ? 'goal' : 'goals'}</h1>
      <p className="ai-review-sub">{heard?.startsWith('voice:') ? 'From your voice note.' : 'From your message.'} Keep what fits, edit the rest.</p>
      {heard && (
        <div className={`ai-heard${open ? ' is-open' : ''}`}>
          <button type="button" className="ai-heard-head" aria-expanded={open} onClick={() => setOpen(o => !o)}>
            <Icon name="ai/headphones" size={22} className="c-2" />
            <span className="ai-heard-label">What Mylo heard</span>
            <Icon name="ai/chevron-down" size={22} className="ai-heard-chev" />
          </button>
          {open && <p className="ai-heard-text">&ldquo;{heard.replace(/^voice:/, '')}&rdquo;</p>}
        </div>
      )}
      <ul className="ai-drafts">
        {drafts.map(d => (
          <li key={d.id} className={`ai-draft${d.on ? ' is-on' : ''}`}>
            <button type="button" className="ai-draft-main" onClick={() => setEditing(d.id)} aria-label={`Edit ${d.title}`}>
              <span className="ai-draft-icon" style={{ background: tint(d.cat) }}><CatIcon cat={d.cat} size={24} /></span>
              <span className="ai-draft-text">
                <span className="ai-draft-title">{d.title}</span>
                <span className="ai-draft-sub">{whenLine(d)}</span>
              </span>
            </button>
            <button type="button" role="checkbox" aria-checked={d.on} aria-label={`Keep ${d.title}`}
                    className="ai-draft-check" onClick={() => set(d.id, { on: !d.on })}>
              {d.on && <Icon name="ai/check" size={18} />}
            </button>
          </li>
        ))}
      </ul>
      <p className="ai-review-note">Tap a goal to change the time, days or colour.</p>
      <span className="spacer" />
      <button type="button" className="btn-primary ai-review-add" onClick={onAdd} disabled={!on}>
        Add {on} {on === 1 ? 'goal' : 'goals'}
      </button>
      <EditDraft draft={edit} onClose={() => setEditing(null)}
                 onSave={patch => { if (edit) set(edit.id, patch); setEditing(null); }} />
    </main>
  );
}

/* AI7 · Edit a draft. */
const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
function EditDraft({ draft, onClose, onSave }: { draft: Draft | null; onClose: () => void; onSave: (p: Partial<Draft>) => void }) {
  const [title, setTitle] = useState(draft?.title ?? '');
  const [repeat, setRepeat] = useState<number[]>(draft?.repeat ?? []);
  const [time, setTime] = useState(draft?.time ?? '');
  const [remind, setRemind] = useState(draft?.remind ?? false);
  const [cat, setCat] = useState<Cat | null>(draft?.cat ?? null);
  // Opening on another draft starts from that draft's saved values.
  const [forId, setForId] = useState(draft?.id);
  if (draft && draft.id !== forId) {
    setForId(draft.id); setTitle(draft.title); setRepeat(draft.repeat); setTime(draft.time ?? ''); setRemind(draft.remind); setCat(draft.cat);
  }
  if (!draft && forId) setForId(undefined);
  return (
    <Sheet open={!!draft} onClose={onClose} title="Edit goal" labelId="ai-edit-title">
      <form className="ai-edit" onSubmit={e => { e.preventDefault(); onSave({ title: title.trim() || draft?.title, repeat: [...repeat].sort(), time: time || undefined, remind: remind && !!time, cat }); }}>
        <label className="ai-field">
          <span className="ai-field-label">Name</span>
          <input className="ai-input" value={title} onChange={e => setTitle(e.target.value)} maxLength={80} />
        </label>
        <fieldset className="ai-field">
          <legend className="ai-field-label">Repeats</legend>
          <div className="ai-days">
            {DAYS.map((l, i) => (
              <button key={i} type="button" className={`ai-day${repeat.includes(i) ? ' is-on' : ''}`} aria-pressed={repeat.includes(i)} aria-label={DAY_NAMES[i]}
                      onClick={() => setRepeat(r => r.includes(i) ? r.filter(x => x !== i) : [...r, i])}>{l}</button>
            ))}
          </div>
        </fieldset>
        <div className="ai-rows">
          <label className="ai-row">
            <span className="ai-row-icon"><Icon name="ai/time" size={24} /></span>
            <span className="ai-row-label">Time</span>
            <span className="ai-row-value">{time || 'Any time'}</span>
            <input type="time" className="ai-row-time" value={time} onChange={e => setTime(e.target.value)} aria-label="Time"
                   onClick={e => { try { e.currentTarget.showPicker(); } catch { /* the field itself still edits */ } }} />
          </label>
          <div className="ai-row">
            <span className="ai-row-icon"><Icon name="ai/bell" size={24} /></span>
            <span className="ai-row-text"><span className="ai-row-label">Remind me</span><span className="t-body-s c-2">15 min before</span></span>
            <button type="button" role="switch" aria-checked={remind} aria-label="Remind me" className={`ai-switch${remind ? ' is-on' : ''}`}
                    onClick={() => setRemind(v => !v)}><span /></button>
          </div>
        </div>
        <fieldset className="ai-field">
          <legend className="ai-field-label">Colour</legend>
          <div className="ai-colours" role="radiogroup" aria-label="Colour">
            {CATS.map(c => (
              <button key={c} type="button" role="radio" aria-checked={cat === c} className={`ai-colour${cat === c ? ' is-on' : ''}`}
                      style={{ background: CAT_LOOK[c].tint }} onClick={() => setCat(c)}>
                <Icon name={`ai/${CAT_LOOK[c].icon}`} size={24} />
                <span>{c}</span>
              </button>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary ai-edit-save">Save goal</button>
      </form>
    </Sheet>
  );
}
