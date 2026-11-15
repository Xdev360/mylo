import { Suspense } from 'react';
import PlanDay from '@/components/goals/PlanDay';

export const metadata = { title: 'Plan another day · Mylo' };

export default function Page() {
  return <Suspense><PlanDay /></Suspense>;
}
