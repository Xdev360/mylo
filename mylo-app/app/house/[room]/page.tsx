import { notFound, redirect } from 'next/navigation';
import { RoomView } from '@/components/world/House';
import type { RoomId } from '@/lib/world';

export const metadata = { title: 'Room · Mylo' };

/* The page is a server component and lib/world is client code, so its
   ROOMS list arrives here as a client reference, not an array. The ids are
   listed here instead (keep in step with ROOMS). */
const ROOM_IDS: RoomId[] = ['bedroom', 'kitchen', 'living', 'gym', 'garden'];

export default async function Page({ params }: { params: Promise<{ room: string }> }) {
  const { room } = await params;
  if (room === 'photo') redirect('/photo');
  if (!ROOM_IDS.includes(room as RoomId)) notFound();
  return <RoomView room={room as RoomId} />;
}
