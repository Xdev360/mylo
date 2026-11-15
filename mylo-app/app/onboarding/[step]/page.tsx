import OnboardingStep from '@/components/signin/OnboardingStep';

export const metadata = { title: 'Get started · Mylo' };

/* O3 to O15, one route per step: want, time, who, vibe, name, rhythm, goal,
   badge, save, photo, nudges, people, done. */
export default async function OnboardingPage({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  return <OnboardingStep step={step} />;
}
