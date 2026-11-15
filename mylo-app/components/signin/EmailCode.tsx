'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { stampNav } from '@/components/NavMotion';
import { useHydrated } from '@/lib/local';
import { authMessage, clearInvite, isBlocked, isEmail, pendingEmail, readInvite, setPendingEmail, takeNext, useOnboarding } from '@/lib/signin';
import { supabase } from '@/lib/supabase';
import { Art, BackButton, Cta, Notice, Screen } from './ui';

/* X1 Continue with email (597:53409) and X2 Enter the code (597:53484): a
   six digit code from Supabase, no password. A new email makes a new
   account, so the same two screens sign in and sign up. */
async function sendCode(email: string, meta: Record<string, string>) {
  const { error } = await supabase().auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}/today`, data: meta }
  });
  if (error) throw error;
}

export function EmailStep() {
  const router = useRouter();
  const [ob] = useOnboarding();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    const v = email.trim().toLowerCase();
    if (!isEmail(v)) { setError('Enter an email you can open'); return; }
    if (isBlocked()) { router.push('/age'); return; }
    setBusy(true); setError('');
    try {
      await sendCode(v, { mylo_name: ob.myloName, vibe: ob.vibe });
      setPendingEmail(v);
      stampNav('push');
      router.push('/signin/code');
    } catch (e) { setBusy(false); setError(authMessage(e)); }
  };

  return (
    <Screen className="si-x">
      <header className="si-head"><BackButton fallback="/signin" /></header>
      <div className="si-x-art"><span className="si-disc" /><Art name="mylo-proud" w={106} h={128} className="si-x-mylo" /></div>
      <h1 className="si-title-l">What is your email?</h1>
      <p className="t-body c-2 si-x-sub">We send a 6-digit code. No password needed.</p>
      <form className="si-x-form" onSubmit={e => { e.preventDefault(); send(); }}>
        <label className="si-field is-x">
          <span>Email</span>
          <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} autoFocus
                 value={email} onChange={e => setEmail(e.target.value)} enterKeyHint="send" />
        </label>
        <Notice text={error} />
        <Cta type="submit" busy={busy} className="is-54">Send code</Cta>
        <Link href="/signin" className="t-body-s c-2 si-x-alt">Use a password instead</Link>
      </form>
    </Screen>
  );
}

const LENGTH = 6;
const WAIT = 30;

export function CodeStep() {
  const router = useRouter();
  const hydrated = useHydrated();
  const [ob] = useOnboarding();
  const email = hydrated ? pendingEmail() : '';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; tone: 'error' | 'info' }>({ text: '', tone: 'error' });
  const [left, setLeft] = useState(WAIT);
  const [wrong, setWrong] = useState(0);
  const [focused, setFocused] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  // The typing point always sits after the last digit, so the box that
  // lights up is the one the next digit goes into.
  const toEnd = () => { const el = input.current; if (el) { const n = el.value.length; el.setSelectionRange(n, n); } };

  useEffect(() => { if (hydrated && !email) router.replace('/signin/email'); }, [hydrated, email, router]);
  useEffect(() => {
    if (left <= 0) return;
    const t = window.setTimeout(() => setLeft(l => l - 1), 1000);
    return () => window.clearTimeout(t);
  }, [left]);

  const verify = async (token = code) => {
    if (token.length !== LENGTH || busy) return;
    setBusy(true); setMsg({ text: '', tone: 'error' });
    try {
      const { error } = await supabase().auth.verifyOtp({ email, token, type: 'email' });
      if (error) throw error;
      stampNav('tab');
      router.replace(takeNext('/today'));
    } catch (e) {
      setBusy(false); setCode(''); setWrong(n => n + 1); setMsg({ text: authMessage(e), tone: 'error' }); requestAnimationFrame(() => input.current?.focus());
    }
  };
  const resend = async () => {
    setMsg({ text: '', tone: 'error' });
    try { await sendCode(email, { mylo_name: ob.myloName, vibe: ob.vibe }); setLeft(WAIT); setMsg({ text: 'Sent. Check your email.', tone: 'info' }); }
    catch (e) { setMsg({ text: authMessage(e), tone: 'error' }); }
  };

  if (!hydrated || !email) return <Screen className="si-blank" />;
  return (
    <Screen className="si-x">
      <header className="si-head"><BackButton fallback="/signin/email" /></header>
      <h1 className="si-title-l si-x-top">Check your email</h1>
      <p className="t-body c-2 si-x-sub">We sent a code to {email}</p>
      <label className="si-code" key={wrong} data-wrong={(wrong && msg.tone === 'error' && msg.text) ? '' : undefined}>
        <span className="sr-only">6-digit code</span>
        <input ref={input} className="si-code-input" value={code} autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={LENGTH}
               enterKeyHint="go" disabled={busy}
               onFocus={() => { setFocused(true); requestAnimationFrame(toEnd); }} onBlur={() => setFocused(false)}
               onSelect={toEnd} onKeyUp={toEnd}
               onKeyDown={e => { if (e.key === 'Enter') verify(); }}
               onPaste={e => {
                 // A pasted code (with spaces, a dash or words around it) fills every box.
                 const v = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
                 if (!v) return;
                 e.preventDefault(); setCode(v); setMsg({ text: '', tone: 'error' }); if (v.length === LENGTH) verify(v);
               }}
               onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, LENGTH); setCode(v); if (msg.tone === 'error') setMsg({ text: '', tone: 'error' }); if (v.length === LENGTH) verify(v); }} />
        {Array.from({ length: LENGTH }, (_, i) => {
          const now = focused && i === Math.min(code.length, LENGTH - 1);
          return (
            <span key={i} aria-hidden className={`si-digit${now ? ' is-now' : ''}${code[i] ? ' is-full' : ''}`}>
              {code[i] ? <span className="si-digit-n">{code[i]}</span> : now && <span className="si-caret" />}
            </span>
          );
        })}
      </label>
      {left > 0
        ? <p className="t-body-s c-3 si-resend">Resend in 0:{String(left).padStart(2, '0')}</p>
        : <button type="button" className="t-body-s c-2 si-resend" onClick={resend}>Resend code</button>}
      <Notice text={msg.text} tone={msg.tone} />
      <Cta busy={busy} disabled={code.length !== LENGTH} onClick={() => verify()} className="is-54 si-code-cta">Continue</Cta>
    </Screen>
  );
}

/* X4 You are in (597:53588): after an invite let someone into a room. The
   invite flow leaves { roomId, room, by, members } under INVITE_KEY. */
const FACE = ['#4BA37A', '#9B6BD6', '#5B8DEF', '#2B3150'];

export function YouAreIn() {
  const router = useRouter();
  const hydrated = useHydrated();
  const invite = hydrated ? readInvite() : null;
  useEffect(() => { if (hydrated && !invite) router.replace('/today'); }, [hydrated, invite, router]);
  if (!invite) return <Screen className="si-blank" />;
  const later = () => { clearInvite(); router.push('/today'); };
  return (
    <Screen className="si-x si-in">
      <header className="si-head"><BackButton close onClick={later} /></header>
      <Art name="room-cover" w={353} h={220} className="si-in-cover" />
      <h1 className="si-title-l si-center si-in-title">You are in</h1>
      <p className="t-body c-2 si-center si-in-sub">{invite.by} let you into {invite.room}. Say hi to the room.</p>
      {invite.members && invite.members.length > 0 && (
        <div className="si-faces" aria-label={`${invite.members.length} in the room`}>
          {invite.members.slice(0, 4).map((m, i) => <span key={`${m}-${i}`} style={{ background: FACE[i % FACE.length] }}>{m.trim().charAt(0).toUpperCase()}</span>)}
        </div>
      )}
      <div className="si-in-btns">
        <Cta className="is-54" onClick={() => { clearInvite(); router.push(`/rooms/${encodeURIComponent(invite.roomId)}`); }}>Open {invite.room}</Cta>
        <button type="button" className="si-later" onClick={later}>Later</button>
      </div>
    </Screen>
  );
}
