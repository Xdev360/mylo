'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import Sheet from '../Sheet';

/* D2 · Voice capture, listening (877:108942). Speaks into the browser's own
   speech recognition; the words come up live, the tick hands them back, the
   keyboard goes back to typing, the cross drops them. Reusable: the capture
   sheet's mic can open it with onDone={setText}. */
type Rec = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; abort: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null };
type RecCtor = new () => Rec;
const BARS = [8, 16, 28, 20, 36, 24, 14, 30, 18, 10, 22, 12, 6];

export default function VoiceSheet({ open, onClose, onDone, onType }: { open: boolean; onClose: () => void; onDone: (text: string) => void; onType?: () => void }) {
  const [text, setText] = useState('');
  const [live, setLive] = useState(false);
  const [missing, setMissing] = useState(false);
  const rec = useRef<Rec | null>(null);

  useEffect(() => {
    if (!open) return;
    const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) { queueMicrotask(() => setMissing(true)); return; }
    const r = new Ctor();
    r.lang = navigator.language || 'en-GB'; r.interimResults = true; r.continuous = true;
    r.onresult = e => setText(Array.from(e.results).map(x => x[0].transcript).join(''));
    r.onend = () => setLive(false);
    r.onerror = () => setLive(false);
    rec.current = r;
    try { r.start(); queueMicrotask(() => setLive(true)); } catch { /* already started */ }
    return () => { r.onend = null; r.abort(); rec.current = null; setText(''); setLive(false); };
  }, [open]);

  const done = () => { const t = text.trim(); rec.current?.stop(); onClose(); if (t) onDone(t); };

  return (
    <Sheet open={open} onClose={onClose} title="Listening…" labelId="voice-title">
      <div className="g-voice">
        <div className="g-orb">
          <span className="g-disc g-disc-99" />
          <img src="/figma/goals/mylo-white-smile.svg" alt="" width={71} height={90} />
        </div>
        <div className={`g-wave${live ? ' is-live' : ''}`} aria-hidden>
          {BARS.map((h, i) => <i key={i} style={{ height: h, animationDelay: `${(i % 5) * 0.12}s` }} />)}
        </div>
        <p className="g-voice-text" aria-live="polite">
          {missing ? 'Speech isn’t available here. Type it instead.' : text ? `“${text}…”` : ''}
        </p>
        <div className="g-voice-controls">
          <button type="button" className="g-icon-44" aria-label="Cancel" onClick={onClose}><Icon name="close" size={20} /></button>
          <button type="button" className="g-voice-ok" aria-label="Use this" onClick={done} disabled={!text.trim()}><Icon name="goals/check-26" size={26} /></button>
          <button type="button" className="g-icon-44" aria-label="Type instead" onClick={() => { onClose(); onType?.(); }}><Icon name="goals/keyboard" size={20} /></button>
        </div>
      </div>
    </Sheet>
  );
}
