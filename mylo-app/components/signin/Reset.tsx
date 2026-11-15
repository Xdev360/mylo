'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { stampNav } from '@/components/NavMotion';
import Icon from '@/components/Icon';
import { useSession } from '@/lib/session';
import { authMessage } from '@/lib/signin';
import { supabase } from '@/lib/supabase';
import { Art, BackButton, Cta, Foot, Notice, Screen } from './ui';

/* A5 Reset password (365:55181). The reset email links here; Supabase reads
   the link and signs the person in for this one change. */
export default function Reset() {
  const router = useRouter();
  const { profile, session, loading } = useSession();
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const second = useRef<HTMLInputElement>(null);
  const username = String(profile?.username ?? '').toLowerCase();
  const ok = pass.length >= 8 && (!username || pass.toLowerCase() !== username);

  const save = async () => {
    if (busy) return;
    if (!ok) { setError(pass.length < 8 ? 'Password needs 8+ characters' : 'Pick something other than your username'); return; }
    if (again !== pass) { setError('The two passwords do not match'); return; }
    setBusy(true); setError('');
    try {
      const { error: e } = await supabase().auth.updateUser({ password: pass });
      if (e) throw e;
      stampNav('tab');
      router.replace('/today');
    } catch (e) { setBusy(false); setError(authMessage(e)); }
  };

  return (
    <Screen className="si-reset">
      <header className="si-topbar">
        <BackButton fallback="/signin" />
        <h1 className="si-topbar-title">Reset password</h1>
        <span className="si-topbar-gap" />
      </header>
      <p className="si-says">
        <Art name="mylo-says" w={32} h={40} className="si-says-mylo" />
        <span className="si-bubble">right. pick a new one and we’re back in.</span>
      </p>
      <form id="si-reset" className="si-reset-form" onSubmit={e => { e.preventDefault(); save(); }}>
        <label className="si-input">
          <span>New password</span>
          <input type="password" autoComplete="new-password" value={pass} onChange={e => { setPass(e.target.value); setError(''); }} autoFocus enterKeyHint="next"
                 onKeyDown={e => { if (e.key === 'Enter' && !again) { e.preventDefault(); second.current?.focus(); } }} />
        </label>
        <label className="si-input">
          <span>Confirm new password</span>
          <input ref={second} type="password" autoComplete="new-password" placeholder="type it again" value={again} onChange={e => { setAgain(e.target.value); setError(''); }} enterKeyHint="go" />
        </label>
        <p className={`si-rule${ok ? ' is-ok' : ''}`}><Icon name="signin/i-circle-check" size={18} />8+ characters · not your username</p>
        <Notice text={error} />
        {/* Opened without the email's link: say how to get one, rather than fail on Save. */}
        {!loading && !session && !error && (
          <p className="si-notice is-info">This page works from the link in your reset email. <Link href="/signin" className="c-ink si-reset-link">Get a new link</Link></p>
        )}
      </form>
      <Foot>
        <Cta type="submit" form="si-reset" busy={busy}>Set new password</Cta>
      </Foot>
    </Screen>
  );
}
