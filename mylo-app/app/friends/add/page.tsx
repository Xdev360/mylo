import { Suspense } from 'react';
import AddFriend from '@/components/social/AddFriend';

export const metadata = { title: 'Add a friend · Mylo' };

export default function Page() {
  return <Suspense><AddFriend /></Suspense>;
}
