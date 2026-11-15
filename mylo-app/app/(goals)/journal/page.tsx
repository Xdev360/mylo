import { Suspense } from 'react';
import { JournalView } from '@/components/goals/Journal';

export const metadata = { title: 'Journal · Mylo' };

export default function Page() {
  return <Suspense><JournalView /></Suspense>;
}
