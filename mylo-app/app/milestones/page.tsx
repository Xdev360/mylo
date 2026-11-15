import { Suspense } from 'react';
import Milestones from '@/components/apps/Milestones';

export const metadata = { title: 'Milestones · Mylo' };

export default function Page() {
  return <Suspense fallback={<main className="screen on-desk" aria-busy="true" />}><Milestones /></Suspense>;
}
