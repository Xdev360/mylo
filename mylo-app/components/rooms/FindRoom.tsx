'use client';

import Link from 'next/link';
import { useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import Skeleton from '../system/Skeleton';
import StatusScreen from '../system/StatusScreen';
import { RoomCard } from './YourRooms';
import { Gate, RIcon } from './ui';
import { isMember, useDirectory } from '@/lib/rooms';

/* LB6 · Find a room: rooms whose admin turned on Show in Find a room
   (browse_rooms), newest first, by category. Yours show with Open. */
const CATS = ['All', 'Fitness', 'Study', 'Creative', 'Work'] as const;

export default function FindRoom() {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<typeof CATS[number]>('All');
  const { ready, signedOut, error, retry, list, messages, status, reloadDir } = useDirectory(cat);
  if (!ready) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const shown = list.filter(r => !q || `${r.name} ${r.about}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <main className="screen on-desk r-find">
      <ScreenHeader title="Find a room" fallback="/rooms" />
      <label className="r-search">
        <RIcon name="search" size={20} />
        <span className="sr-only">Search rooms</span>
        <input type="search" placeholder="Search rooms" value={q} onChange={e => setQ(e.target.value)} />
      </label>
      <div className="r-cats" role="tablist" aria-label="Kind of room">
        {CATS.map(c => <button key={c} type="button" role="tab" aria-selected={cat === c} className={`r-cat${cat === c ? ' is-on' : ''}`} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <h2 className="r-h3">Open to new people</h2>
      {status === 'loading' && list.length === 0 && <Skeleton variant="chats" count={3} />}
      {status === 'error' && <StatusScreen kind="error" onRetry={reloadDir} cover={false} />}
      {status === 'ready' && shown.length === 0 && (
        <section className="r-firstroom r-center" aria-label="No rooms found">
          <h2 className="r-h3">{q ? `Nothing matches “${q}”` : cat === 'All' ? 'No open rooms right now' : `No ${cat.toLowerCase()} rooms yet`}</h2>
          <p className="t-body-s c-2">{q || cat !== 'All' ? 'Try another word or kind of room, or start one yourself.' : 'Start one yourself and turn on Show in Find a room.'}</p>
          {q || cat !== 'All'
            ? <button type="button" className="r-btn-soft is-small" onClick={() => { setQ(''); setCat('All'); }}>Show all rooms</button>
            : null}
          <Link href="/rooms/new" className="btn-primary">New room</Link>
        </section>
      )}
      {shown.map(r => {
        const mine = isMember(r);
        return (
          <RoomCard key={r.id} room={r} list={messages[r.id] ?? []} href={mine ? `/rooms/${r.id}` : `/rooms/${r.id}/preview`} find
                    action={mine ? <Link href={`/chats/${r.id}`} className="r-pill-soft">Open</Link>
                                 : <Link href={`/rooms/${r.id}/preview`} className="r-pill-dark">{r.asked ? 'Request sent' : 'Ask to join'}</Link>} />
        );
      })}
    </main>
  );
}
