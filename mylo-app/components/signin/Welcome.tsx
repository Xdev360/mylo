'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useHydrated } from '@/lib/local';
import { useSession } from '@/lib/session';
import { Art, Cta, Foot, Screen } from './ui';

/* O1 Splash (877:107697), then O2 Welcome (877:107708). The splash shows
   once a visit; a person who is already signed in goes on to Today. */
const SPLASH_KEY = 'mylo.signin.splash';
const NOTES = [
  { text: 'Gym at 6. No excuses.', tone: '#FFF1A8', cls: 'n1', pin: '#E5484D' },
  { text: 'Read 20 pages', tone: '#FFE0E6', cls: 'n2', pin: '#3E7BFA' },
  { text: 'Call mum Sunday', tone: '#E3ECFF', cls: 'n3' },
  { text: 'Ship the thing', tone: '#E2F5EA', cls: 'n4', pin: '#F5A524' }
];

function seenSplash() { try { return sessionStorage.getItem(SPLASH_KEY) === '1'; } catch { return true; } }

export default function Welcome({ handFont }: { handFont: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { session, loading } = useSession();
  const [splashDone, setSplashDone] = useState(false);
  const splash = hydrated && !splashDone && !seenSplash();

  useEffect(() => {
    if (!splash) return;
    const t = window.setTimeout(() => {
      try { sessionStorage.setItem(SPLASH_KEY, '1'); } catch { /* blocked */ }
      setSplashDone(true);
    }, 1400);
    return () => window.clearTimeout(t);
  }, [splash]);

  useEffect(() => {
    if (!loading && session && !splash) router.replace('/today');
  }, [loading, session, splash, router]);

  if (!hydrated) return <Screen className="si-blank" />;

  if (splash) return (
    <Screen className="si-splash" label="Mylo">
      <div className="si-splash-hero">
        <span className="si-disc si-splash-disc" />
        <Art name="mylo-happy" w={200} h={240} className="si-splash-mylo" />
        <h1 className="si-wordmark">mylo</h1>
        <p className="t-body c-2">Do it together.</p>
      </div>
      <div className="si-dots" aria-label="Loading"><span /><span /><span /></div>
    </Screen>
  );

  return (
    <Screen className="si-welcome">
      {NOTES.map(n => (
        <span key={n.cls} aria-hidden className={`si-sticky si-sticky-${n.cls} ${handFont}`} style={{ background: n.tone }}>{n.text}</span>
      ))}
      {NOTES.filter(n => n.pin).map(n => <span key={`p${n.cls}`} aria-hidden className={`si-pin si-pin-${n.cls}`} style={{ background: n.pin }} />)}
      <div className="si-welcome-hero">
        {/* The company's picture: three Mylos, together. */}
        <img className="si-welcome-logo" src="/brand/mylo-logo-512.webp" alt="" width={200} height={200} />
        <h1 className="si-title">Goals feel lighter with company</h1>
        <p className="t-body c-2 si-sub">Plan your day. Keep each other going.</p>
      </div>
      <Foot note="Already have an account? Sign in" noteHref="/signin">
        <Cta onClick={() => router.push('/onboarding/want')}>Get started</Cta>
        <button type="button" className="si-look" onClick={() => {
          try { localStorage.setItem('mylo.explore.v1', '1'); } catch { /* still goes */ }
          router.push('/today');
        }}>Look around first</button>
      </Foot>
    </Screen>
  );
}
