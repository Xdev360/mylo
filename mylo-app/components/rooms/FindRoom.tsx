'use client';

import Link from 'next/link';
import { useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { RoomCard } from './YourRooms';
import { RIcon } from './ui';
import { isMember, useRooms } from '@/lib/rooms';

/* LB6 · Find a room. Rooms that are shown in Find a room. Before the server
   pass these are the open rooms on this device, so yours show with Open. */
const CATS = ['All', 'Fitness', 'Study', 'Creative', 'Work'] as const;

export default function FindRoom() {
  const { ready, rooms, messages } = useRooms();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<typeof CATS[number]>('All');
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const shown = rooms.filter(r => r.findable && (cat === 'All' || r.category === cat) &&
    (!q || `${r.name} ${r.about}`.toLowerCase().includes(q.toLowerCase())));
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
      {shown.map(r => {
        const mine = isMember(r);
        return (
          <RoomCard key={r.id} room={r} list={messages[r.id] ?? []} href={`/rooms/${r.id}/preview`} find
                    action={mine ? <Link href={`/chats/${r.id}`} className="r-pill-soft">Open</Link>
                                 : <Link href={`/rooms/${r.id}/preview`} className="r-pill-dark">Ask to join</Link>} />
        );
      })}
    </main>
  );
}
