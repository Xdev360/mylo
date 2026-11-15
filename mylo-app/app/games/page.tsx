import { Suspense } from 'react';
import GamesHub from '@/components/apps/GamesHub';

export const metadata = { title: 'Games · Mylo' };

export default function Page() {
  return <Suspense fallback={<main className="screen on-desk" aria-busy="true" />}><GamesHub /></Suspense>;
}
