'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

/* Voice for Mylo AI (AI2 to AI4): the browser's own speech recognition turns
   what the person says into text; where the browser has none, `supported`
   stays false and the mic is not offered. The recording itself is kept only
   for playback in this visit, and the bars come from the real mic level. */

type SRAlt = { transcript: string };
type SRResult = { isFinal: boolean; 0: SRAlt; length: number };
type SREvent = { resultIndex: number; results: { length: number; [i: number]: SRResult } };
type SRErr = { error: string };
type SR = {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: SREvent) => void) | null; onerror: ((e: SRErr) => void) | null; onend: (() => void) | null;
  start: () => void; stop: () => void; abort: () => void;
};
type SRCtor = new () => SR;
const ctor = (): SRCtor | null => {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SRCtor; webkitSpeechRecognition?: SRCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const noop = () => () => {};
export const useVoiceSupported = () => useSyncExternalStore(noop, () => !!ctor(), () => false);

export type VoiceResult = { text: string; secs: number; bars: number[]; audio?: string };
export type VoiceFail = 'blocked' | 'nomic' | 'network' | 'empty';
type Phase = 'idle' | 'recording' | 'stopping';

/* 24 bars for the voice note, from every level heard. */
export function bars(levels: number[], n = 24) {
  if (!levels.length) return Array.from({ length: n }, () => 0.25);
  return Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * levels.length) / n), b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / n));
    const slice = levels.slice(a, b);
    return Math.max(0.2, Math.min(1, slice.reduce((s, v) => s + v, 0) / slice.length));
  });
}

