'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { PopMenu } from './ChatSheets';
import { Avatars, RIcon } from './ui';
import { adminName, isMember, rooms, useRooms } from '@/lib/rooms';

/* B4 · Join with a code. With no server yet, the code is checked against
   the rooms on this device, and the card says plainly what it found. */
const LEN = 6;

export default function JoinRoom({ code: start = '' }: { code?: string }) {
  const router = useRouter();
  const { ready, rooms: all } = useRooms();
  const [code, setCode] = useState(start.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LEN));
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const input = useRef<HTMLInputElement>(null);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const full = code.length === LEN;
  const room = full ? all.find(r => r.code === code) : undefined;
  const member = room ? isMember(room) : false;

  function go() {
    if (!room) { input.current?.focus(); return; }
    if (member) { router.push(`/chats/${room.id}`); return; }
    rooms.update(room.id, { asked: true });
  }

  return (
    <main className="screen on-desk r-join">
      <ScreenHeader title="Join a room" fallback="/chats"
                    actions={<button type="button" className="back-btn" aria-label="More" onClick={e => setMenu(e.currentTarget)}><RIcon name="more" size={20} /></button>} />
      <p className="t-body c-2">Enter the code your friend sent.</p>
      <label className="r-code" onClick={() => input.current?.focus()}>
        <span className="sr-only">Room code</span>
        <input ref={input} autoFocus value={code} inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" maxLength={LEN}
               onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, LEN))}
               onKeyDown={e => { if (e.key === 'Enter') go(); }} />
        {Array.from({ length: LEN }, (_, i) => (
          <span key={i} aria-hidden className={`r-code-box${i === Math.min(code.length, LEN - 1) && !full ? ' is-at' : ''}`}>{code[i] ?? ''}</span>
        ))}
      </label>

      {full && room && (
        <section className="r-pending">
          <div className="r-pending-top">
            <Avatars members={room.members} size={32} />
            <span className="r-pending-text">
              <span className="r-pending-name">{room.name}</span>
              <span className="r-pending-sub">{room.members.length} {room.members.length === 1 ? 'person' : 'people'} · admin: {adminName(room).toLowerCase()}</span>
            </span>
          </div>
          {member
            ? <span className="r-pending-chip is-in">You are in this room</span>
            : room.asked && <span className="r-pending-chip"><img src="/figma/rooms/hourglass.svg" alt="" width={16} height={16} />Request sent · waiting for {adminName(room)}</span>}
        </section>
      )}
      {full && !room && <section className="r-pending"><span className="r-pending-chip is-none">No room with that code on this device yet</span></section>}

      <span className="spacer" />
      <button type="button" className="btn-primary r-bottom-btn" onClick={go} aria-disabled={!room || (!!room.asked && !member)}>
        {member ? 'Open' : 'Ask to join'}
      </button>
      {menu && <PopMenu anchor={menu} up={false} onClose={() => setMenu(null)} items={[
        { label: 'Find a room', icon: 'compass', onClick: () => router.push('/rooms/find') },
        { label: 'New room', icon: 'compose', onClick: () => router.push('/rooms/new') }
      ]} />}
    </main>
  );
}
