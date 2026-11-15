'use client';

import '@/styles/system.css';
import { useEffect, useState } from 'react';

/* Splash, S16–S18: the app icon (S16), Mylo pops out of it (S17), then Mylo
   winks over a loading bar and a tip (S18) until the app is ready, and the
   whole thing fades.

   <Splash ready={bool} progress?={0..1} tip?="…" />

   Mount it over the app while it starts (e.g. until the store hydrates or
   the session resolves); set `ready` and it fades after the pop has played.
   Without `progress` the bar runs on its own. */
const TIP = 'Tip: hold a goal to move it to tomorrow.';

export default function Splash({ ready, progress, tip = TIP }: { ready: boolean; progress?: number; tip?: string }) {
  const [phase, setPhase] = useState<'icon' | 'pop' | 'loading' | 'gone'>('icon');
  useEffect(() => {
    const a = setTimeout(() => setPhase(p => (p === 'icon' ? 'pop' : p)), 450);
    const b = setTimeout(() => setPhase(p => (p === 'pop' ? 'loading' : p)), 1250);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  const leaving = ready && phase !== 'icon' && phase !== 'pop';
  useEffect(() => {
    if (!leaving) return;
    const t = setTimeout(() => setPhase('gone'), 380);
    return () => clearTimeout(t);
  }, [leaving]);
  if (phase === 'gone') return null;

  return (
    <div className={`splash is-${phase}${leaving ? ' is-out' : ''}`} role="status" aria-label="Mylo is loading" aria-busy={!ready}>
      <img className="splash-icon" src="/brand/mylo-logo-512.webp" alt="" />
      <img className="splash-pop" src="/figma/system/splash-pop.svg" alt="" />
      <div className="splash-load">
        <img className="splash-mylo" src="/figma/system/splash-mylo.svg" alt="" />
        <p className="splash-name">Mylo</p>
        <span className="splash-track">
          <span className={`splash-fill${progress === undefined ? ' is-indeterminate' : ''}`}
                style={progress === undefined ? undefined : { width: `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%` }} />
        </span>
      </div>
      <p className="splash-tip">{tip}</p>
    </div>
  );
}
