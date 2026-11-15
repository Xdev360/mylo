'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import { canGoBack } from '../NavMotion';
import { Avatars, CoverArt, Gate, RIcon, morphOpen, useToast } from './ui';
import { ME, errText, roomStreak, rooms, useRooms, type Message, type Room } from '@/lib/rooms';

/* LB1 · Your rooms, and B3 · New room over it at /rooms/new. */

/* In Find a room (LB6, LB4's preview) a card counts seats, "9 of 12 members",
   and only a streak earns a tag; in Your rooms (LB1) it is your own view. */
export function RoomCard({ room, list, action, href, find = false }: { room: Room; list: Message[]; action: React.ReactNode; href: string; find?: boolean }) {
  const streak = roomStreak(list);
  const solo = room.members.length === 1;
  const tag = streak >= 2 ? `${streak}-day ${room.members.length === 2 ? 'duo ' : ''}streak` : solo && !find ? 'Private' : null;
  const count = find ? `${room.members.length} of ${room.capacity} members` : solo ? 'Only you' : `${room.members.length} members`;
  return (
    <article className="r-roomcard">
      <Link href={href} className="r-roomcard-link" aria-label={room.name}>
        <CoverArt cover={room.cover} name={room.name} className="r-roomcard-cover" />
        {tag && <span className="r-tag-amber">{tag}</span>}
      </Link>
      <div className="r-roomcard-body">
        <Link href={href} className="r-roomcard-name">{room.name}</Link>
        {room.about && <p className="r-roomcard-about">{room.about}</p>}
        <div className="r-roomcard-foot">
          <Avatars members={room.members} />
          <span className="t-caption c-3">{count}</span>
          <span className="spacer" />
          {action}
        </div>
      </div>
    </article>
  );
}

/* `replace` when the sheet has its own address (/rooms/new): the new room
   takes that place in history. Opened over another screen, it adds a step. */
export function NewRoomSheet({ open, onClose, replace = false }: { open: boolean; onClose: () => void; replace?: boolean }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, say] = useToast();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { const t = setTimeout(() => input.current?.focus(), 250); return () => clearTimeout(t); } }, [open]);
  async function create() {
    if (!name.trim()) { input.current?.focus(); return; }
    if (busy) return;
    setBusy(true);
    try {
      const id = await rooms.create(name);
      setName('');
      if (replace) router.replace(`/rooms/${id}/members?invite=1`); else router.push(`/rooms/${id}/members?invite=1`);
    } catch (e) { say(errText(e)); } finally { setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title="New room" sub="Name it. Invite people. They need your OK to join." labelId="r-new-title">
      <label className="r-field">
        <span className="r-field-label">Room name</span>
        <input ref={input} className="r-field-input" value={name} maxLength={40} placeholder="5am Lifters"
               onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') create(); }} />
      </label>
      <button type="button" className="btn-primary" onClick={create} aria-disabled={!name.trim() || busy} aria-busy={busy}>Create room</button>
      <Link href="/rooms/join" className="r-btn-text" onClick={onClose}>Got a code? Join a room</Link>
      {toast}
    </Sheet>
  );
}

export default function YourRooms({ creating = false }: { creating?: boolean }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, rooms: all, messages } = useRooms();
  const [open, setOpen] = useState(creating);
  if (!ready) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const mine = all.filter(r => r.members.some(m => m.id === ME));
  return (
    <main className="screen on-desk r-yours">
      <header className="r-chats-top">
        <h1 className="r-h1">Your rooms</h1>
        <button type="button" className="r-pill-dark" onClick={() => setOpen(true)}>New room</button>
      </header>
      {mine.map(r => (
        <RoomCard key={r.id} room={r} list={messages[r.id] ?? []} href={`/rooms/${r.id}`}
                  action={<Link href={`/chats/${r.id}`} className="r-pill-soft" onClick={e => { const card = e.currentTarget.closest<HTMLElement>('.r-roomcard'); if (card) morphOpen(card); }}>Open</Link>} />
      ))}
      <Link href="/rooms/find" className="r-findcard">
        <span className="r-find-icon"><RIcon name="compass" size={22} /></span>
        <span className="r-chatrow-text"><span className="r-chatrow-name">Find a room to join</span><span className="t-caption c-2">Lifters, exam crews, writers and more</span></span>
        <RIcon name="chev" size={22} className="c-3" />
      </Link>
      {mine.length === 0 && <p className="t-body-s c-2 r-empty-note">You are not in a room yet. Make one with New room, or find one below.</p>}
      <NewRoomSheet open={open} replace={creating} onClose={() => {
        setOpen(false);
        // Let the sheet go down, then step back to wherever New room was opened from.
        if (creating) setTimeout(() => (canGoBack() ? router.back() : router.replace('/rooms')), 260);
      }} />
    </main>
  );
}
