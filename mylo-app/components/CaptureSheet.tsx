'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Icon from './Icon';
import VoiceSheet from './goals/VoiceSheet';
import { useAnnounce } from './goals/Tick';
import { stampNav } from './NavMotion';
import { useStore, type Kind } from '@/lib/store';
import { parse } from '@/lib/parse';
import { fromIso, shortDate, todayIso, weekdayName } from '@/lib/dates';

/* D1 · Capture sheet (centre +), Figma 877:108733. Type it like you'd say
   it; the details come out as chips; or start from a goal, a system or a
   to-do. The one button adds it to the day it landed on. On a phone it rises
   from the bottom over a dim layer; on a wide screen it opens in the middle.
   Swipe down on the grabber, tap the dim layer, the close button or Escape. */
const TYPES: { kind: Kind; label: string; sub: string; icon: string }[] = [
  { kind: 'goal', label: 'Goal', sub: 'One thing', icon: 'type-goal' },
  { kind: 'system', label: 'System', sub: 'A routine', icon: 'type-system' },
  { kind: 'todo', label: 'To-do', sub: 'No time', icon: 'type-todo' }
];

export default function CaptureSheet() {
  const { captureOpen, closeCapture, add } = useStore();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<Kind>('task');
  const [drag, setDrag] = useState(0);
  const [voice, setVoice] = useState(false);
  const router = useRouter();
  const path = usePathname();
  const announce = useAnnounce();
  const start = useRef<number | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!captureOpen) return;
    const t = setTimeout(() => input.current?.focus(), 250);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCapture(); };
    window.addEventListener('keydown', onKey);
    return () => { clearTimeout(t); window.removeEventListener('keydown', onKey); };
  }, [captureOpen, closeCapture]);

  const p = parse(text);
  const today = todayIso();
  const day = p.date === today ? 'today' : weekdayName(fromIso(p.date));
  // A to-do has no time, so its time chip goes; the others read as parsed.
  const chips = text.trim() ? [
    { icon: 'chip-date', label: shortDate(fromIso(p.date)) },
    p.time && kind !== 'todo' && { icon: 'chip-time', label: p.time },
    p.minutes && { icon: 'chip-length', label: `${p.minutes} min` },
    p.with && { icon: 'chip-with', label: `With ${p.with}` },
    p.tag && { icon: 'chip-tag', label: p.tag.label }
  ].filter(Boolean) as { icon: string; label: string }[] : [];
  // The chips' row folds shut with its last chips still in it.
  const [lastChips, setLastChips] = useState(chips);
  if (chips.length && chips.map(c => c.label).join() !== lastChips.map(c => c.label).join()) setLastChips(chips);
  const shownChips = chips.length ? chips : lastChips;

  function submit() {
    if (!text.trim()) { input.current?.focus(); return; }
    const k: Kind = kind === 'todo' ? 'todo' : kind;
    const id = add({ kind: k, title: p.title, date: p.date, time: k === 'todo' ? undefined : p.time, minutes: p.minutes, with: p.with, tag: p.tag });
    const where = p.date === today ? 'Today' : weekdayName(fromIso(p.date));
    // Say where it went whenever it lands somewhere this screen doesn't show.
    if (k === 'system') announce({ line: 'Routine added', sub: `${p.title} · every day from ${where === 'Today' ? 'today' : where}`, href: `/goals/${id}` });
    else if (p.date !== today || path !== '/today') announce({ line: `Added to ${where}`, sub: p.title, href: p.date === today ? '/today' : `/plan?day=${p.date}` });
    setText(''); setKind('task'); closeCapture();
  }

  return (
    <div className={`sheet-root${captureOpen ? ' is-open' : ''}`} aria-hidden={!captureOpen} inert={!captureOpen}>
      <button type="button" className="scrim" aria-label="Close" onClick={closeCapture} tabIndex={-1} />
      {/* D2 takes D1's place while you speak (877:108942), under the same dim. */}
      <div role="dialog" aria-modal="true" aria-labelledby="capture-title" className={`sheet${voice ? ' is-away' : ''}`}
           style={drag ? { translate: `0 ${drag}px`, transition: 'none' } : undefined}>
        <div className="sheet-head"
             onPointerDown={e => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId); }}
             onPointerMove={e => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); }}
             onPointerUp={() => { if (drag > 110) closeCapture(); start.current = null; setDrag(0); }}>
          <span className="grabber" />
          <div className="sheet-row">
            <div className="sheet-text">
              <h2 id="capture-title" className="sheet-title">Add to today</h2>
              <p className="t-body-s c-2">Type it like you&rsquo;d say it. Mylo sorts the details.</p>
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={closeCapture}><Icon name="close" size={19} /></button>
          </div>
        </div>

        <div className="sheet-body">
          <div className="smart">
            <label className="sr-only" htmlFor="capture-input">What do you want to do?</label>
            <textarea id="capture-input" ref={input} className="smart-input" rows={2} value={text}
                      placeholder="Gym tomorrow at 7pm with Tobi for an hour"
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }} />
            {/* Each detail pops in as Mylo reads it, and pops again when it changes. */}
            <div className={`smart-chips-wrap${chips.length ? ' is-on' : ''}`} aria-live="polite">
              <div className="smart-chips">
                {shownChips.map(c => <span key={c.icon + c.label} className="chip smart-chip"><Icon name={c.icon} size={16} />{c.label}</span>)}
              </div>
            </div>
            <div className="smart-foot">
              <Icon name="sparkles" size={16} />
              <span className="smart-note">{chips.length ? `Mylo filled ${chips.length} ${chips.length === 1 ? 'detail' : 'details'}` : 'Mylo fills in the details'}</span>
              <span className="spacer" />
              <button type="button" className="icon-btn" aria-label="Speak it" onClick={() => setVoice(true)}><Icon name="mic" size={19} /></button>
            </div>
          </div>

          <p className="t-label c-3">Or start from</p>
          <div className="types" role="radiogroup" aria-label="Start from">
            {TYPES.map(t => (
              <button key={t.kind} type="button" role="radio" aria-checked={kind === t.kind}
                      className={`type${kind === t.kind ? ' is-on' : ''}`}
                      onClick={() => {
                        // A goal has its own screen (D3) with steps and repeats.
                        if (t.kind === 'goal') { closeCapture(); stampNav('push'); router.push(`/goals/new${text.trim() ? `?title=${encodeURIComponent(p.title)}` : ''}`); return; }
                        setKind(k => k === t.kind ? 'task' : t.kind);
                      }}>
                <Icon name={t.icon} />
                <span className="type-label">{t.label}</span>
                <span className="type-sub">{t.sub}</span>
              </button>
            ))}
          </div>

          <button type="button" className="btn-primary" onClick={submit}>
            <span key={day} className="swap-in">{kind === 'system' ? (day === 'today' ? 'Start today' : `Start ${day}`) : `Add to ${day}`}</span>
          </button>
        </div>
      </div>
      <VoiceSheet open={voice} onClose={() => setVoice(false)}
                  onDone={t => { setText(t); setVoice(false); }}
                  onType={() => { setVoice(false); input.current?.focus(); }} />
    </div>
  );
}
