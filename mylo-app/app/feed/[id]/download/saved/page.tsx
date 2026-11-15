import { Suspense } from 'react';
import { DownloadSaved } from '@/components/social/DownloadView';

export const metadata = { title: 'Saved · Mylo' };

export default function Page() {
  return <Suspense><DownloadSaved /></Suspense>;
}
