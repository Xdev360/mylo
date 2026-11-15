import { Suspense } from 'react';
import { RoomGoals } from '@/components/social/People';

export const metadata = { title: 'Room goals · Mylo' };

export default function Page() {
  return <Suspense><RoomGoals /></Suspense>;
}
