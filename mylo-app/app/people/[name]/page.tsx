import { Suspense } from 'react';
import { PersonDay } from '@/components/social/People';

export const metadata = { title: 'Their day · Mylo' };

export default function Page() {
  return <Suspense><PersonDay /></Suspense>;
}
