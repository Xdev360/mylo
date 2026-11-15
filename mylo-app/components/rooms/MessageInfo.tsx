'use client';

import ScreenHeader from '../ScreenHeader';
import Bubble from './Bubble';
import { useGone } from './ChatSettings';
import { useRoom } from '@/lib/rooms';

/* CT16 · Message info: who has seen it and who it reached. Receipts come
   from the server pass; until then nobody else is in a room on this device,
   so both lists stay empty under their headings. */
export default function MessageInfo({ id, mid }: { id: string; mid: string }) {
  const { ready, room, all } = useRoom(id);
  const m = all.find(x => x.id === mid);
  useGone(ready, room && m, room ? `/chats/${id}` : '/chats');
  if (!ready || !room || !m) return <main className="screen on-desk" aria-busy="true" />;
  return (
    <main className="screen on-desk r-info">
      <ScreenHeader title="Message info" fallback={`/chats/${room.id}`} />
      <Bubble m={m} room={room} still />
      <h2 className="r-h3">Seen by</h2>
      <h2 className="r-h3">Delivered to</h2>
    </main>
  );
}
