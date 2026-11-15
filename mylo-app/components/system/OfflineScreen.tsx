'use client';

import { useRouter } from 'next/navigation';
import StatusScreen from './StatusScreen';
import { goBack } from '@/components/NavMotion';

/* /offline: S27. Try again checks the network for real; once it answers,
   back to where the person was (or Today). */
export default function OfflineScreen() {
  const router = useRouter();
  return <StatusScreen kind="offline" onRetry={() => (window.history.length > 1 ? goBack(router) : router.push('/today'))} />;
}