export function useVoice({ onDone, onFail }: { onDone: (r: VoiceResult) => void; onFail: (f: VoiceFail) => void }) {
  const [state, setState] = useState<'idle' | 'recording' | 'transcribing'>('idle');
  const [secs, setSecs] = useState(0);
  const [live, setLive] = useState<number[]>([]);
  const r = useRef({
    phase: 'idle' as Phase, rec: null as SR | null, kept: '', session: '', started: 0,
    levels: [] as number[], timer: 0 as ReturnType<typeof setInterval> | 0, raf: 0,
    stream: null as MediaStream | null, ctx: null as AudioContext | null, recorder: null as MediaRecorder | null,
    chunks: [] as Blob[], analysed: false, lastLen: 0, endWait: null as (() => void) | null
  });
  const cb = useRef({ onDone, onFail });
  useEffect(() => { cb.current = { onDone, onFail }; });

  const cleanup = useCallback(() => {
    const s = r.current;
    if (s.timer) clearInterval(s.timer);
    cancelAnimationFrame(s.raf);
    s.timer = 0;
    s.stream?.getTracks().forEach(t => t.stop());
    s.ctx?.close().catch(() => {});
    s.stream = null; s.ctx = null; s.rec = null;
  }, []);

  const fail = useCallback((f: VoiceFail) => {
    const s = r.current;
    s.phase = 'idle';
    try { s.rec?.abort(); } catch { /* already stopped */ }
    try { if (s.recorder?.state === 'recording') s.recorder.stop(); } catch { /* ignore */ }
    cleanup(); setState('idle'); cb.current.onFail(f);
  }, [cleanup]);

  const start = useCallback(() => {
    const C = ctor();
    const s = r.current;
    if (!C || s.phase !== 'idle') return;
    Object.assign(s, { phase: 'recording', kept: '', session: '', levels: [], chunks: [], analysed: false, lastLen: 0, started: Date.now(), recorder: null });
    setSecs(0); setLive([]); setState('recording');

    const rec = new C();
    rec.lang = navigator.language || 'en-GB';
    rec.interimResults = true;
    // Android's recogniser repeats itself in continuous mode, so there it
    // listens phrase by phrase and restarts until the person stops.
    const android = /Android/i.test(navigator.userAgent);
    rec.continuous = !android;
    rec.onresult = e => {
      const all = Array.from({ length: e.results.length }, (_, i) => e.results[i][0].transcript).join(' ');
      s.session = all.replace(/\s+/g, ' ').trim();
      if (!s.analysed) {
        // No mic level to read: the bars follow the words as they arrive.
        const grew = Math.max(0, (s.kept.length + s.session.length) - s.lastLen);
        s.lastLen = s.kept.length + s.session.length;
        s.levels.push(Math.min(1, 0.3 + grew / 18));
      }
    };
    rec.onerror = e => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fail('blocked');
      else if (e.error === 'audio-capture') fail('nomic');
      else if (e.error === 'network') fail('network');
      // 'no-speech' and 'aborted' end the session; onend decides what next.
    };
    rec.onend = () => {
      if (s.phase === 'recording') {
        s.kept = `${s.kept} ${s.session}`.trim(); s.session = '';
        try { rec.start(); } catch { /* the browser will not restart; stop cleanly */ s.endWait?.(); }
      } else s.endWait?.();
    };
    s.rec = rec;
    try { rec.start(); } catch { fail('nomic'); return; }

    s.timer = setInterval(() => {
      setSecs(Math.floor((Date.now() - s.started) / 1000));
      setLive(s.levels.slice(-34));
      if (!s.analysed && s.levels.length < 400) s.levels.push(0.15);
    }, 150);

    // The real mic level and a copy to play back, where the browser lets
    // both run beside recognition (not on Android, where they fight).
    if (!android && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
        if (s.phase !== 'recording') { stream.getTracks().forEach(t => t.stop()); return; }
        s.stream = stream;
        try {
          const ctx = new AudioContext();
          const an = ctx.createAnalyser(); an.fftSize = 512;
          ctx.createMediaStreamSource(stream).connect(an);
          s.ctx = ctx; s.analysed = true; s.levels = [];
          const buf = new Uint8Array(an.fftSize);
          let last = 0;
          const loop = (t: number) => {
            if (t - last > 120) {
              last = t;
              an.getByteTimeDomainData(buf);
              let sum = 0; for (const v of buf) sum += ((v - 128) / 128) ** 2;
              s.levels.push(Math.min(1, Math.sqrt(sum / buf.length) * 5));
            }
            s.raf = requestAnimationFrame(loop);
          };
          s.raf = requestAnimationFrame(loop);
        } catch { /* no level, the words drive the bars */ }
        try {
          const recorder = new MediaRecorder(stream);
          recorder.ondataavailable = ev => { if (ev.data.size) s.chunks.push(ev.data); };
          recorder.start();
          s.recorder = recorder;
        } catch { /* no playback copy */ }
      }).catch(() => { /* recognition still runs */ });
    }
  }, [fail]);

  const stop = useCallback(async () => {
    const s = r.current;
    if (s.phase !== 'recording') return;
    s.phase = 'stopping';
    const took = Math.max(1, Math.round((Date.now() - s.started) / 1000));
    const heard = bars(s.levels);
    setState('transcribing');
    if (s.timer) clearInterval(s.timer); s.timer = 0;
    cancelAnimationFrame(s.raf);

    const ended = new Promise<void>(res => { s.endWait = res; setTimeout(res, 5000); });
    const saved = new Promise<string | undefined>(res => {
      const rc = s.recorder;
      if (!rc || rc.state !== 'recording') return res(undefined);
      rc.onstop = () => res(s.chunks.length ? URL.createObjectURL(new Blob(s.chunks, { type: rc.mimeType || 'audio/webm' })) : undefined);
      try { rc.stop(); } catch { res(undefined); }
      setTimeout(() => res(undefined), 3000);
    });
    try { s.rec?.stop(); } catch { s.endWait?.(); }
    const [, audio] = await Promise.all([ended, saved]);
    if (s.phase !== 'stopping') return; // cancelled meanwhile
    const text = `${s.kept} ${s.session}`.replace(/\s+/g, ' ').trim();
    s.phase = 'idle'; s.endWait = null;
    cleanup(); setState('idle');
    if (!text) { cb.current.onFail('empty'); return; }
    cb.current.onDone({ text, secs: took, bars: heard, audio });
  }, [cleanup]);

  const cancel = useCallback(() => {
    const s = r.current;
    if (s.phase === 'idle') return;
    s.phase = 'idle';
    try { s.rec?.abort(); } catch { /* ignore */ }
    try { if (s.recorder?.state === 'recording') s.recorder.stop(); } catch { /* ignore */ }
    s.endWait?.(); s.endWait = null;
    cleanup(); setState('idle');
  }, [cleanup]);

  useEffect(() => () => { r.current.phase = 'idle'; try { r.current.rec?.abort(); } catch { /* ignore */ } cleanup(); }, [cleanup]);

  return { state, secs, live, start, stop, cancel };
}
