'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useSession } from '@/lib/session';
import { authMessage, blobToDataUrl, dataUrlToBlob, nextStep, setNext, signInWithProvider, squareJpeg, uploadAvatar } from '@/lib/signin';
import { useStore } from '@/lib/store';
import type { StepProps } from '../OnboardingStep';
import { Art, BackButton, Cta, Foot, Notice, OnboardHeader, Screen } from '../ui';

/* ── O11 Save your Mylo (877:108139) ───────────────────────────────────── */
export function AuthChoices({ next, onError, onEmail }: { next: string; onError: (m: string) => void; onEmail: () => void }) {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);
  const oauth = async (p: 'google' | 'apple') => {
    setBusy(p); onError('');
    try { await signInWithProvider(p, next); } catch (e) { setBusy(null); onError(authMessage(e)); }
  };
  return (
    <>
      <button type="button" className="si-auth is-google" onClick={() => oauth('google')} disabled={busy !== null} aria-busy={busy === 'google' || undefined}>
        <img src="/figma/signin/google.svg" alt="" width={20} height={20} />Continue with Google
      </button>
      <button type="button" className="si-auth is-apple" onClick={() => oauth('apple')} disabled={busy !== null} aria-busy={busy === 'apple' || undefined}>
        <Icon name="signin/i-apple" size={20} />Continue with Apple
      </button>
      <button type="button" className="si-auth is-email" onClick={onEmail} disabled={busy !== null}>
        <Icon name="signin/i-mail" size={22} />Continue with email
      </button>
    </>
  );
}

export function Save({ ob, go }: StepProps) {
  const [error, setError] = useState('');
  const next = '/onboarding/photo';
  return (
    <Screen className="si-save">
      <header className="si-head"><BackButton fallback="/onboarding/badge" /></header>
      <span className="si-ring si-save-ring"><Art name="mylo-beanie" w={111} h={133} /></span>
      <p className="si-pill"><span>{ob.myloName}</span><span className="c-2">· Spark</span></p>
      <h1 className="si-title">Save your Mylo</h1>
      <p className="t-body c-2 si-sub">Your goal and streak come with you</p>
      <div className="si-auths">
        <AuthChoices next={next} onError={setError} onEmail={() => { setNext(next); go('/signin/email'); }} />
        <Notice text={error} />
        <p className="t-body-s c-2 si-have">Already have an account? <Link href="/signin" className="c-ink">Sign in</Link></p>
      </div>
      <p className="si-legal">
        By continuing you agree to the <a href="https://www.staymylo.com/terms" target="_blank" rel="noreferrer">Terms</a> and <a href="https://www.staymylo.com/privacy" target="_blank" rel="noreferrer">Privacy Policy</a>.
      </p>
    </Screen>
  );
}

/* ── O12 Add a photo (877:108172) ──────────────────────────────────────── */
export function Photo({ ob, update, go }: StepProps) {
  const { user } = useSession();
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const photo = ob.photo && ob.photo !== 'mylo' ? ob.photo : null;

  const pick = async (file?: File) => {
    if (!file) return;
    setError('');
    try { update({ photo: await blobToDataUrl(await squareJpeg(file)) }); } catch (e) { setError(authMessage(e)); }
  };
  const finish = async (usePhoto: string | null) => {
    if (usePhoto && user) {
      setBusy(true); setError('');
      try { await uploadAvatar(user.id, await dataUrlToBlob(usePhoto)); } catch (e) { setBusy(false); setError(authMessage(e)); return; }
    }
    go(nextStep('photo'));
  };

  return (
    <Screen>
      <OnboardHeader skip={nextStep('photo')} fallback="/onboarding/save" />
      <h1 className="si-title si-title-top">Add a face</h1>
      <p className="t-body c-2 si-sub">So your room knows it is you</p>
      <div className="si-photo">
        <button type="button" className={`si-photo-pick${photo ? ' has-photo' : ''}`} onClick={() => library.current?.click()} aria-label={photo ? 'Change photo' : 'Tap to add'}>
          {photo
            ? <img src={photo} alt="Your photo" />
            : <><Icon name="signin/i-camera" size={44} /><span className="t-body-s">Tap to add</span></>}
        </button>
        <span className="si-photo-mylo"><Art name="mylo-wink-beanie" w={52} h={62} /></span>
      </div>
      <div className="si-photo-btns">
        <button type="button" className="si-tile-btn" onClick={() => camera.current?.click()}><Icon name="signin/i-camera" size={22} />Take photo</button>
        <button type="button" className="si-tile-btn" onClick={() => library.current?.click()}><Icon name="signin/i-photo" size={22} />From library</button>
      </div>
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={library} type="file" accept="image/*" hidden onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <Notice text={error} />
      <Foot note={`Or use ${ob.myloName} as your photo`} onNote={() => { update({ photo: 'mylo' }); finish(null); }}>
        <Cta busy={busy} onClick={() => finish(photo)}>Continue</Cta>
      </Foot>
    </Screen>
  );
}

/* ── O13 Nudges (877:108200). The preview is what a nudge looks like; the
   button asks the phone for permission. ─────────────────────────────── */
