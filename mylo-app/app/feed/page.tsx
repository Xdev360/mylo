import { Suspense } from 'react';
import FeedView from '@/components/social/FeedView';

export const metadata = { title: 'Vibe · Mylo' };

export default function Page() {
  return <Suspense><FeedView /></Suspense>;
}
