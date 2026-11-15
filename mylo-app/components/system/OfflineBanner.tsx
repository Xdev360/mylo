'use client';

import '@/styles/system.css';
import Icon from '@/components/Icon';
import { useOnline } from '@/lib/system';

/* OfflineBanner, S27's black bar: "You are offline. Changes will sync
   later." It listens to the browser's real online and offline events and
   only shows while the device is offline.

   <OfflineBanner />            fixed across the top of the screen (mount once, e.g. in AppShell)
   <OfflineBanner inline />     in the flow, as the first thing on a screen
   <OfflineBanner always />     show even when online (the /offline screen preview)

   For your own logic: `useOnline()` from lib/system returns true or false. */
export default function OfflineBanner({ inline = false, always = false }: { inline?: boolean; always?: boolean }) {
  const online = useOnline();
  if (online && !always) return null;
  return (
    <div className={`sys-offline${inline ? ' is-inline' : ''}`} role="status" aria-live="polite">
      <Icon name="system/alert" size={20} />
      <span>You are offline. Changes will sync later.</span>
    </div>
  );
}