function NudgePreview({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <div className={`si-push${small ? ' is-small' : ''}`} aria-hidden={small || undefined}>
      <span className="si-push-icon"><Art name="mylo-smile-small" w={small ? 32 : 34} h={small ? 38 : 41} /></span>
      <span className="si-push-text">
        <span className="si-push-top"><span className="si-push-name">{name}</span><span className="si-push-now">now</span></span>
        <span className="si-push-body">A friend just finished gym. Your turn?</span>
      </span>
    </div>
  );
}

export function Nudges({ ob, update, go }: StepProps) {
  const [busy, setBusy] = useState(false);
  const turnOn = async () => {
    setBusy(true);
    let on = false;
    try { if ('Notification' in window) on = (await Notification.requestPermission()) === 'granted'; } catch { /* not supported */ }
    update({ nudges: on ? 'on' : 'off' });
    go(nextStep('nudges'));
  };
  return (
    <Screen>
      <header className="si-head"><BackButton fallback="/onboarding/photo" /></header>
      <h1 className="si-title si-title-top">Let {ob.myloName} nudge you</h1>
      <p className="t-body c-2 si-sub">Only when it matters. Never spam.</p>
      <div className="si-nudge-art">
        <span className="si-disc si-nudge-disc" />
        <Art name="mylo-wow" w={160} h={192} className="si-nudge-mylo" />
      </div>
      <div className="si-pushes">
        <NudgePreview name={ob.myloName} />
        <NudgePreview name={ob.myloName} small />
      </div>
      <Foot note="Not now" onNote={() => { update({ nudges: 'off' }); go(nextStep('nudges')); }}>
        <Cta busy={busy} onClick={turnOn}>Turn on nudges</Cta>
      </Foot>
    </Screen>
  );
}

/* ── O14 Bring your people (877:108309). The link is the person's own page
   (/u/username) once they have an account, so a friend can find them. ── */
export function People({ go }: StepProps) {
  const { profile } = useSession();
  const [copied, setCopied] = useState(false);
  // Only drawn after hydration (OnboardingStep waits), so window is here.
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  const path = profile?.username ? `/u/${profile.username}` : '/welcome';
  const url = `${origin}${path}`;
  const shown = url.replace(/^https?:\/\//, '');
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1600); } catch { /* blocked */ }
  };
  const share = async () => {
    if (navigator.share) { try { await navigator.share({ title: 'Mylo', url }); } catch { /* closed */ } } else copy();
  };
  return (
    <Screen>
      <OnboardHeader skip={nextStep('people')} fallback="/onboarding/nudges" />
      <h1 className="si-title si-title-top">Bring your people</h1>
      <p className="t-body c-2 si-sub">Rooms work best with 2 to 5</p>
      <div className="si-people-art" aria-hidden>
        <span className="si-disc si-people-disc" />
        <Art name="people-mint" w={90} h={108} className="si-people-a" />
        <Art name="people-peach" w={120} h={144} className="si-people-b" />
        <Art name="people-blue" w={90} h={108} className="si-people-c" />
      </div>
      <div className="si-link">
        <Icon name="signin/i-link" size={22} />
        <span className="si-link-text"><span className="t-body si-link-url">{shown}</span><span className="t-caption c-2">Your room link</span></span>
        <button type="button" className="si-copy" onClick={copy} aria-live="polite">{copied ? 'Copied' : 'Copy'}</button>
      </div>
      <div className="si-share-row">
        <a className="si-tile-btn is-short" href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer"><Icon name="signin/i-chat" size={20} />WhatsApp</a>
        <button type="button" className="si-tile-btn is-short" onClick={share}><Icon name="signin/i-share" size={20} />More</button>
      </div>
      <p className="t-body-s c-2 si-join">Got a code? <Link href="/rooms/join" className="c-ink">Join a room</Link></p>
      <Foot note="You can do this later">
        <Cta onClick={() => go(nextStep('people'))}>Continue</Cta>
      </Foot>
    </Screen>
  );
}

/* ── O15 All set (877:108345) → O17, the lead's empty Today. ───────────── */
export function Done({ update, go }: StepProps) {
  const { name } = useSession();
  const { items } = useStore();
  const goals = items.filter(i => i.kind === 'goal').length;
  return (
    <Screen className="si-done">
      <Art name="confetti" w={393} h={460} className="si-confetti" />
      <div className="si-done-art">
        <span className="si-disc si-done-disc" />
        <Art name="mylo-party" w={220} h={297} className="si-done-mylo" />
      </div>
      <h1 className="si-title si-done-title">{name ? `You're all set, ${name}` : "You're all set"}</h1>
      <div className="si-chips si-done-chips">
        {goals > 0 && <span className="si-chip is-ink"><Icon name="signin/i-goals" size={18} />{goals} {goals === 1 ? 'goal' : 'goals'}</span>}
        <span className="si-chip is-ink"><Icon name="signin/i-streak" size={18} />Day 1</span>
        <span className="si-chip is-ink"><Icon name="signin/i-sparkle" size={18} />Spark</span>
      </div>
      <Foot>
        <Cta onClick={() => { update({ done: true }); go('/today'); }}>Open Today</Cta>
      </Foot>
    </Screen>
  );
}
