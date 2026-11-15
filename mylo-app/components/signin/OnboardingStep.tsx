'use client';

import { notFound, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useHydrated } from '@/lib/local';
import { STEPS, isBlocked, isStep, useOnboarding, type Onboarding, type Step } from '@/lib/signin';
import { Screen } from './ui';
import { Time, Want, Who } from './steps/Pick';
import { Name, VibePick } from './steps/Vibe';
import { Rhythm } from './steps/Rhythm';
import { Badge, Goal } from './steps/Goal';
import { Done, Nudges, People, Photo, Save } from './steps/Finish';

export type StepProps = { ob: Onboarding; update: (patch: Partial<Onboarding>) => void; go: (path: string) => void };

const VIEWS: Record<Step, (p: StepProps) => React.ReactNode> = {
  want: Want, time: Time, who: Who, vibe: VibePick, name: Name, rhythm: Rhythm,
  goal: Goal, badge: Badge, save: Save, photo: Photo, nudges: Nudges, people: People, done: Done
};

/* Steps after "who" come after the age check (S1), so they wait for it. */
const AFTER_AGE = STEPS.indexOf('vibe');

export default function OnboardingStep({ step }: { step: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [ob, update] = useOnboarding();
  const known = isStep(step);
  const needsAge = known && STEPS.indexOf(step) >= AFTER_AGE && !ob.birthday;
  const blocked = hydrated && isBlocked();

  useEffect(() => {
    if (!hydrated) return;
    if (blocked || needsAge) router.replace('/age');
  }, [hydrated, blocked, needsAge, router]);

  if (!known) notFound();
  if (!hydrated || blocked || needsAge) return <Screen className="si-blank" />;
  const View = VIEWS[step];
  return <View ob={ob} update={update} go={path => router.push(path)} />;
}
