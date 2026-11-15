'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { Page, useNeedsAccount } from './SettingsPages';

/* ST7 · Change email (and the same form for the phone number), ST8 · Change
   password. Both act on the signed-in Supabase account; with no session they
   send the person to /signin. */

function message(e: unknown) {
  return (e as { message?: string })?.message || 'Something went wrong. Try again.';
}

/* ST7. Send code → Supabase mails (or texts) a 6 digit code to the new
   address; entering it confirms the change with verifyOtp. */
export function ChangeContact({ mode }: { mode: 'email' | 'phone' }) {
  const router = useRouter();
  const { user } = useNeedsAccount();
  const [next, setNext] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const email = mode === 'email';
  const current = email ? user?.email ?? '' : user?.phone ? `+${user.phone.replace(/^\+/, '')}` : '';
  const valid = email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next.trim()) : /^\+?[0-9 ()-]{7,}$/.test(next.trim());
  const clean = email ? next.trim().toLowerCase() : `+${next.replace(/[^0-9]/g, '')}`;

  const send = async () => {
    setBusy(true); setErr('');
    try {
      const { error } = await supabase().auth.updateUser(email ? { email: clean } : { phone: clean });
      if (error) throw error;
      setSent(true);
    } catch (e) { setErr(message(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr('');
    try {
      const { error } = email
        ? await supabase().auth.verifyOtp({ email: clean, token: code.trim(), type: 'email_change' })
        : await supabase().auth.verifyOtp({ phone: clean, token: code.trim(), type: 'phone_change' });
      if (error) throw error;
      router.push('/settings');
    } catch (e) { setErr(message(e)); } finally { setBusy(false); }
  };

  return (
    <Page title={email ? 'Change email' : 'Phone number'}>
      <form className="sys-form" style={{ display: 'contents' }} onSubmit={e => { e.preventDefault(); if (sent) { if (code.trim().length >= 6) void verify(); } else if (valid) void send(); }}>
        {current && (
          <>
            <label className="sys-field-label" htmlFor="sys-current">{email ? 'Current email' : 'Current phone number'}</label>
            <div className="sys-input is-read"><input id="sys-current" value={current} readOnly tabIndex={-1} /></div>
          </>
        )}
        <label className="sys-field-label" htmlFor="sys-next">{email ? 'New email' : 'New phone number'}</label>
        <div className="sys-input">
          <input id="sys-next" type={email ? 'email' : 'tel'} inputMode={email ? 'email' : 'tel'} autoComplete={email ? 'email' : 'tel'}
                 value={next} onChange={e => { setNext(e.target.value); setSent(false); setCode(''); }} autoFocus />
        </div>
        <p className="sys-hint">We will send a 6 digit code to check it is yours.</p>
        {sent && (
          <>
            <label className="sys-field-label" htmlFor="sys-code">Code</label>
            <div className="sys-input">
              <input id="sys-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code}
                     onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
          </>
        )}
        {err && <p className="sys-error" role="alert">{err}</p>}
        <div className="sys-actions">
          {sent
            ? <button type="submit" className="sys-btn" disabled={busy || code.trim().length < 6}>Confirm</button>
            : <button type="submit" className="sys-btn" disabled={busy || !valid}>Send code</button>}
        </div>
      </form>
    </Page>
  );
}

/* Strength: four bars, as ST8 draws them. */
function strength(p: string) {
  if (!p) return 0;
  let s = p.length >= 8 ? 1 : 0;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  return Math.max(p.length >= 6 ? 1 : 0, s);
}
const LEVELS = [
  { label: '', color: 'var(--line)' },
  { label: 'Weak.', color: 'var(--red)' },
  { label: 'Okay.', color: 'var(--amber)' },
  { label: 'Strong. Nice.', color: 'var(--green)' },
  { label: 'Strong. Nice.', color: 'var(--green)' }
];

function Secret({ id, label, value, onChange, autoComplete, focus }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; focus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="sys-field-label" htmlFor={id}>{label}</label>
      <div className="sys-input">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} autoFocus={focus} />
        <button type="button" className="sys-eye" aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show} onClick={() => setShow(s => !s)}>
          <Icon name="system/eye" size={24} />
        </button>
      </div>
    </>
  );
}

/* ST8. Checks the current password by signing in with it, then sets the new one. */
export function ChangePassword() {
  const router = useRouter();
  const { user } = useNeedsAccount();
  const [cur, setCur] = useState('');
  const [pw, setPw] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const s = strength(pw);
  const mismatch = again.length > 0 && again !== pw;
  const ok = cur.length > 0 && pw.length >= 8 && again === pw;

  const save = async () => {
    if (!user?.email) return;
    setBusy(true); setErr('');
    try {
      const sb = supabase();
      const check = await sb.auth.signInWithPassword({ email: user.email, password: cur });
      if (check.error) throw new Error('That current password is not right.');
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      router.push('/settings');
    } catch (e) { setErr(message(e)); } finally { setBusy(false); }
  };

  return (
    <Page title="Change password">
      <form style={{ display: 'contents' }} onSubmit={e => { e.preventDefault(); if (ok) void save(); }}>
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <Secret id="sys-cur" label="Current password" value={cur} onChange={setCur} autoComplete="current-password" focus />
        <Secret id="sys-new" label="New password" value={pw} onChange={setPw} autoComplete="new-password" />
        <div className="sys-strength" aria-hidden>
          {[1, 2, 3, 4].map(i => <span key={i} style={i <= s ? { background: LEVELS[s].color } : undefined} />)}
        </div>
        {pw && <p className="sys-strength-label" style={{ color: LEVELS[s].color }} aria-live="polite">{LEVELS[s].label}</p>}
        <Secret id="sys-again" label="Confirm new password" value={again} onChange={setAgain} autoComplete="new-password" />
        {mismatch && <p className="sys-error" role="alert">These do not match yet.</p>}
        {err && <p className="sys-error" role="alert">{err}</p>}
        <p className="sys-hint" style={{ marginTop: 26 }}>Forgot it? Log out and use <Link href="/reset">Reset password</Link>.</p>
        <div className="sys-actions">
          <button type="submit" className="sys-btn" disabled={busy || !ok}>Save password</button>
        </div>
      </form>
    </Page>
  );
}
