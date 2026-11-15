import { Suspense } from 'react';
import Focus from '@/components/goals/Focus';

export const metadata = { title: 'Focus · Mylo' };

export default function Page() {
  return <Suspense><Focus /></Suspense>;
}
