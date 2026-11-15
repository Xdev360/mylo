'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';

/* The pieces of a voice note: its bars, the bubble that plays it back (AI3),
   the recording bar (AI2) and Mylo listening in the middle of the chat. */
export const fmtSecs = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export function Waveform({ levels, played = 1, className = '' }: { levels: number[]; played?: number; className?: string }) {
  return (
    <span className={`ai-wave ${className}`} aria-hidden>
      {levels.map((v, i) => (
        <span key={i} className={i / levels.length < played ? 'is-on' : ''} style={{ height: `${Math.round(6 + v * 22)}px` }} />
      ))}
    </span>
  );
}

/* Playback lives only as long as this visit: the recording is never sent or
   saved, so after a reload the bubble keeps its bars and length alone. */
export const audioFor = new Map<string, string>();

export function VoiceNote({ id, secs, bars, dim = false, audio }: { id: string; secs: number; bars: number[]; dim?: boolean; audio?: string }) {
  const src = audio ?? audioFor.get(id);
  const el = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  useEffect(() => () => { el.current?.pause(); }, []);
  function toggle() {
    if (!src) return;
    if (!el.current) {
      const a = new Audio(src);
      a.ontimeupdate = () => setAt(a.duration && isFinite(a.duration) ? a.currentTime / a.duration : a.currentTime / Math.max(1, secs));
      a.onended = () => { setPlaying(false); setAt(0); };
      el.current = a;
    }
    if (playing) { el.current.pause(); setPlaying(false); }
    else { el.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false)); }
  }
  return (
    <div className={`ai-voice${dim ? ' is-dim' : ''}`}>
      {src && (
        <button type="button" className="ai-voice-play" onClick={toggle} aria-label={playing ? 'Pause voice note' : 'Play voice note'}>
          {playing ? <span className="ai-pause" aria-hidden /> : <Icon name="ai/play" size={20} />}
        </button>
      )}
      <Waveform levels={bars} played={playing || at ? at : 1} className={src ? '' : 'is-flat'} />
      <span className="ai-voice-len">{fmtSecs(secs)}</span>
    </div>
  );
}

export function Listening() {
  return (
    <div className="ai-listening" aria-live="polite">
      <span className="ai-listening-disc"><img src="/figma/ai/mylo-listening.svg" alt="" width={100} height={120} /></span>
      <p className="ai-listening-title">Listening</p>
      <p className="t-body-s c-2">Talk like you would to a friend.</p>
    </div>
  );
}

/* AI2's bar: the dot and the clock, the live bars, "Slide left to cancel",
   the held mic with its pulse and the lock above it. Hold to talk and let go
   to send; slide left to cancel, slide up to lock; a tap records hands-free
   and the next tap sends. */
export function RecordingBar({ secs, live, locked, drag, onSend, onCancel }: {
  secs: number; live: number[]; locked: boolean; drag: { x: number; y: number }; onSend: () => void; onCancel: () => void;
}) {
  const levels = [...Array.from({ length: Math.max(0, 34 - live.length) }, () => 0.12), ...live];
  // The tap that started a hands-free recording must not also send it.
  const born = useRef(0);
  useEffect(() => { born.current = Date.now(); }, []);
  const send = () => { if (Date.now() - born.current > 500) onSend(); };
  return (
    <div className="ai-rec" role="group" aria-label="Recording">
      {!locked && (
        <span className="ai-rec-lock" aria-hidden style={{ translate: `0 ${Math.max(-40, Math.min(0, drag.y)) / 2}px` }}>
          <Icon name="ai/chevron-down" size={20} className="ai-rec-up" />
          <Icon name="ai/lock" size={24} />
        </span>
      )}
      <div className="ai-rec-left" style={{ translate: `${Math.min(0, drag.x)}px 0`, opacity: 1 + Math.min(0, drag.x) / 160 }}>
        <span className="ai-rec-dot" aria-hidden />
        <span className="ai-rec-time" aria-label={`${secs} seconds`}>{fmtSecs(secs)}</span>
        <span className="ai-rec-mid">
          <Waveform levels={levels} className="ai-rec-wave" />
          {locked
            ? <button type="button" className="ai-rec-cancel" onClick={onCancel}>Slide left to cancel</button>
            : <span className="ai-rec-cancel">Slide left to cancel</span>}
        </span>
      </div>
      <button type="button" className="ai-rec-mic" aria-label={locked ? 'Send voice note' : 'Recording, let go to send'}
              onClick={locked ? send : undefined}>
        <span className="ai-rec-pulse" aria-hidden />
        <Icon name="ai/mic" size={32} />
      </button>
    </div>
  );
}
