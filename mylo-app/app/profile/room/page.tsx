import '@/styles/profile.css';
import { Suspense } from 'react';
import RoomView from '@/components/profile/RoomView';

export const metadata = { title: 'Your room · Mylo' };

export default function Page() {
  return <Suspense fallback={<main className="screen" aria-busy="true" />}><RoomView /></Suspense>;
}
