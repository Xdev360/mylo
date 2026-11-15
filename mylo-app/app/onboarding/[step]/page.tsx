
export const metadata = { title: 'Get started · Mylo' };

/* O3 to O15 and the age check, one address per step: want, time, who, age,
   vibe, name, rhythm, goal, badge, save, photo, nudges, people, done. The
   layout draws them; the page only makes the address real (and built ahead,
   so moving a step never waits on the server). */
export const dynamicParams = false;
export function generateStaticParams() {
  // The same list as STEPS in lib/signin.ts (that file is client code).
  return ['want', 'time', 'who', 'age', 'vibe', 'name', 'rhythm', 'goal', 'badge', 'save', 'photo', 'nudges', 'people', 'done'].map(step => ({ step }));
}

export default function OnboardingStepPage() {
  return null;
}
