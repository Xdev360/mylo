import { Suspense } from 'react';
import { JournalForm } from '@/components/goals/Journal';

export const metadata = { title: 'How was today? · Mylo' };

export default function Page() {
  return <Suspense><JournalForm /></Suspense>;
}
