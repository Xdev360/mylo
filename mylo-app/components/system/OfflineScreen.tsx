'use client';

import { useRouter } from 'next/navigation';
import { leave } from '@/lib/system';
import StatusScreen from './StatusScreen';

/* /offline: S27. Try again checks the network for real; once it answers,
   back to where the person was (or Today). */
export default function OfflineScreen() {
  const router = useRouter();
  return <StatusScreen kind="offline" onRetry={() => leave(router, '/today')} />;
}
