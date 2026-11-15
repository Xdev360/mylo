import { Suspense } from 'react';
import AppsHub from '@/components/apps/AppsHub';

export const metadata = { title: 'Apps · Mylo' };

export default function Page() {
  return <Suspense fallback={<main className="screen on-desk" aria-busy="true" />}><AppsHub /></Suspense>;
}
