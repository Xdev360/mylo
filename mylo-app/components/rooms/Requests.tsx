'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { PopMenu } from './ChatSheets';
import { Avatar, Gate, RIcon, useToast } from './ui';
import { useGone } from './ChatSettings';
import { errText, rooms, useRoom } from '@/lib/rooms';

/* B6 · Join requests (admin). People who used the code, a link or Find a
   room wait here for your OK (list_join_requests; approve / decline). */
const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 6e4);
  return m < 60 ? `${Math.max(1, m)}m` : m < 1440 ? `${Math.round(m / 60)}h` : m < 2880 ? 'yesterday' : `${Math.round(m / 1440)}d`;
};

export default function Requests({ id }: { id: string }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, room } = useRoom(id);
  const [more, setMore] = useState<HTMLElement | null>(null);
  const [toast, say] = useToast();
  useGone(ready, room && !room.peek ? room : null);
  useEffect(() => { if (ready) void rooms.refreshRequests(id); }, [ready, id]);
  if (!ready || !room || room.peek) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const run = (p: Promise<unknown>) => { p.catch(e => say(errText(e))); };
  const n = room.requests.length;
  const seats = Math.max(0, room.capacity - room.members.length);
  return (
    <main className="screen on-desk r-requests">
      <ScreenHeader title="Requests" fallback={`/rooms/${room.id}`}
                    actions={<button type="button" className="back-btn" aria-label="More" onClick={e => setMore(e.currentTarget)}><RIcon name="more" size={20} /></button>} />
      {n > 0 && <p className="t-label c-3">{n} {n === 1 ? 'person wants' : 'people want'} in to {room.name}</p>}
      {room.requests.map(q => (
        <article key={q.id} className="r-request">
          <div className="r-request-top">
            <Avatar name={q.name} size={44} />
            <span className="r-pending-text"><span className="r-pending-name">{q.name}</span><span className="r-pending-sub">{q.via === 'link' ? 'Invite link' : 'Code'} · {ago(q.at)}</span></span>
          </div>
          <p className="t-body c-2">{q.note ? `“${q.note}”` : 'Used your invite code'}</p>
          <div className="r-two">
            <button type="button" className="btn-primary" disabled={!seats} onClick={() => run(rooms.setRequestDecision(room.id, q.id, true))}>Let them in</button>
            <button type="button" className="r-btn-soft" onClick={() => run(rooms.setRequestDecision(room.id, q.id, false))}>Decline</button>
          </div>
        </article>
      ))}
      {n === 0 && (
        <section className="r-firstroom r-center" aria-label="No requests">
          <h2 className="r-h3">No one is waiting</h2>
          <p className="t-body-s c-2">When someone uses your code or link, they wait here for your OK.</p>
          <button type="button" className="btn-primary" onClick={() => router.push(`/rooms/${room.id}/members?invite=1`)}>Invite someone</button>
        </section>
      )}
      <p className="t-caption c-3">{seats ? `${seats} ${seats === 1 ? 'seat' : 'seats'} left in ${room.name}.` : `${room.name} is full. Remove someone to let a new person in.`}</p>
      {more && <PopMenu anchor={more} up={false} onClose={() => setMore(null)} items={[
        { label: 'Members and roles', icon: 'room', onClick: () => router.push(`/rooms/${room.id}/members`) },
        { label: 'Invite someone', icon: 'user-plus', onClick: () => router.push(`/rooms/${room.id}/members?invite=1`) },
        { label: 'Room settings', icon: 'shield', onClick: () => router.push(`/rooms/${room.id}`) }
      ]} />}
      {toast}
    </main>
  );
}
