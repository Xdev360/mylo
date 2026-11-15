'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Chat from './Chat';
import { Avatar, Gate, RIcon, RoomTile, morphOpen, roomFx, useDesk } from './ui';
import { NewRoomSheet } from './YourRooms';
import { useStore } from '@/lib/store';
import { todayIso } from '@/lib/dates';
import { ME, lastMessage, listTime, preview, useRooms, type Message, type Room } from '@/lib/rooms';

/* CT0 · Chats on a phone; DT5 · Rooms from 1024 up, where the list, the
   chat and the room's side panel sit side by side. Mylo's own chat is always
   first. Everything else is a room you made or joined, from your account. */

function useList() {
  const { ready, signedOut, error, retry, rooms, messages, snap } = useRooms();
  const list = useMemo(() => {
    const out = rooms.filter(r => r.members.some(m => m.id === ME)).map(r => ({ room: r, last: lastMessage(messages[r.id] ?? []) as Message | undefined }));
    out.sort((a, b) => Date.parse(b.last?.at ?? b.room.createdAt) - Date.parse(a.last?.at ?? a.room.createdAt));
    return out;
  }, [rooms, messages]);
  return { ready, signedOut, error, retry, list, spaceOf: snap.spaceOf };
}

export default function Chats({ id }: { id?: string }) {
  const desk = useDesk();
  const { ready, signedOut, error, retry, list, spaceOf } = useList();
  if (!ready) return <Gate signedOut={signedOut} error={error} retry={retry} className="screen" />;
  const open = id ? spaceOf[id] ?? id : undefined;
  if (desk) return <Desk id={open ?? list[0]?.room.id} list={list} />;
  if (open) return <Chat id={open} />;
  return <Phone list={list} />;
}

