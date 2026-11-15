'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { PopMenu } from './ChatSheets';
import { Avatars, Gate, RIcon, useToast } from './ui';
import { adminName, errText, isMember, rooms, useRooms } from '@/lib/rooms';

/* B4 · Join with a code. The code is looked up as it is typed
   (peek_room_by_code), so the card shows the room before you ask; asking
   leaves a request an admin approves (request_join), the current app's rule.
   Room codes are 6 to 12 letters and numbers; new rooms get 10. */
const MIN = 6;
const MAX = 12;
const BOXES = 10;
const clean = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, MAX);

export default function JoinRoom({ code: start = '' }: { code?: string }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, rooms: mine, snap } = useRooms();
  const [code, setCode] = useState(clean(start));
  const [found, setFound] = useState<{ code: string; id: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState<HTMLElement | null>(null);
  const [toast, say] = useToast();
  const input = useRef<HTMLInputElement>(null);

  const direct = code.length >= MIN ? mine.find(r => r.code.toUpperCase() === code) : undefined;
  useEffect(() => {
    if (!ready || signedOut || code.length < MIN || direct) return;
    let live = true;
    const t = setTimeout(() => {
      rooms.peekCode(code).then(id => { if (live) setFound({ code, id }); }, () => { if (live) setFound({ code, id: null }); });
    }, 350);
    return () => { live = false; clearTimeout(t); };
  }, [code, ready, signedOut, direct]);

  if (!ready) return <Gate signedOut={signedOut} error={error} retry={retry} />;

  const hit = found?.code === code ? found : null;
  const room = direct ?? (hit?.id ? mine.find(r => r.id === hit.id) ?? snap.peeks[hit.id] : undefined);
  const looked = !!direct || !!hit;
  const member = room ? isMember(room) : false;
  const boxes = Math.min(MAX, Math.max(BOXES, code.length));

  async function go() {
    if (!room) { input.current?.focus(); return; }
    if (member) { router.push(`/chats/${room.id}`); return; }
    if (room.asked || busy) return;
    setBusy(true);
    try {
      const res = await rooms.joinByCode(code);
      if (res.status === 'joined') router.push(`/chats/${res.id || room.id}`);
      // LB8: the request is in; that screen says who decides and how you hear back.
      else router.replace(`/rooms/${res.id || room.id}/preview`);
    } catch (e) { say(errText(e)); } finally { setBusy(false); }
  }

  return (
    <main className="screen on-desk r-join">
      <ScreenHeader title="Join a room" fallback="/chats"
                    actions={<button type="button" className="back-btn" aria-label="More" onClick={e => setMenu(e.currentTarget)}><RIcon name="more" size={20} /></button>} />
      <p className="t-body c-2">Enter the code your friend sent.</p>
      <label className={`r-code${boxes > 6 ? ' is-long' : ''}`} onClick={() => input.current?.focus()}>
        <span className="sr-only">Room code</span>
        <input ref={input} autoFocus value={code} inputMode="text" autoCapitalize="characters" autoComplete="one-time-code" maxLength={MAX}
               onChange={e => setCode(clean(e.target.value))}
               onKeyDown={e => { if (e.key === 'Enter') go(); }} />
        {Array.from({ length: boxes }, (_, i) => (
          <span key={i} aria-hidden className={`r-code-box${i === Math.min(code.length, boxes - 1) && code.length < boxes ? ' is-at' : ''}`}>{code[i] ?? ''}</span>
        ))}
      </label>

      {room && (
        <section className="r-pending">
          <div className="r-pending-top">
            <Avatars members={room.members} size={32} />
            <span className="r-pending-text">
              <span className="r-pending-name">{room.name}</span>
              <span className="r-pending-sub">{room.members.length} {room.members.length === 1 ? 'person' : 'people'}{room.peek ? '' : ` · admin: ${adminName(room).toLowerCase()}`}</span>
            </span>
          </div>
          {member
            ? <span className="r-pending-chip is-in">You are in this room</span>
            : room.asked && <span className="r-pending-chip"><img src="/figma/rooms/hourglass.svg" alt="" width={16} height={16} />Request sent · waiting for an admin</span>}
        </section>
      )}
      {looked && !room && <section className="r-pending"><span className="r-pending-chip is-none">No room with that code. Check it with whoever sent it.</span></section>}
      {!looked && code.length >= MIN && <p className="t-caption c-3 r-looking" role="status">Looking for that room…</p>}
      {code.length > 0 && code.length < MIN && <p className="t-caption c-3" role="status">Room codes are {MIN} to {MAX} letters and numbers.</p>}

      <span className="spacer" />
      <button type="button" className="btn-primary r-bottom-btn" onClick={go} aria-busy={busy} aria-disabled={!room || busy || (!!room.asked && !member)}>
        {member ? 'Open' : 'Ask to join'}
      </button>
      {menu && <PopMenu anchor={menu} up={false} onClose={() => setMenu(null)} items={[
        { label: 'Find a room', icon: 'compass', onClick: () => router.push('/rooms/find') },
        { label: 'New room', icon: 'compose', onClick: () => router.push('/rooms/new') }
      ]} />}
      {toast}
    </main>
  );
}
