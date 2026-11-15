import { Suspense } from 'react';
import NewPost from '@/components/social/NewPost';

export const metadata = { title: 'New post · Mylo' };

export default function Page() {
  return <Suspense><NewPost /></Suspense>;
}
