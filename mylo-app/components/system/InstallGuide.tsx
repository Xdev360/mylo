'use client';

import '@/styles/system.css';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { captureInstall, detectPlatform, go, isStandalone, leave, useInstallPrompt, type Platform } from '@/lib/system';

/* InstallGuide, S10 (iPhone, Safari) and S11 (Android and desktop, Chrome):
   how to put Mylo on the home screen. Where the browser offers its own
   install prompt (`beforeinstallprompt`, Chrome and Edge), step 2 and the
   main button open it for real.

   <InstallGuide platform?="ios" | "android" />   detected from the browser when left out
   <InstallCapture />   renders nothing; mount once in the app shell so the
                        browser's install event is kept even before /install opens. */

export function InstallCapture() {
  useEffect(() => { captureInstall(); }, []);
  return null;
}

const noop = () => () => {};
const STEPS: Record<'ios' | 'android', { icon: string; title: string; sub: string }[]> = {
  ios: [
    { icon: 'system/share', title: '1. Tap Share', sub: 'The square with the arrow, at the bottom' },
    { icon: 'system/plus', title: '2. Add to Home Screen', sub: 'Scroll down the list to find it' },
    { icon: 'system/check', title: '3. Tap Add', sub: 'Mylo lands next to your other apps' }
  ],
  android: [
    { icon: 'system/more', title: '1. Tap the menu', sub: 'Three dots, top right' },
    { icon: 'system/download', title: '2. Install app', sub: 'Or Add to Home screen' },
    { icon: 'system/check', title: '3. Tap Install', sub: 'Mylo lands in your app drawer' }
  ]
};

export default function InstallGuide({ platform }: { platform?: Platform }) {
  const router = useRouter();
  const detected = useSyncExternalStore(noop, detectPlatform, () => 'other' as Platform);
  const standalone = useSyncExternalStore(noop, isStandalone, () => false);
  const which = (platform ?? detected) === 'ios' ? 'ios' : 'android';
  const { canPrompt, installed, prompt } = useInstallPrompt();
  const [outcome, setOutcome] = useState<string | null>(null);
  useEffect(() => { captureInstall(); }, []);

  const [busy, setBusy] = useState(false);
  const back = () => leave(router, '/settings');
  const install = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await prompt();
      setOutcome(r);
      if (r === 'accepted') go(router, '/today', 'tab', true);
    } finally { setBusy(false); }
  };
  const done = installed || standalone || outcome === 'accepted';

  return (
    <main className="screen on-desk sys-screen sys-install">
      <ScreenHeader fallback="/settings" />
      <div className="sys-state">
        <img className="sys-install-icon" src="/brand/mylo-logo-512.webp" alt="" width={100} height={100} />
        <h1 className="sys-state-title">Put Mylo on your home screen</h1>
        <p className="sys-state-body">
          {which === 'ios' ? 'Takes ten seconds in Safari. It opens like any other app.' : 'Takes ten seconds in Chrome. It opens like any other app.'}
        </p>
        <ol className="sys-install-steps">
          {STEPS[which].map((s, i) => {
            const live = which === 'android' && i === 1 && canPrompt && !done;
            const inner = (
              <>
                <span className="sys-install-step-icon"><Icon name={s.icon} size={24} /></span>
                <span><strong>{s.title}</strong><span>{s.sub}</span></span>
              </>
            );
            return (
              <li key={s.title} style={{ listStyle: 'none' }}>
                {live ? <button type="button" className="sys-install-step" onClick={install}>{inner}</button>
                      : <div className="sys-install-step">{inner}</div>}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="sys-actions">
        {canPrompt && !done
          ? <button type="button" className="sys-btn" onClick={install} disabled={busy}>Install app</button>
          : <button type="button" className="sys-btn" onClick={back}>Got it</button>}
      </div>
    </main>
  );
}
