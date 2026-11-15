'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { supabase } from '@/lib/supabase';
import { flash, leave } from '@/lib/system';
import { Page, useNeedsAccount } from './SettingsPages';

/* ST7 · Change email (and the same form for the phone number), ST8 · Change
   password. Both act on the signed-in Supabase account; with no session they
   send the person to /signin. */

function message(e: unknown) {
  const m = (e as { message?: string; status?: number })?.message || '';
  if (/rate limit|too many|security purposes/i.test(m)) return 'Too many tries. Wait a minute, then try again.';
  if (/expired|invalid.*(otp|token)|token.*(invalid|expired)/i.test(m)) return 'That code is not right or has expired.';
  if (/already (been )?registered|already in use|exists/i.test(m)) return 'That one is already used by another account.';
  if (/fetch|network/i.test(m)) return 'No connection. Try again when you are back online.';
  return m || 'Something went wrong. Try again.';
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const RESEND = 30;

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
  const [touched, setTouched] = useState(false);
  const [wait, setWait] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const email = mode === 'email';
  const current = email ? user?.email ?? '' : user?.phone ? `+${user.phone.replace(/^\+/, '')}` : '';
  const clean = email ? next.trim().toLowerCase() : `+${next.replace(/[^0-9]/g, '')}`;
  const shaped = email ? EMAIL.test(next.trim()) : /^\+?[0-9 ()-]{7,}$/.test(next.trim()) && clean.length >= 8;
  const same = shaped && clean === (email ? current.toLowerCase() : current);
  const valid = shaped && !same;
  /* Said once the person has left the field (or tried to send), not while typing. */
  const problem = !next.trim() ? '' : !shaped ? (email ? 'Enter a full email, like name@example.com.' : 'Enter the number with its country code, like +44 7700 900123.')
    : same ? (email ? 'That is already your email.' : 'That is already your number.') : '';

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait(w => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const send = async () => {
    if (busy || !valid) return;
    setBusy(true); setErr('');
    try {
      const { error } = await supabase().auth.updateUser(email ? { email: clean } : { phone: clean });
      if (error) throw error;
      setSent(true); setWait(RESEND); setCode('');
      setTimeout(() => codeRef.current?.focus(), 50);
    } catch (e) { setErr(message(e)); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (busy || code.trim().length < 6) return;
    setBusy(true); setErr('');
    try {
      const { error } = email
        ? await supabase().auth.verifyOtp({ email: clean, token: code.trim(), type: 'email_change' })
        : await supabase().auth.verifyOtp({ phone: clean, token: code.trim(), type: 'phone_change' });
      if (error) throw error;
      flash(email ? 'Email changed' : 'Phone number changed');
      leave(router, '/settings');
    } catch (e) { setErr(message(e)); setBusy(false); }
  };

  return (
    <Page title={email ? 'Change email' : 'Phone number'}>
      <form className="sys-form" style={{ display: 'contents' }} noValidate
            onSubmit={e => { e.preventDefault(); setTouched(true); if (sent) void verify(); else void send(); }}>
        {current && (
          <>
            <label className="sys-field-label" htmlFor="sys-current">{email ? 'Current email' : 'Current phone number'}</label>
            <div className="sys-input is-read"><input id="sys-current" value={current} readOnly tabIndex={-1} /></div>
          </>
        )}
        <label className="sys-field-label" htmlFor="sys-next">{email ? 'New email' : 'New phone number'}</label>
        <div className="sys-input">
          <input id="sys-next" type={email ? 'email' : 'tel'} inputMode={email ? 'email' : 'tel'} autoComplete={email ? 'email' : 'tel'}
                 value={next} onChange={e => { setNext(e.target.value); setSent(false); setCode(''); setErr(''); }} onBlur={() => setTouched(true)}
                 enterKeyHint="send" aria-invalid={Boolean(touched && problem)} aria-describedby="sys-next-hint" autoFocus />
        </div>
        {touched && problem
          ? <p id="sys-next-hint" className="sys-error" role="alert">{problem}</p>
          : <p id="sys-next-hint" className="sys-hint">We will send a 6 digit code to check it is yours.</p>}
        {sent && (
          <>
            <label className="sys-field-label" htmlFor="sys-code">Code</label>
            <div className="sys-input">
              <input ref={codeRef} id="sys-code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={code} enterKeyHint="done"
                     onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setErr(''); }} />
            </div>
            <p className="sys-hint">
              Sent to {email ? clean : next.trim()}.{' '}
              {wait > 0 ? <span>Send again in {wait}s</span> : <button type="button" className="sys-link" onClick={() => void send()} disabled={busy}>Send again</button>}
            </p>
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

/* Enter in a field moves to the next one; in the last it saves. */
function nextField(e: React.KeyboardEvent<HTMLInputElement>, next?: string) {
  if (e.key !== 'Enter' || !next) return;
  e.preventDefault();
  document.getElementById(next)?.focus();
}
function Secret({ id, label, value, onChange, autoComplete, focus, next, invalid }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string; focus?: boolean; next?: string; invalid?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <>
      <label className="sys-field-label" htmlFor={id}>{label}</label>
      <div className={`sys-input${invalid ? ' is-danger' : ''}`}>
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={e => onChange(e.target.value)} autoFocus={focus}
               enterKeyHint={next ? 'next' : 'done'} onKeyDown={e => nextField(e, next)} aria-invalid={invalid || undefined} />
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
  const mismatch = again.length > 0 && again !== pw && (again.length >= pw.length || !pw.startsWith(again));
  const short = pw.length > 0 && pw.length < 8;
  const reused = pw.length > 0 && pw === cur;
  const ok = cur.length > 0 && pw.length >= 8 && again === pw && !reused;

  const save = async () => {
    if (!user?.email || busy || !ok) return;
    setBusy(true); setErr('');
    try {
      const sb = supabase();
      const check = await sb.auth.signInWithPassword({ email: user.email, password: cur });
      if (check.error) throw new Error(/invalid login|credentials/i.test(check.error.message) ? 'That current password is not right.' : message(check.error));
      const { error } = await sb.auth.updateUser({ password: pw });
      if (error) throw error;
      flash('Password changed');
      leave(router, '/settings');
    } catch (e) { setErr(message(e)); setBusy(false); }
  };

  return (
    <Page title="Change password">
      <form style={{ display: 'contents' }} onSubmit={e => { e.preventDefault(); if (ok) void save(); }}>
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <Secret id="sys-cur" label="Current password" value={cur} onChange={v => { setCur(v); setErr(''); }} autoComplete="current-password" focus next="sys-new" />
        <Secret id="sys-new" label="New password" value={pw} onChange={setPw} autoComplete="new-password" next="sys-again" invalid={reused} />
        <div className="sys-strength" aria-hidden>
          {[1, 2, 3, 4].map(i => <span key={i} style={i <= s ? { background: LEVELS[s].color } : undefined} />)}
        </div>
        {pw && (
          <p className="sys-strength-label" style={{ color: reused ? 'var(--red)' : short ? 'var(--text-2)' : LEVELS[s].color }} aria-live="polite">
            {reused ? 'Pick a password you have not used here.' : short ? `${LEVELS[s].label} At least 8 characters.`.trim() : LEVELS[s].label}
          </p>
        )}
        <Secret id="sys-again" label="Confirm new password" value={again} onChange={setAgain} autoComplete="new-password" invalid={mismatch} />
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
