'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { EMPTY_ONBOARDING, ONBOARDING_KEY, isStep, stepPath, type Onboarding } from '@/lib/signin';

/* Get started lands here: back on the step the person last reached (their
   answers are still on the device), or the first one. */
export default function OnboardingStart() {
  const router = useRouter();
  useEffect(() => {
    let ob: Onboarding = EMPTY_ONBOARDING;
    try { ob = { ...EMPTY_ONBOARDING, ...JSON.parse(localStorage.getItem(ONBOARDING_KEY) ?? '{}') }; } catch { /* fresh */ }
    const at = !ob.done && ob.at && isStep(ob.at) ? ob.at : 'want';
    router.replace(stepPath(at));
  }, [router]);
  return <main className="si-root si si-blank" />;
}
