import { redirect } from 'next/navigation';

/* Onboarding starts at its first step, O3. */
export default function Onboarding() {
  redirect('/onboarding/want');
}
