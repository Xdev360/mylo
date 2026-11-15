'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { PopMenu } from './ChatSheets';
import { Avatar, RIcon } from './ui';
import { useGone } from './ChatSettings';
import { rooms, useRoom } from '@/lib/rooms';

/* B6 · Join requests (admin). People who used the code or a link wait here
   for your OK. They arrive from the server; on this device the list starts
   and stays empty until then. */
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
  return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 2880 ? 'yesterday' : `${Math.round(m / 1440)}d`;
};

export default function Requests({ id }: { id: string }) {
  const router = useRouter();
  const { ready, room } = useRoom(id);
  const [more, setMore] = useState<HTMLElement | null>(null);
  useGone(ready, room);
  if (!ready || !room) return <main className="screen on-desk" aria-busy="true" />;
  const n = room.requests.length;
  const seats = Math.max(0, room.capacity - room.members.length);
  return (
    <main className="screen on-desk r-requests">
      <ScreenHeader title="Requests" fallback={`/rooms/${room.id}`}
                    actions={<button type="button" className="back-btn" aria-label="More" onClick={e => setMore(e.currentTarget)}><RIcon name="more" size={20} /></button>} />
      <p className="t-label c-3">{n} {n === 1 ? 'person wants' : 'people want'} in to {room.name}</p>
      {room.requests.map(q => (
        <article key={q.id} className="r-request">
          <div className="r-request-top">
            <Avatar name={q.name} size={44} />
            <span className="r-pending-text"><span className="r-pending-name">{q.name}</span><span className="r-pending-sub">{q.via === 'link' ? 'Invite link' : 'Code'} · {ago(q.at)}</span></span>
          </div>
          <p className="t-body c-2">{q.note ? `“${q.note}”` : 'Used your invite code'}</p>
          <div className="r-two">
            <button type="button" className="btn-primary" disabled={!seats} onClick={() => rooms.setRequestDecision(room.id, q.id, true)}>Let them in</button>
            <button type="button" className="r-btn-soft" onClick={() => rooms.setRequestDecision(room.id, q.id, false)}>Decline</button>
          </div>
        </article>
      ))}
      <p className="t-caption c-3">{seats} {seats === 1 ? 'seat' : 'seats'} left in {room.name}.</p>
      {more && <PopMenu anchor={more} up={false} onClose={() => setMore(null)} items={[
        { label: 'Members and roles', icon: 'room', onClick: () => router.push(`/rooms/${room.id}/members`) },
        { label: 'Invite someone', icon: 'user-plus', onClick: () => router.push(`/rooms/${room.id}/members?invite=1`) },
        { label: 'Room settings', icon: 'shield', onClick: () => router.push(`/rooms/${room.id}`) }
      ]} />}
    </main>
  );
}
