'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/Icon';
import OfflineBanner from './OfflineBanner';
import { Hero, type Tone } from './ui';

/* StatusScreen, the whole-screen states S27–S30. It covers the app (tab bar
   and sidebar too) until its button gets the person going again.

   <StatusScreen kind="offline" />       S27 · No connection, with the offline bar while offline
   <StatusScreen kind="error" code={503} onRetry? />   S28 · Something broke on our side (+ Report a bug)
   <StatusScreen kind="update" notes?={[…]} />         S29 · New Mylo is here (Update now)
   <StatusScreen kind="maintenance" onRetry? />        S30 · Mylo is getting a tune up (Check again)
   cover={false}   sit in the page flow instead of covering the screen

   Default buttons: offline checks the network for real and calls onRetry
   (or reloads) once it answers; error and maintenance call onRetry or reload;
   update asks the service worker for the new version, then reloads. */
export type StatusKind = 'offline' | 'error' | 'update' | 'maintenance';

const COPY: Record<StatusKind, { tone: Tone; mylo: string; badge: string; title: string; body: string; cta: string; refresh: boolean }> = {
  offline: { tone: 'grey', mylo: 'mylo-offline', badge: 'system/globe', title: 'No connection', body: 'Your goals still work offline. Ticks and posts will send when you are back.', cta: 'Try again', refresh: true },
  error: { tone: 'red', mylo: 'mylo-error', badge: 'system/alert', title: 'Something broke on our side', body: 'It is not you. We are on it. Try again in a minute.', cta: 'Try again', refresh: true },
  update: { tone: 'green', mylo: 'mylo-update', badge: 'system/download', title: 'New Mylo is here', body: 'This version is too old to keep your rooms in sync. The update takes a moment.', cta: 'Update now', refresh: false },
  maintenance: { tone: 'amber', mylo: 'mylo-maintenance', badge: 'system/settings', title: 'Mylo is getting a tune up', body: 'We will be back shortly. Your streak is paused, not lost.', cta: 'Check again', refresh: true }
};
const NOTES = ['New Vibe feed', 'Voice notes to Mylo', 'Room editor'];

async function reachable() {
  if (!navigator.onLine) return false;
  try { const r = await fetch(`/manifest.webmanifest?ping=${Date.now()}`, { cache: 'no-store' }); return r.ok; } catch { return false; }
}

export default function StatusScreen({ kind, code, notes = NOTES, onRetry, cover = true }: {
  kind: StatusKind; code?: number | string; notes?: string[]; onRetry?: () => void | Promise<unknown>; cover?: boolean;
}) {
  const c = COPY[kind];
  const [busy, setBusy] = useState(false);
  const [still, setStill] = useState(false);

  const act = async () => {
    setBusy(true); setStill(false);
    try {
      if (kind === 'offline' && !(await reachable())) { setStill(true); return; }
      if (kind === 'update') {
        const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined);
        await reg?.update().catch(() => {});
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
        return;
      }
      if (onRetry) await onRetry(); else window.location.reload();
    } finally { setBusy(false); }
  };

  const body = (
    <>
      {kind === 'offline' && <OfflineBanner />}
      <div className="sys-state">
        <Hero tone={c.tone} mylo={c.mylo} badge={c.badge} />
        <h1 className="sys-state-title">{c.title}</h1>
        <p className="sys-state-body">{c.body}</p>
        {kind === 'error' && code !== undefined && <span className="sys-code">Error code {code}</span>}
        {kind === 'update' && notes.length > 0 && (
          <ul className="sys-notes">{notes.map(n => <li key={n}><Icon name="system/check" size={20} />{n}</li>)}</ul>
        )}
        {still && <p className="sys-error" role="status">{COPY.offline.title}</p>}
      </div>
      <div className="sys-actions">
        <button type="button" className="sys-btn" onClick={act} disabled={busy} aria-busy={busy}>
          {c.refresh && <Icon name="system/refresh" size={22} />}{c.cta}
        </button>
        {kind === 'error' && <Link href="/report-a-bug" className="sys-btn is-soft">Report a bug</Link>}
      </div>
    </>
  );

  if (!cover) return <div className="sys-state-flow" style={{ display: 'contents' }}>{body}</div>;
  return (
    <div className="sys-cover" role="main" aria-label={c.title}>
      <div className="sys-cover-inner is-status" style={{ paddingTop: kind === 'offline' ? 'max(calc(env(safe-area-inset-top) + 116px), 128px)' : 'max(calc(env(safe-area-inset-top) + 96px), 108px)' }}>{body}</div>
    </div>
  );
}
