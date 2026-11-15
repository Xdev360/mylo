'use client';

import { useEffect, useState } from 'react';
import { ALREADY_IN } from '@/lib/content';
import { waitlistCount } from '@/lib/supabase';

/* The sidebar's "Already in the waitlist", with the real number. It says
   nothing at all until the list is long enough to be worth saying, and nothing
   if the count cannot be read. The sidebar only exists on wide screens, so a
   phone never asks. */
export default function WaitlistCount() {
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!matchMedia('(min-width:1280px)').matches) return;
    let live = true;
    waitlistCount().then(n => { if (live) setCount(n); });
    return () => { live = false; };
  }, []);
  if (count === null || count < ALREADY_IN.showFrom) return null;
  return (
    <>
      <p className="shell-eyebrow">{ALREADY_IN.label}</p>
      <p className="shell-count">{count.toLocaleString()}</p>
    </>
  );
}
