import OnboardingFlow from '@/components/signin/OnboardingFlow';

/* One flow for every /onboarding/[step]: the layout stays mounted while the
   step changes, so the header and the button hold still and only the step
   in between moves (components/signin/OnboardingFlow.tsx). */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<OnboardingFlow /></>;
}
