'use client';

import '@/styles/system.css';
import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { haptic } from '@/lib/system';

/* PullToRefresh, S12–S15. Wrap the top of a screen's content: pull down from
   the very top and Mylo peeks out (S12), pull far enough and he says
   "Release to refresh" (S13), let go and he hops while "Getting the latest"
   (S14), then an "Up to date" toast drops in (S15). Touch only; a mouse or
   keyboard never triggers it.

   <PullToRefresh onRefresh={async () => { await reload(); }} disabled?={bool}>
     …screen content…
   </PullToRefresh>

   Place it as a direct child of `.screen` (it bleeds its grey area 20px to
   each side). `onRefresh` may return a promise; the hop lasts until it
   settles, and at least 600ms so it reads. */
const READY = 96;
const HOLD = 100;

export default function PullToRefresh({ onRefresh, disabled = false, children }: {
  onRefresh: () => void | Promise<unknown>; disabled?: boolean; children: React.ReactNode;
}) {
  const [pull, setPull] = useState(0);
  const [phase, setPhase] = useState<'idle' | 'pulling' | 'refreshing'>('idle');
  const [toast, setToast] = useState(0);
  const start = useRef<number | null>(null);
  const armed = useRef(false);

  const onStart = (e: React.TouchEvent) => {
    if (disabled || phase === 'refreshing' || window.scrollY > 0) return;
    start.current = e.touches[0].clientY;
  };
  const onMove = (e: React.TouchEvent) => {
    if (start.current === null) return;
    const dy = e.touches[0].clientY - start.current;
    if (dy <= 0) { setPull(0); return; }
    const d = Math.min(150, dy * 0.5);
    if (d >= READY && !armed.current) { armed.current = true; haptic(8); }
    if (d < READY) armed.current = false;
    setPhase('pulling'); setPull(d);
  };
  const onEnd = async () => {
    if (start.current === null) return;
    start.current = null;
    if (pull < READY) { setPhase('idle'); setPull(0); return; }
    armed.current = false;
    setPhase('refreshing'); setPull(HOLD);
    const t = Date.now();
    try { await onRefresh(); } catch { /* the screen shows its own error */ }
    await new Promise(r => setTimeout(r, Math.max(0, 600 - (Date.now() - t))));
    setPhase('idle'); setPull(0); setToast(n => n + 1);
  };

  const ready = phase === 'pulling' && pull >= READY;
  const small = phase === 'pulling' && pull < 60;
  const size = phase === 'refreshing' ? [52, 62] : ready ? [58, 70] : small ? [33, 40] : [44, 53];
  const mylo = phase === 'refreshing' ? 'mylo-pull-refresh' : ready ? 'mylo-pull-ready' : 'mylo-pull-start';

  return (
    <div className={`ptr${phase === 'pulling' ? '' : ' is-settling'}${phase === 'refreshing' ? ' is-refreshing' : ''}`}
         onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}>
      <div className="ptr-area" style={{ height: pull }} aria-hidden={phase === 'idle'}>
        <img className="ptr-mylo" src={`/figma/system/${mylo}.svg`} alt="" width={size[0]} height={size[1]}
             style={small ? { marginBottom: -Math.max(0, 40 - pull * 0.8) } : undefined} />
        {(ready || phase === 'refreshing') && (
          <span className="ptr-text" role="status">{phase === 'refreshing' ? 'Getting the latest' : 'Release to refresh'}</span>
        )}
        {phase === 'refreshing' && <span className="ptr-shadow" />}
      </div>
      {children}
      {toast > 0 && (
        <div key={toast} className="ptr-toast" role="status" onAnimationEnd={() => setToast(0)}>
          <Icon name="system/check" size={20} />Up to date
        </div>
      )}
    </div>
  );
}
