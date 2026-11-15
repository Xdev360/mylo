import { redirect } from 'next/navigation';

/* The age check (S1, S2) is a step of onboarding now; old links still land on it. */
export default function AgePage() {
  redirect('/onboarding/age');
}
