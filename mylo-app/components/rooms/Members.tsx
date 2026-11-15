'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import Sheet from '../Sheet';
import { LeaveSheet, useGone } from './ChatSettings';
import { PopMenu } from './ChatSheets';
import { Avatar, Gate, RIcon, useToast } from './ui';
import { ME, errText, isAdmin, joinLink, rooms, useRoom, type Member, type Room } from '@/lib/rooms';

/* LB9 · Members and roles, with the room's link and code to invite people
   (the "Your room link" card from O14). */

export function InviteSheet({ room, open, onClose }: { room: Room; open: boolean; onClose: () => void }) {
  const [toast, say] = useToast();
  const link = joinLink(room);
  const text = `Join ${room.name} on Mylo. Code ${room.code}: ${link}`;
  return (
    <Sheet open={open} onClose={onClose} title="Invite someone" sub="Rooms work best with 2 to 5" labelId="r-invite-title">
      <div className="r-linkcard">
        <span className="r-icon-tile"><RIcon name="link" size={22} /></span>
        <span className="r-pending-text"><span className="r-pending-name">{link.replace(/^https?:\/\//, '')}</span><span className="r-pending-sub">Your room link</span></span>
      </div>
      <div className={`r-codebig${room.code.length > 6 ? ' is-long' : ''}`} aria-label={`Code ${room.code}`}>{room.code.split('').map((c, i) => <span key={i}>{c}</span>)}</div>
      <div className="r-share">
        <button type="button" className="r-share-btn" onClick={() => navigator.clipboard?.writeText(text).then(() => say('Copied'), () => {})}><RIcon name="copy" size={20} />Copy</button>
        <a className="r-share-btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer"><RIcon name="chat-20" size={20} />WhatsApp</a>
        <button type="button" className="r-share-btn" onClick={() => {
          if (navigator.share) navigator.share({ title: room.name, text, url: link }).catch(() => {});
          else navigator.clipboard?.writeText(text).then(() => say('Copied'), () => {});
        }}><RIcon name="share" size={20} />More</button>
      </div>
      {toast}
    </Sheet>
  );
}

const ROLE = { owner: 'Owner', admin: 'Admin', member: 'Member' } as const;
/* LB9 names you as "Dele (you)"; before there is a name, just "You". */
const label = (m: Member) => m.id !== ME ? m.name : m.name && m.name !== 'You' ? `${m.name} (you)` : 'You';

export default function Members({ id, invite = false }: { id: string; invite?: boolean }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, room } = useRoom(id);
  const [inviting, setInviting] = useState(invite);
  const [menu, setMenu] = useState<{ m: Member; el: HTMLElement } | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [toast, say] = useToast();
  useGone(ready, room && !room.peek ? room : null);
  if (!ready || !room || room.peek) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  const run = (p: Promise<unknown>) => { p.catch(e => say(errText(e))); };
  const left = room.capacity - room.members.length;
  const admin = isAdmin(room);
  const order = [...room.members].sort((a, b) => (a.id === ME ? -1 : b.id === ME ? 1 : 0));

  return (
    <main className="screen on-desk r-members">
      <ScreenHeader fallback={`/chats/${room.id}`} />
      <div className="r-members-title">
        <h1 className="screen-header-title r-static">Members</h1>
        <p className="t-caption c-3">{room.members.length} of {room.capacity}  ·  {left} {left === 1 ? 'spot' : 'spots'} left</p>
      </div>
      {room.requests.length > 0 && admin && (
        <section className="r-wantin">
          <h2 className="r-wantin-h">{room.requests.length} want to join</h2>
          {room.requests.map(q => (
            <div key={q.id} className="r-wantin-row">
              <Avatar name={q.name} size={28} /><span className="t-body">{q.name}</span><span className="spacer" />
              <button type="button" className="r-pill-soft" onClick={() => run(rooms.setRequestDecision(room.id, q.id, false))}>Decline</button>
              <button type="button" className="r-pill-dark" disabled={left < 1} onClick={() => run(rooms.setRequestDecision(room.id, q.id, true))}>Approve</button>
            </div>
          ))}
        </section>
      )}
      <div className="card list r-memberlist">
        {order.map(m => (
          <div key={m.id} className="r-member">
            <Avatar name={m.name || 'You'} size={32} me={m.id === ME} />
            <span className="r-member-name">{label(m)}</span>
            <span className={`r-role is-${m.role}`}>{ROLE[m.role]}</span>
            <button type="button" className="r-member-more" aria-label={`More for ${m.id === ME ? 'you' : m.name}`} onClick={e => setMenu({ m, el: e.currentTarget })}>
              <RIcon name="member-more" size={22} />
            </button>
          </div>
        ))}
      </div>
      <section className="card r-admins">
        <h2 className="r-admins-h">What admins can do</h2>
        <p><RIcon name="admin-check" size={18} />Change the room picture and name</p>
        <p><RIcon name="admin-check" size={18} />Approve or decline new people</p>
        <p><RIcon name="admin-check" size={18} />Remove someone from the room</p>
        <p><RIcon name="admin-lock" size={18} />Only the owner can delete the room</p>
      </section>
      <button type="button" className="r-invite" onClick={() => setInviting(true)}><RIcon name="user-plus" size={22} />Invite someone</button>

      {menu && <PopMenu anchor={menu.el} up={false} onClose={() => setMenu(null)} items={menu.m.id === ME
        ? [{ label: 'Room settings', icon: 'room', onClick: () => router.push(`/rooms/${room.id}`) }, { label: 'Leave room', icon: 'logout', danger: true, onClick: () => setLeaving(true) }]
        : admin && menu.m.role !== 'owner' ? [
          menu.m.role === 'admin'
            ? { label: 'Make member', icon: 'room', onClick: () => run(rooms.setRole(room.id, menu.m.id, 'member')) }
            : { label: 'Make admin', icon: 'shield', onClick: () => run(rooms.setRole(room.id, menu.m.id, 'admin')) },
          { label: 'Remove from the room', icon: 'logout', danger: true, onClick: () => run(rooms.remove(room.id, menu.m.id)) }
        ] : [{ label: 'Report', icon: 'flag', danger: true, onClick: () => router.push('/report-a-bug') }]} />}
      <InviteSheet room={room} open={inviting} onClose={() => { setInviting(false); if (invite) router.replace(`/rooms/${room.id}/members`); }} />
      <LeaveSheet room={room} open={leaving} onClose={() => setLeaving(false)} />
      {toast}
    </main>
  );
}
