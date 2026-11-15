import { Suspense } from 'react';
import { DownloadPick } from '@/components/social/DownloadView';

export const metadata = { title: 'Download · Mylo' };

export default function Page() {
  return <Suspense><DownloadPick /></Suspense>;
}