function Phone({ list }: { list: { room: Room; last?: Message }[] }) {
  const [tab, setTab] = useState<'All' | 'Groups' | 'People'>('All');
  const [q, setQ] = useState('');
  const [search, setSearch] = useState(false);
  const [creating, setCreating] = useState(false);
  // Back from a room: that row is where the room folds back into.
  const [backTo, setBackTo] = useState(() => roomFx.back);
  useEffect(() => { if (!backTo) return; const t = setTimeout(() => setBackTo(null), 800); return () => clearTimeout(t); }, [backTo]);
  const shown = list.filter(({ room }) =>
    (tab === 'All' || (tab === 'Groups' ? room.members.length !== 2 : room.members.length === 2)) &&
    (!q || room.name.toLowerCase().includes(q.toLowerCase())));
  const mylo = tab === 'All' && (!q || 'mylo'.includes(q.toLowerCase()));
  return (
    <main className="screen r-chats">
      <header className="r-chats-top">
        <h1 className="r-h1">Chats</h1>
        <div className="r-chats-actions">
          <button type="button" className="round-btn" aria-label="Search" aria-expanded={search} onClick={() => { setSearch(s => !s); setQ(''); }}><RIcon name="search" size={22} /></button>
          <button type="button" className="round-btn" aria-label="New room" onClick={() => setCreating(true)}><RIcon name="compose" size={22} /></button>
        </div>
      </header>
      {search && (
        <label className="r-search">
          <RIcon name="search" size={20} />
          <span className="sr-only">Search rooms</span>
          <input autoFocus type="search" placeholder="Search rooms" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      )}
      <nav className="r-stories" aria-label="Stories">
        <Link href="/feed/new" className="r-story">
          <span className="r-story-ring"><span className="r-story-add"><RIcon name="plus" size={22} /></span></span>
          <span className="t-caption">Your story</span>
        </Link>
      </nav>
      <div className="r-seg" role="tablist" aria-label="Show" style={{ '--i': ['All', 'Groups', 'People'].indexOf(tab), '--n': 3 } as React.CSSProperties}>
        {(['All', 'Groups', 'People'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={tab === t ? 'is-on' : ''} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {(mylo || shown.length > 0) && (
        <div className="card list r-chatlist">
          {mylo && (
            <Link href="/ai" className="r-chatrow">
              <span className="r-mylo-face"><img src="/figma/rooms/mylo-chat.svg" alt="" /></span>
              <span className="r-chatrow-text">
                <span className="r-chatrow-name">Mylo <span className="r-ai-tag">AI</span></span>
                <span className="r-chatrow-last">Want me to plan your evening?</span>
              </span>
              <span className="r-chatrow-side"><span className="t-caption c-3">AI</span></span>
            </Link>
          )}
          {shown.map(({ room, last }) => (
            <Link key={room.id} href={`/chats/${room.id}`} className="r-chatrow" onClick={e => morphOpen(e.currentTarget)}
                  style={backTo === room.id ? { viewTransitionName: 'r-open', animation: 'none' } : undefined}>
              <RoomTile room={room} className="r-chatrow-cover" />
              <span className="r-chatrow-text">
                <span className="r-chatrow-name">{room.name}{room.muted && <RIcon name="bell" size={14} className="c-3 r-muted" />}</span>
                <span className="r-chatrow-last">{last ? preview(last) : room.about || `Code ${room.code}`}</span>
              </span>
              <span className="r-chatrow-side"><span className="t-caption c-3">{listTime(last?.at ?? room.createdAt)}</span></span>
            </Link>
          ))}
        </div>
      )}
      {list.length === 0 && !q && (
        <section className="r-firstroom" aria-label="No rooms yet">
          <h2 className="r-h3">No rooms yet</h2>
          <p className="t-body-s c-2">A room is a small group that keeps each other going. Make one and invite a few friends, or join one with a code.</p>
          <div className="r-two">
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>New room</button>
            <Link href="/rooms/join" className="r-btn-soft is-small">Join with a code</Link>
          </div>
          <Link href="/rooms/find" className="r-btn-text">Find a room to join</Link>
        </section>
      )}
      {list.length > 0 && shown.length === 0 && !mylo && <p className="t-body c-2 r-empty-note">{q ? <>No rooms match &ldquo;{q}&rdquo;.</> : tab === 'People' ? 'Chats with one other person show up here.' : 'Your group rooms show up here.'}</p>}
      <NewRoomSheet open={creating} onClose={() => setCreating(false)} />
    </main>
  );
}

function Desk({ id, list }: { id?: string; list: { room: Room; last?: Message }[] }) {
  const router = useRouter();
  const current = list.find(l => l.room.id === id)?.room;
  return (
    <main className="r-desk">
      <section className="r-desk-list" aria-label="Rooms">
        <header className="r-desk-list-head">
          <h1 className="r-desk-h">Rooms</h1>
          <Link href="/rooms/new" className="r-head-icon" aria-label="New room"><RIcon name="plus-24" size={20} /></Link>
        </header>
        {list.map(({ room, last }) => (
          <button key={room.id} type="button" className={`r-desk-row${room.id === id ? ' is-on' : ''}`} aria-current={room.id === id ? 'page' : undefined}
                  onClick={() => router.push(`/chats/${room.id}`)}>
            <RoomTile room={room} className="r-desk-cover" />
            <span className="r-desk-row-text"><span className="r-desk-row-name">{room.name}</span><span className="r-desk-row-last">{last ? preview(last) : room.about || `Code ${room.code}`}</span></span>
            <span className="r-desk-row-time">{listTime(last?.at ?? room.createdAt)}</span>
          </button>
        ))}
        {list.length === 0 && (
          <div className="r-desk-empty">
            <Link href="/rooms/new" className="btn-primary">New room</Link>
            <Link href="/rooms/join" className="chip chip-plain">Got a code? Join a room</Link>
          </div>
        )}
      </section>
      {current ? <>
        <Chat id={current.id} desk />
        <Rail room={current} />
      </> : (
        <section className="r-desk-blank">
          <Link href="/rooms/find" className="r-findcard">
            <span className="r-find-icon"><RIcon name="compass" size={22} /></span>
            <span className="r-chatrow-text"><span className="r-chatrow-name">Find a room to join</span><span className="t-caption c-2">Lifters, exam crews, writers and more</span></span>
            <RIcon name="chev" size={22} className="c-3" />
          </Link>
        </section>
      )}
    </main>
  );
}

/* DT5's right panel: what the room shares today, and who is in it. Only your
   own day is known on this device, so only your row has a count. */
function Rail({ room }: { room: Room }) {
  const { items } = useStore();
  const mine = items.filter(i => i.date === todayIso() && i.kind !== 'goal');
  const done = mine.filter(i => i.done).length;
  // What I do today with someone in this room, as DT5's cards.
  const names = new Set(room.members.filter(m => m.id !== ME).map(m => m.name.toLowerCase()));
  const shared = mine.filter(i => i.with && names.has(i.with.toLowerCase()));
  return (
    <aside className="r-rail" aria-label="Room">
      <h2 className="r-rail-h">Shared today</h2>
      {shared.length > 0 ? shared.map(i => (
        <div key={i.id} className="r-rail-card">
          <span className="r-rail-card-title">{i.title}</span>
          <span className="t-caption c-2">{i.done ? 'Done' : `With ${i.with}`}</span>
          <span className="r-rail-bar"><span style={{ width: i.done ? '100%' : '0%' }} /></span>
        </div>
      )) : <p className="t-caption c-3">Things you do today with someone in {room.name} show here.</p>}
      <h2 className="r-rail-h">Members</h2>
      <ul className="r-rail-members">
        {room.members.map(m => (
          <li key={m.id}>
            <Avatar name={m.id === ME ? 'You' : m.name} size={28} me={m.id === ME} />
            <span className="r-rail-name">{m.id === ME ? 'You' : m.name}</span>
            {m.id === ME && mine.length > 0 && <span className="r-rail-count">{done} of {mine.length}</span>}
          </li>
        ))}
      </ul>
      <Link href={`/rooms/${room.id}/members`} className="r-rail-link t-body-s c-2">Members and roles</Link>
    </aside>
  );
}
