'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { SUPPORT_EMAIL, clearDevice, go, leave, useSession } from '@/lib/system';
import { Page } from './SettingsPages';
import { Hero } from './ui';

/* Delete account, two steps then done: ST10 warning → ST11 type DELETE →
   ST12 deleted. Nothing is removed before "Delete forever" with DELETE typed.

   Signed in: calls the Supabase function `request_account_deletion(reason)`
   (30 day grace, then the server removes everything). The current backend
   does not have it yet, so until it ships the call fails and its error is
   shown; nothing on the device is touched. No account (device only): the
   account is this device, so "Delete forever" clears every `mylo.*` key. */

/* ST10 */
export function DeleteWarning() {
  const router = useRouter();
  return (
    <Page>
      <div className="sys-state">
        <Hero tone="red" mylo="mylo-sad" size="s" />
        <h1 className="sys-state-title" style={{ marginTop: 22 }}>Delete your account?</h1>
        <p className="sys-state-body">This removes everything. Your friends will see a blank space where you were.</p>
        <ul className="sys-lose">
          <li><Icon name="system/goals" size={24} />Every goal and streak</li>
          <li><Icon name="system/room" size={24} />Your room, Mylo looks and cards</li>
          <li><Icon name="system/chat" size={24} />Your messages in every room</li>
          <li><Icon name="system/key" size={24} />Keys, chests and rewards</li>
        </ul>
      </div>
      <div className="sys-actions">
        <Link href="/settings/delete-confirm" className="sys-btn is-danger">Continue</Link>
        {/* Back where they came from (Settings, or Your data), not a new copy of it. */}
        <button type="button" className="sys-btn is-soft" onClick={() => leave(router, '/settings')}>Keep my account</button>
      </div>
    </Page>
  );
}

const REASONS = ['Too many notifications', 'Not using it', 'Privacy', 'Found something else', 'Other'];

/* ST11 */
export function DeleteConfirm() {
  const { ready, user } = useSession();
  const [reason, setReason] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const armed = typed.trim() === 'DELETE';

  const remove = async () => {
    if (!armed || !ready || busy) return;
    setBusy(true); setErr('');
    try {
      if (user) {
        const sb = supabase();
        const { error } = await sb.rpc('request_account_deletion', { reason });
        if (error) throw error;
        await sb.auth.signOut();
      }
      clearDevice();
      try { sessionStorage.clear(); } catch { /* blocked */ }
      // A full load, so nothing still held in memory writes back.
      window.location.replace('/settings/deleted');
    } catch (e) {
      const m = (e as { message?: string; code?: string })?.message || '';
      const code = (e as { code?: string })?.code;
      /* The server function is not there yet: say so plainly, and how to get it done. */
      setErr(code === 'PGRST202' || /request_account_deletion|schema cache|not find the function/i.test(m)
        ? `Deleting accounts from the app is not switched on yet. Email ${SUPPORT_EMAIL} and we will do it for you. Nothing was deleted.`
        : /fetch|network/i.test(m) ? 'No connection. Nothing was deleted. Try again when you are back online.'
        : `${m || 'Something went wrong.'} Nothing was deleted.`);
      setBusy(false);
    }
  };

  return (
    <Page title="Delete account">
      <h2 className="sys-h2">Why are you leaving?</h2>
      <p className="sys-hint" style={{ marginTop: 6 }}>Optional. It helps us get better.</p>
      <div className="sys-reasons">
        {REASONS.map(r => (
          <button key={r} type="button" className="sys-reason" aria-pressed={reason === r} onClick={() => setReason(reason === r ? null : r)}>{r}</button>
        ))}
      </div>
      <label className="sys-field-label" htmlFor="sys-delete" style={{ marginTop: 32 }}>Type DELETE to confirm</label>
      <div className={`sys-input${typed ? ' is-danger' : ''}`}>
        <input id="sys-delete" value={typed} onChange={e => setTyped(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" spellCheck={false}
               enterKeyHint="done" onKeyDown={e => { if (e.key === 'Enter') void remove(); }} aria-describedby="sys-delete-why" />
      </div>
      <p className="sys-grace" id="sys-delete-why"><Icon name="system/time" size={24} />You have 30 days to change your mind. Log in to cancel.</p>
      {err && <p className="sys-error" role="alert">{err}</p>}
      <div className="sys-actions">
        <button type="button" className="sys-btn is-danger" disabled={!armed || busy || !ready} aria-busy={busy} onClick={remove}>Delete forever</button>
      </div>
    </Page>
  );
}

/* ST12 */
export function Deleted() {
  const router = useRouter();
  return (
    <main className="screen on-desk sys-screen">
      <div className="sys-state" style={{ paddingTop: 116 }}>
        <div className="sys-sticker"><img src="/figma/system/sticker-hi.svg" alt="" /></div>
        <h1 className="sys-state-title" style={{ marginTop: 17 }}>Your account is deleted</h1>
        <p className="sys-state-body">Thanks for the time with Mylo. If you change your mind in 30 days, just log in.</p>
      </div>
      <div className="sys-actions">
        <button type="button" className="sys-btn is-soft" onClick={() => go(router, '/welcome', 'tab', true)}>Close</button>
      </div>
    </main>
  );
}
