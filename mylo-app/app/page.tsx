'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session';

/* The front door. Someone signed in, who has been through onboarding, or who
   chose to look around first goes straight to Today; a first visit starts at
   Welcome (O1, O2). */
export default function Home() {
  const router = useRouter();
  const { session, loading } = useSession();
  useEffect(() => {
    if (loading) return;
    let onboarded = false;
    try {
      onboarded = JSON.parse(localStorage.getItem('mylo.onboarding.v1') ?? '{}').done === true
        || localStorage.getItem('mylo.explore.v1') === '1';
    } catch { /* first visit */ }
    router.replace(session || onboarded ? '/today' : '/welcome');
  }, [loading, session, router]);
  return <main className="screen" aria-busy="true" />;
}
