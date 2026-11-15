'use client';

import '@/styles/system.css';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { useOnline } from '@/lib/system';

/* OfflineBanner, S27's black bar: "You are offline. Changes will sync
   later." It listens to the browser's real online and offline events: it
   slides down when the connection drops and slides back up once it returns.

   <OfflineBanner />            fixed across the top of the screen (mount once, e.g. in AppShell)
   <OfflineBanner inline />     in the flow, as the first thing on a screen
   <OfflineBanner always />     show even when online (the /offline screen preview)

   For your own logic: `useOnline()` from lib/system returns true or false. */
export default function OfflineBanner({ inline = false, always = false }: { inline?: boolean; always?: boolean }) {
  const online = useOnline();
  const show = always || !online;
  /* A short drop (a lift, a tunnel) should not flash the bar: it waits a
     moment before sliding in, and leaves straight away. */
  const [on, setOn] = useState(show);
  useEffect(() => {
    if (show === on) return;
    const t = setTimeout(() => setOn(show), show && !always ? 400 : 0);
    return () => clearTimeout(t);
  }, [show, on, always]);

  if (inline) {
    if (!show) return null;
    return (
      <div className="sys-offline is-inline is-on" role="status" aria-live="polite">
        <Icon name="system/alert" size={20} />
        <span>You are offline. Changes will sync later.</span>
      </div>
    );
  }
  return (
    <div className={`sys-offline${on ? ' is-on' : ''}`} role="status" aria-live="polite">
      {/* The words stay while it slides away; hidden (visibility) once up. */}
      <Icon name="system/alert" size={20} />
      <span>You are offline. Changes will sync later.</span>
    </div>
  );
}
