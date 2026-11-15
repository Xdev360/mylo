'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import Sheet from '../Sheet';
import { Gate, RIcon, RoomBadge, Row, Toggle, useToast } from './ui';
import { CHAT_COLOURS, WALLPAPERS, caps, errText, people, rooms, useRoom, type Disappear, type Notify, type Room } from '@/lib/rooms';

/* CT18 · Chat settings: colour, wallpaper and the chat's switches. */

export function Choices<T extends string>({ open, title, sub, options, value, onPick, onClose }: {
  open: boolean; title: string; sub?: string; options: readonly T[]; value: T; onPick: (v: T) => void; onClose: () => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} sub={sub} labelId={`r-choice-${title.replace(/\W+/g, '-')}`}>
      <div className="card list r-choices" role="radiogroup" aria-label={title}>
        {options.map(o => (
          <button key={o} type="button" role="radio" aria-checked={o === value} className="r-choice" onClick={() => { onPick(o); onClose(); }}>
            <span>{o}</span>{o === value && <img src="/figma/rooms/selected.svg" alt="" width={24} height={24} />}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

export function LeaveSheet({ room, open, onClose }: { room: Room; open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [toast, say] = useToast();
  async function leave() {
    if (busy) return;
    setBusy(true);
    try { await rooms.leave(room.id); onClose(); router.replace('/chats'); }
    catch (e) { say(errText(e)); setBusy(false); }
  }
  return (
    <Sheet open={open} onClose={onClose} title={`Leave ${room.name}?`} sub="You will lose access to the chat and shared goals. Friends can invite you back." labelId="r-leave-title">
      <div className="r-two">
        <button type="button" className="r-btn-soft" onClick={onClose}>Stay</button>
        <button type="button" className="btn-primary r-btn-danger" onClick={leave} aria-busy={busy} aria-disabled={busy}>Leave room</button>
      </div>
      {toast}
    </Sheet>
  );
}

export function useGone(ready: boolean, room: unknown, to = '/chats') {
  const router = useRouter();
  useEffect(() => { if (ready && !room) router.replace(to); }, [ready, room, router, to]);
}

export default function ChatSettings({ id }: { id: string }) {
  const { ready, signedOut, error, retry, room, all } = useRoom(id);
  const [sheet, setSheet] = useState<null | 'notify' | 'disappear' | 'leave'>(null);
  const [toast, say] = useToast();
  useGone(ready, room && !room.peek ? room : null);
  if (!ready || !room || room.peek) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const since = new Date(room.createdAt).toLocaleDateString('en-GB', { month: 'long' });
  const media = all.filter(m => !m.deleted && (m.kind === 'photo' || m.kind === 'voice')).length;
  const pinned = room.pinned.filter(p => all.some(m => m.id === p && !m.deleted));
  const set = (patch: Partial<Room>) => { rooms.update(room.id, patch).catch(e => say(errText(e))); };
  // CT18 shows City night, Forest and Sky; the one in use always comes first.
  const row = ['city', 'forest', 'sky', 'sunrise', 'beach', 'space'].map(id => WALLPAPERS.find(w => w.id === id)!);
  const current = row.find(w => w.id === room.wallpaper);
  const firstThree = (current ? [current, ...row.filter(w => w !== current)] : row).slice(0, 3);

  return (
    <main className="screen on-desk r-settings">
      <ScreenHeader title={room.name} fallback={`/chats/${room.id}`} />
      <section className="r-settings-hero">
        <RoomBadge room={room} size={80} />
        <h2 className="r-settings-name">{room.name}</h2>
        <p className="t-body-s c-2">{people(room)}  ·  since {since}</p>
      </section>

      <h3 className="r-h3">Chat colour</h3>
      <div className="r-colours" role="radiogroup" aria-label="Chat colour">
        {CHAT_COLOURS.map(c => (
          <button key={c} type="button" role="radio" aria-checked={room.colour === c} aria-label={c === 'var(--primary)' ? 'Ink' : c}
                  className={`r-colour${room.colour === c ? ' is-on' : ''}`} style={{ '--c': c } as React.CSSProperties} onClick={() => set({ colour: c })} />
        ))}
      </div>

      <h3 className="r-h3">Wallpaper</h3>
      <div className="r-wallrow">
        {firstThree.map(w => (
          <button key={w.id} type="button" aria-label={w.label} aria-pressed={room.wallpaper === w.id}
                  className={`r-wall${room.wallpaper === w.id ? ' is-on' : ''}`} onClick={() => set({ wallpaper: room.wallpaper === w.id ? null : w.id })}>
            <img src={`/figma/rooms/wall-${w.id}.svg`} alt="" />
          </button>
        ))}
        <Link href={`/chats/${room.id}/wallpaper`} className="r-wall is-more" aria-label="All wallpapers"><RIcon name="chev" size={24} /></Link>
      </div>

      <div className="r-rows">
        <Row icon="bell" label="Notifications" value={room.notify} onClick={() => setSheet('notify')} />
        <Row icon="photo" label="Media, voice and files" value={String(media)} href={`/chats/${room.id}/media`} />
        <Row icon="pin" label="Pinned messages" value={String(pinned.length)} href={pinned.length ? `/chats/${room.id}#m-${pinned[pinned.length - 1]}` : `/chats/${room.id}`} />
        <Row icon="room" label="Members" value={String(room.members.length)} href={`/rooms/${room.id}/members`} />
        {caps.disappear && <Row icon="lock-24" label="Disappearing messages" value={room.disappear} onClick={() => setSheet('disappear')} />}
        <Row icon="eye" label="Read receipts" right={<Toggle label="Read receipts" on={room.readReceipts} onChange={v => set({ readReceipts: v })} />} />
      </div>
      <div className="r-rows">
        <Row icon="bell" label="Mute chat" right={<Toggle label="Mute chat" on={room.muted} onChange={v => set({ muted: v })} />} />
        <Row icon="logout" label={`Leave ${room.name}`} danger onClick={() => setSheet('leave')} />
        <Row icon="flag" label="Report room" danger href="/report-a-bug" />
      </div>

      <Choices open={sheet === 'notify'} title="Notifications" options={['All messages', 'Check-ins and cheers', 'Off'] as const}
               value={room.notify} onPick={(v: Notify) => set({ notify: v })} onClose={() => setSheet(null)} />
      <Choices open={sheet === 'disappear'} title="Disappearing messages" options={['Off', '24 hours', '7 days'] as const}
               value={room.disappear} onPick={(v: Disappear) => set({ disappear: v })} onClose={() => setSheet(null)} />
      <LeaveSheet room={room} open={sheet === 'leave'} onClose={() => setSheet(null)} />
      {toast}
    </main>
  );
}
