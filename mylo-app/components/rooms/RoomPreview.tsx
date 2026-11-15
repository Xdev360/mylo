'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '../Icon';
import { RoomCard } from './YourRooms';
import { Avatars, CoverArt } from './ui';
import { useGone } from './ChatSettings';
import { adminName, inToday, isMember, roomStreak, rooms, useRoom } from '@/lib/rooms';
import { goBack } from '@/components/NavMotion';

/* LB7 · Room preview, and LB8 · Request sent once you ask. */
export default function RoomPreview({ id }: { id: string }) {
  const router = useRouter();
  const { ready, room, all } = useRoom(id);
  useGone(ready, room, '/rooms/find');
  if (!ready || !room) return <main className="screen on-desk" aria-busy="true" />;
  const mine = isMember(room);
  const admin = adminName(room);
  const back = () => (window.history.length > 1 ? goBack(router) : router.push('/rooms/find'));

  if (room.asked && !mine) {
    return (
      <main className="screen on-desk r-sent">
        <header className="screen-header"><button type="button" className="back-btn" aria-label="Back" onClick={back}><Icon name="chevron-right" size={20} className="flip" /></button></header>
        <span className="r-sent-disc"><img src="/figma/rooms/mylo-sent.svg" alt="" /></span>
        <h1 className="r-sent-title">Request sent</h1>
        <p className="t-body c-2 r-center">{admin} will see it. We will tell you when you are in.</p>
        <RoomCard room={room} list={all} href={`/rooms/${room.id}/preview`} action={null} />
        <span className="spacer" />
        <Link href="/rooms" className="btn-primary r-bottom-btn">Back to rooms</Link>
        <button type="button" className="r-btn-text" onClick={() => rooms.update(room.id, { asked: false })}>Cancel request</button>
      </main>
    );
  }

  const others = room.members.filter(m => m.id !== 'me').map(m => m.name);
  const names = room.members.length === 1 && mine ? 'Only you' : others.length > 3 ? `${others.slice(0, 3).join(', ')} and ${others.length - 3} others` : others.join(', ');
  return (
    <main className="r-preview">
      <div className="r-preview-hero">
        <CoverArt cover={room.cover} name={room.name} className="r-preview-cover" />
        <button type="button" className="back-btn r-preview-back" aria-label="Back" onClick={back}><Icon name="chevron-right" size={20} className="flip" /></button>
      </div>
      <section className="r-preview-panel">
        <div className="r-preview-tags">
          {room.category && <span className="r-tag-grey">{room.category}</span>}
          <span className="r-tag-blue">{room.joinPolicy}</span>
        </div>
        <h1 className="r-preview-name">{room.name}</h1>
        {room.about && <p className="t-body c-2">{room.about}</p>}
        <div className="r-stats">
          <span className="r-stat"><b>{room.members.length} of {room.capacity}</b><span>Members</span></span>
          <span className="r-stat"><b>{roomStreak(all)}</b><span>Day streak</span></span>
          <span className="r-stat"><b>{inToday(all)}</b><span>In today</span></span>
        </div>
        <div className="r-preview-people"><Avatars members={room.members} size={28} /><span className="t-body-s c-2">{names}</span></div>
        {mine
          ? <Link href={`/chats/${room.id}`} className="btn-primary">Open</Link>
          : <button type="button" className="btn-primary" onClick={() => rooms.update(room.id, { asked: true })}>Ask to join</button>}
        <p className="t-caption c-3 r-center">{admin === 'You' ? 'You are the admin and approve new members.' : `${admin} is the admin and approves new members.`}</p>
      </section>
    </main>
  );
}
