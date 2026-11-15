'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { RIcon } from './ui';
import { Waveform, nameTone } from './Bubble';
import { ME, type Message, type Room } from '@/lib/rooms';

/* The composer, CT1 / CT17, and the voice note states CT2 to CT4. Type and
   the mic becomes send. Hold the mic to record (a real recording, through
   the microphone): slide left to cancel, slide up to lock. Locked, you can
   bin it, pause to listen back (CT4) or send. Let go unlocked and it sends. */

type Phase = 'idle' | 'hold' | 'locked' | 'preview';
type Rec = { mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; ctx: AudioContext; an: AnalyserNode; tick: ReturnType<typeof setInterval>; start: number };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Composer({ room, reply, editing, desk, onCancel, onSend, onSave, onAdd, onSticker, onVoice, onHint }: {
  room: Room; reply?: Message; editing?: Message; desk?: boolean;
  onCancel: () => void; onSend: (text: string) => void; onSave: (text: string) => void;
  onAdd: (el: HTMLElement) => void; onSticker: () => void;
  onVoice: (blob: Blob, seconds: number, bars: number[]) => void; onHint: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [secs, setSecs] = useState(0);
  const [bars, setBars] = useState<number[]>([]);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [take, setTake] = useState<{ blob: Blob; url: string; seconds: number; bars: number[] } | null>(null);
  const [listen, setListen] = useState({ t: 0, on: false });
  const input = useRef<HTMLTextAreaElement>(null);
  const rec = useRef<Rec | null>(null);
  const pending = useRef<'none' | 'starting' | 'cancelled'>('none');
  const from = useRef({ x: 0, y: 0, at: 0 });
  const audio = useRef<HTMLAudioElement | null>(null);

  const [seen, setSeen] = useState<string | undefined>(undefined);
  if (editing?.id !== seen) { setSeen(editing?.id); if (editing) setText(editing.text ?? ''); }
  useEffect(() => { if (editing) input.current?.focus(); }, [editing]);
  useEffect(() => { if (reply) input.current?.focus(); }, [reply]);
  useEffect(() => () => { stopAll(); }, []);
  // Grow with the text, up to five lines, then scroll inside.
  useLayoutEffect(() => {
    const t = input.current; if (!t) return;
    t.style.height = '';
    if (t.scrollHeight > t.clientHeight + 1) t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  }, [text, phase]);

  function stopAll() {
    const r = rec.current; if (!r) return;
    clearInterval(r.tick);
    r.stream.getTracks().forEach(t => t.stop());
    r.ctx.close().catch(() => {});
    rec.current = null;
  }

  async function begin() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') { onHint('This browser cannot record voice notes.'); return; }
    pending.current = 'starting';
    let stream: MediaStream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { pending.current = 'none'; setPhase('idle'); onHint('Allow the microphone to send voice notes.'); return; }
    if ((pending.current as string) === 'cancelled') { stream.getTracks().forEach(t => t.stop()); pending.current = 'none'; return; }
    pending.current = 'none';
    const ctx = new AudioContext();
    const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const mr = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    mr.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    mr.start();
    const start = Date.now();
    const tick = setInterval(() => {
      an.getByteTimeDomainData(buf);
      let peak = 0; for (const v of buf) peak = Math.max(peak, Math.abs(v - 128));
      const level = Math.min(1, peak / 64);
      setBars(b => [...b, level]);
      setSecs((Date.now() - start) / 1000);
    }, 100);
    rec.current = { mr, stream, chunks, ctx, an, tick, start };
    from.current.at = start;
  }

  function finish(): Promise<{ blob: Blob; seconds: number } | null> {
    const r = rec.current;
    if (!r) return Promise.resolve(null);
    const seconds = (Date.now() - r.start) / 1000;
    return new Promise(res => {
      r.mr.onstop = () => { const blob = new Blob(r.chunks, { type: r.mr.mimeType || 'audio/webm' }); stopAll(); res({ blob, seconds }); };
      r.mr.stop();
    });
  }

  function reset() { setPhase('idle'); setSecs(0); setBars([]); setDrag({ x: 0, y: 0 }); setListen({ t: 0, on: false }); audio.current?.pause(); if (take) URL.revokeObjectURL(take.url); setTake(null); }
  function cancel() { if (pending.current === 'starting') pending.current = 'cancelled'; const r = rec.current; if (r) { r.mr.onstop = null; try { r.mr.stop(); } catch { /* stopped */ } stopAll(); } reset(); }
  async function sendNow() { const got = await finish(); const b = bars; reset(); if (got && got.seconds >= 0.5) onVoice(got.blob, got.seconds, b); }
  async function pause() { const got = await finish(); if (!got) { reset(); return; } setTake({ ...got, url: URL.createObjectURL(got.blob), bars }); setPhase('preview'); }
  function sendTake() { if (take) onVoice(take.blob, take.seconds, take.bars); reset(); }

  const micDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    from.current = { x: e.clientX, y: e.clientY, at: Date.now() };
    setPhase('hold'); setSecs(0); setBars([]);
    begin();
  };
  const micMove = (e: React.PointerEvent) => {
    if (phase !== 'hold') return;
    const x = Math.min(0, e.clientX - from.current.x), y = Math.min(0, e.clientY - from.current.y);
    setDrag({ x, y });
    if (x < -110) cancel();
    else if (y < -70) { setPhase('locked'); setDrag({ x: 0, y: 0 }); }
  };
  const micUp = () => {
    if (phase !== 'hold') return;
    if (Date.now() - from.current.at < 400 || !rec.current) { cancel(); onHint('Hold to talk. Slide up to lock.'); return; }
    sendNow();
  };

  function submit() {
    const t = text.trim(); if (!t) return;
    if (editing) onSave(t); else onSend(t);
    setText('');
  }

  const typing = text.trim().length > 0 || !!editing;
  const bar = (reply || editing) && phase === 'idle' && (
    <div className="r-replybar" style={{ '--q': editing ? 'var(--ink)' : reply!.authorId === ME ? 'var(--ink)' : nameTone(reply!.authorName) } as React.CSSProperties}>
      <span className="r-replybar-accent" />
      <span className="r-replybar-text">
        <span className="r-replybar-who">{editing ? 'Edit' : `Replying to ${reply!.authorId === ME ? 'You' : reply!.authorName}`}</span>
        <span className="r-replybar-line">{(editing ?? reply)!.text ?? (reply?.kind === 'voice' ? 'Voice note' : reply?.kind === 'poll' ? reply.poll!.question : reply?.kind === 'photo' ? 'Photo' : reply?.kind === 'cheer' ? 'Cheer card' : 'Sticker')}</span>
      </span>
      <button type="button" className="round-btn r-close-btn" aria-label="Close" onClick={() => { onCancel(); if (editing) setText(''); }}><RIcon name="close-np" size={20} /></button>
    </div>
  );

  if (phase === 'locked' || phase === 'preview') {
    const dur = take?.seconds ?? secs;
    return (
      <div className={`r-composer is-tall${desk ? ' is-desk' : ''}`}>
        {phase === 'locked' ? (
          <div className="r-rec-row">
            <span className="r-rec-dot" /><span className="r-rec-time">{fmt(secs)}</span>
            <Waveform bars={bars.slice(-54)} count={54} done={1} className="is-live" />
          </div>
        ) : (
          <div className="r-rec-row">
            <button type="button" className="r-rec-play" aria-label={listen.on ? 'Pause' : 'Play'} onClick={() => {
              const a = audio.current!; if (listen.on) a.pause(); else a.play();
            }}><RIcon name={listen.on ? 'pause' : 'play'} size={20} /></button>
            <Waveform bars={take!.bars} count={48} done={listen.t / dur} className="is-preview" />
            <span className="r-rec-of">{fmt(listen.t)} / {fmt(dur)}</span>
            <audio ref={audio} src={take!.url} onPlay={() => setListen(l => ({ ...l, on: true }))} onPause={() => setListen(l => ({ ...l, on: false }))}
                   onEnded={() => setListen({ t: 0, on: false })} onTimeUpdate={e => setListen(l => ({ ...l, t: e.currentTarget.currentTime }))} />
          </div>
        )}
        <div className="r-rec-actions">
          <button type="button" className="r-rec-btn" aria-label="Delete" onClick={cancel}><img src="/figma/rooms/trash.svg" alt="" width={24} height={24} /></button>
          {phase === 'locked'
            ? <button type="button" className="r-rec-btn" aria-label="Pause" onClick={pause}><RIcon name="pause" size={24} /></button>
            : <span className="r-rec-note">Listen before you send</span>}
          <button type="button" className="r-rec-btn is-send" aria-label="Send" onClick={phase === 'locked' ? sendNow : sendTake}><RIcon name="send" size={24} /></button>
        </div>
      </div>
    );
  }

  return (
    <>
      {bar}
      <div className={`r-composer${desk ? ' is-desk' : ''}${phase === 'hold' ? ' is-holding' : ''}`}>
        {phase === 'hold' ? (
          <div className="r-rec-row is-hold">
            <span className="r-rec-dot" /><span className="r-rec-time">{fmt(secs)}</span>
            <span className="r-rec-cancel" style={{ translate: `${drag.x}px 0` }}><RIcon name="slide-back" size={20} />Slide to cancel</span>
          </div>
        ) : <>
          <button type="button" className="r-add" aria-label="Add" onClick={e => onAdd(e.currentTarget)}><RIcon name="plus-24" size={24} /></button>
          <label className="r-input">
            <span className="sr-only">Message {room.name}</span>
            <textarea ref={input} rows={1} value={text} placeholder={`Message ${room.name}`} enterKeyHint="send" maxLength={4000}
                      onChange={e => setText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } if (e.key === 'Escape' && (reply || editing)) { onCancel(); setText(''); } }} />
            <button type="button" className="r-input-sticker" aria-label="Stickers" onClick={onSticker}><RIcon name="sticker" size={desk ? 20 : 24} /></button>
          </label>
        </>}
        {typing && phase === 'idle'
          ? <button key="send" type="button" className="r-mic is-send" aria-label={editing ? 'Save' : 'Send'}
                    onPointerDown={e => e.preventDefault()} onClick={submit}><RIcon name="send" size={24} /></button>
          : (
            <button key="mic" type="button" className={`r-mic${phase === 'hold' ? ' is-rec' : ''}`} aria-label="Hold to record a voice note"
                    onPointerDown={micDown} onPointerMove={micMove} onPointerUp={micUp} onPointerCancel={() => phase === 'hold' && cancel()}
                    onContextMenu={e => e.preventDefault()}
                    onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && phase === 'idle') { e.preventDefault(); setPhase('locked'); setSecs(0); setBars([]); begin(); } }}>
              <RIcon name="mic" size={24} />
            </button>
          )}
        {phase === 'hold' && <>
          <span className="r-rec-big" aria-hidden style={{ translate: `${drag.x}px ${drag.y}px` }}><RIcon name="mic" size={36} /></span>
          <span className="r-lock-hint" aria-hidden style={{ translate: `0 ${Math.max(-40, drag.y / 2)}px` }}><RIcon name="lock" size={24} /><RIcon name="chevron-24" size={24} className="r-up" /></span>
          <span className="r-chip-dark r-hold-chip" aria-hidden>Hold to talk. Slide up to lock.</span>
        </>}
      </div>
    </>
  );
}
