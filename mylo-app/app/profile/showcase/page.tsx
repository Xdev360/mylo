import '@/styles/profile.css';
import { Suspense } from 'react';
import FriendsSee from '@/components/profile/FriendsSee';

export const metadata = { title: 'What friends see · Mylo' };

export default function Page() {
  return <Suspense fallback={<main className="screen on-desk" aria-busy="true" />}><FriendsSee /></Suspense>;
}
