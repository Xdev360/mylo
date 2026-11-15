import { Suspense } from 'react';
import { RoomPeople } from '@/components/social/People';

export const metadata = { title: 'Everyone in the room · Mylo' };

export default function Page() {
  return <Suspense><RoomPeople /></Suspense>;
}
