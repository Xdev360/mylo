import { Suspense } from 'react';
import NewGoal from '@/components/goals/NewGoal';

export const metadata = { title: 'New goal · Mylo' };

export default function Page() {
  return <Suspense><NewGoal /></Suspense>;
}
