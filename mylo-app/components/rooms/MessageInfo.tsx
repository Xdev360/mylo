'use client';

import ScreenHeader from '../ScreenHeader';
import Bubble from './Bubble';
import { useGone } from './ChatSettings';
import { Avatar, Gate } from './ui';
import { ME, useRoom } from '@/lib/rooms';

/* CT16 · Message info: who has seen it, from the read marks everyone's app
   writes as they catch up (the current app's {msg_kind:'read'} rows). There
   is no delivery receipt on the server, so that list stays empty. */
export default function MessageInfo({ id, mid }: { id: string; mid: string }) {
  const { ready, signedOut, error, retry, room, all, status } = useRoom(id);
  const m = all.find(x => x.id === mid);
  useGone(ready && status !== 'loading', room && m, room ? `/chats/${id}` : '/chats');
  if (!ready || !room || !m) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const seen = m.seenBy ?? [];
  const waiting = room.members.filter(x => x.id !== ME && !seen.includes(x.name));
  return (
    <main className="screen on-desk r-info">
      <ScreenHeader title="Message info" fallback={`/chats/${room.id}`} />
      <Bubble m={m} room={room} still />
      <h2 className="r-h3">Seen by</h2>
      {seen.length > 0 ? (
        <div className="card list r-memberlist">
          {seen.map((name, i) => <div key={i} className="r-member"><Avatar name={name} size={32} /><span className="r-member-name">{name}</span></div>)}
        </div>
      ) : <p className="t-body-s c-2">{room.members.length > 1 ? 'No one yet.' : 'Only you are in this room.'}</p>}
      {/* The server keeps read marks, not delivery receipts: everyone else is simply not there yet. */}
      {waiting.length > 0 && <>
        <h2 className="r-h3">Not seen yet</h2>
        <div className="card list r-memberlist">
          {waiting.map(w => <div key={w.id} className="r-member"><Avatar name={w.name} size={32} /><span className="r-member-name">{w.name}</span></div>)}
        </div>
      </>}
    </main>
  );
}
