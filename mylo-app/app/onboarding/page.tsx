import OnboardingStart from '@/components/signin/OnboardingStart';

export const metadata = { title: 'Get started · Mylo' };

/* /onboarding picks up where the person left off, or starts at O3. */
export default function Onboarding() {
  return <OnboardingStart />;
}
