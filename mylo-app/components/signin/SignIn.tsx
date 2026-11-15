'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { stampNav } from '@/components/NavMotion';
import Icon from '@/components/Icon';
import { useSession } from '@/lib/session';
import { authMessage, resolveLoginEmail, signInWithProvider, takeNext } from '@/lib/signin';
import { supabase } from '@/lib/supabase';
import { Art, BackButton, Cta, Foot, Notice, Screen } from './ui';

/* O16 Sign in (877:108408) on a phone, DT1 Sign in (947:27601) from 1024.
   The same accounts as the current app: email or username with a password,
   or Google. The email box also takes a username, as js/app.js does. */
type Msg = { text: string; tone: 'error' | 'info' };

function useSignIn() {
  const router = useRouter();
  const [who, setWho] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState<'pass' | 'reset' | 'google' | 'apple' | null>(null);
  const [msg, setMsg] = useState<Msg>({ text: '', tone: 'error' });

  const submit = async () => {
    if (busy) return;
    if (!who.trim()) { setMsg({ text: 'Enter your email', tone: 'error' }); return; }
    if (pass.length < 4) { setMsg({ text: 'Enter your password', tone: 'error' }); return; }
    setBusy('pass'); setMsg({ text: '', tone: 'error' });
    try {
      const sb = supabase();
      const email = await resolveLoginEmail(who);
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
      const { data: p } = await sb.from('profiles').select('banned_at, disabled_at').eq('id', data.user.id).maybeSingle();
      if (p?.banned_at || p?.disabled_at) {
        await sb.auth.signOut();
        throw new Error(p.banned_at ? 'This account is banned' : 'This account is disabled');
      }
      stampNav('tab');
      router.replace(takeNext('/today'));
    } catch (e) {
      setBusy(null); setMsg({ text: authMessage(e), tone: 'error' });
    }
  };

  const forgot = async () => {
    if (busy) return;
    if (!who.trim()) { setMsg({ text: 'Type your email first', tone: 'error' }); return; }
    setBusy('reset'); setMsg({ text: '', tone: 'error' });
    try {
      const email = await resolveLoginEmail(who);
      const { error } = await supabase().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` });
      if (error) throw error;
      // The same line whether or not the account exists.
      setMsg({ text: 'If that account exists, a reset link is on its way. Check your email.', tone: 'info' });
    } catch (e) {
      setMsg({ text: authMessage(e), tone: 'error' });
    } finally { setBusy(null); }
  };

  const oauth = async (p: 'google' | 'apple') => {
    if (busy) return;
    setBusy(p); setMsg({ text: '', tone: 'error' });
    try { await signInWithProvider(p, '/today'); } catch (e) { setBusy(null); setMsg({ text: authMessage(e), tone: 'error' }); }
  };

  return { who, setWho, pass, setPass, busy, msg, submit, forgot, oauth };
}

export default function SignIn() {
  const router = useRouter();
  const { session, loading } = useSession();
  const f = useSignIn();
  useEffect(() => { if (!loading && session && !f.busy) router.replace('/today'); }, [loading, session, f.busy, router]);

  const passRef = useRef<Record<string, HTMLInputElement | null>>({});
  const fields = (desk: boolean) => (
    <>
      <label className={desk ? 'si-dfield' : 'si-field'}>
        <span>Email</span>
        <input type="text" inputMode="email" autoComplete="username" autoCapitalize="none" spellCheck={false} enterKeyHint="next"
               value={f.who} onChange={e => f.setWho(e.target.value)}
               onKeyDown={e => {
                 // Enter in the first box goes on to the password, unless it is already typed.
                 if (e.key === 'Enter' && !f.pass) { e.preventDefault(); passRef.current[desk ? 'd' : 'p']?.focus(); }
               }} />
      </label>
      <label className={desk ? 'si-dfield' : 'si-field'}>
        <span>Password</span>
        <input ref={el => { passRef.current[desk ? 'd' : 'p'] = el; }} type="password" autoComplete="current-password" enterKeyHint="go"
               value={f.pass} onChange={e => f.setPass(e.target.value)} />
      </label>
    </>
  );

  return (
    <>
      {/* ── Phone: O16 ─────────────────────────────────────────────────── */}
      <Screen className="si-signin only-phone">
        <header className="si-head"><BackButton fallback="/welcome" /></header>
        <span className="si-ring si-signin-ring"><Art name="mylo-wink" w={89} h={107} /></span>
        <h1 className="si-title">Welcome back</h1>
        <p className="t-body c-2 si-sub">Your Mylo missed you</p>
        <form id="si-signin-phone" className="si-signin-form" onSubmit={e => { e.preventDefault(); f.submit(); }}>
          <button type="button" className="si-auth is-google" onClick={() => f.oauth('google')} disabled={f.busy !== null}>
            <img src="/figma/signin/google.svg" alt="" width={20} height={20} />Continue with Google
          </button>
          <button type="button" className="si-auth is-apple" onClick={() => f.oauth('apple')} disabled={f.busy !== null}>
            <Icon name="signin/i-apple" size={20} />Continue with Apple
          </button>
          <p className="si-or"><span>or</span></p>
          {fields(false)}
          <button type="button" className="t-body-s c-2 si-forgot" onClick={f.forgot} disabled={f.busy !== null}>Forgot password?</button>
          <Notice text={f.msg.text} tone={f.msg.tone} />
        </form>
        <Foot note="New here? Create your Mylo" noteHref="/welcome">
          <Cta type="submit" form="si-signin-phone" busy={f.busy === 'pass'}>Sign in</Cta>
        </Foot>
      </Screen>

      {/* ── Desktop: DT1 ───────────────────────────────────────────────── */}
      <main className="si-root si-desk only-desk">
        <section className="si-brand">
          <Link href="/welcome" className="si-brand-logo"><Art name="logo-mylo" w={27} h={32} />mylo</Link>
          <span className="spacer" />
          <Art name="mylo-happy" w={183} h={220} className="si-brand-mylo" />
          <h1 className="si-brand-head">Small wins.<br />Together.</h1>
          <p className="si-brand-body">Plan your day, tick it off and keep your friends close. Your phone and your desktop stay in sync.</p>
        </section>
        <section className="si-dform-wrap">
          <form className="si-dform" onSubmit={e => { e.preventDefault(); f.submit(); }}>
            <h2 className="si-dtitle">Welcome back</h2>
            <p className="si-dsub">Sign in to pick up where you left off.</p>
            {fields(true)}
            <button type="button" className="si-dforgot" onClick={f.forgot} disabled={f.busy !== null}>Forgot password?</button>
            <button type="submit" className="si-dbtn is-primary" disabled={f.busy !== null} aria-busy={f.busy === 'pass' || undefined}>Sign in</button>
            <Notice text={f.msg.text} tone={f.msg.tone} />
            <p className="si-or is-desk"><span>or</span></p>
            <button type="button" className="si-dbtn" onClick={() => f.oauth('apple')} disabled={f.busy !== null}>Continue with Apple</button>
            <button type="button" className="si-dbtn" onClick={() => f.oauth('google')} disabled={f.busy !== null}>Continue with Google</button>
            <div className="si-qr-card">
              <span className="si-qr" aria-hidden>{QR.map(([x, y]) => <i key={`${x}-${y}`} style={{ left: x * 10 + 4, top: y * 10 + 4 }} />)}</span>
              <p>Or scan with the Mylo app on your phone to sign in.</p>
            </div>
            <p className="si-dnew">New here? <Link href="/welcome">Create your Mylo</Link></p>
          </form>
        </section>
      </main>
    </>
  );
}

/* The dot pattern DT1 draws in its QR tile (947:27685), column by row. */
const QR: [number, number][] = [
  [0, 0], [0, 1], [0, 2], [0, 4], [1, 0], [1, 1], [1, 3], [1, 4], [2, 0], [2, 2], [2, 3], [2, 4],
  [3, 1], [3, 2], [3, 3], [4, 0], [4, 1], [4, 2], [4, 4]
];
