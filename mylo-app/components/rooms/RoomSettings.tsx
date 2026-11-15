'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import Sheet from '../Sheet';
import RoomPreview from './RoomPreview';
import { Choices, LeaveSheet, useGone } from './ChatSettings';
import { PopMenu } from './ChatSheets';
import { RoomCard } from './YourRooms';
import { Avatars, CoverArt, Gate, RIcon, Row, Toggle, useToast } from './ui';
import { COVER_COLOURS, SCENES, adminName, caps, errText, isAdmin, isMember, roomStreak, rooms, shrinkPhoto, useRoom, wallpaper, type Cover, type Message, type Notify, type Room } from '@/lib/rooms';


/* LB2 · Room settings (admin) and LB5 (member), with LB3 · Change room
   picture and LB4 · Move and zoom. Someone who is not in the room gets LB7. */

function PictureSheet({ room, open, onClose, onPicked }: { room: Room; open: boolean; onClose: () => void; onPicked: (c: Cover) => void }) {
  const [pick, setPick] = useState<Cover>(room.cover);
  const [toast, say] = useToast();
  const cam = useRef<HTMLInputElement>(null);
  const lib = useRef<HTMLInputElement>(null);
  async function file(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { onPicked({ kind: 'photo', src: await shrinkPhoto(f, 900), zoom: 1, x: 0, y: 0 }); } catch { say('Could not read that photo'); }
  }
  const on = (c: Cover) => JSON.stringify(c) === JSON.stringify(pick) || (c.kind === 'scene' && pick.kind === 'scene' && c.scene === pick.scene);
  return (
    <Sheet open={open} onClose={onClose} title="Room picture" sub="Everyone sees it in the room and in Find a room." labelId="r-pic-title">
      <div className="r-two">
        <button type="button" className="r-option" onClick={() => cam.current?.click()}><RIcon name="camera" size={22} />Take a photo</button>
        <button type="button" className="r-option" onClick={() => lib.current?.click()}><RIcon name="photo-22" size={22} />Choose a photo</button>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={file} />
      <input ref={lib} type="file" accept="image/*" hidden onChange={file} />
      <h3 className="t-title-s r-pic-h">Or pick a Mylo room</h3>
      <div className="r-scenes" role="radiogroup" aria-label="Mylo rooms">
        {SCENES.map(s => {
          const c: Cover = { kind: 'scene', scene: s.id };
          return (
            <button key={s.id} type="button" role="radio" aria-checked={on(c)} aria-label={s.label} className={`r-scene${on(c) ? ' is-on' : ''}`} onClick={() => setPick(c)}>
              <CoverArt cover={c} name={room.name} />
              {on(c) && <span className="r-scene-tick"><img src="/figma/rooms/selected.svg" alt="" width={24} height={24} /></span>}
            </button>
          );
        })}
      </div>
      {caps.coverColour && <>
        <h3 className="t-title-s r-pic-h">Or a colour</h3>
        <div className="r-colours" role="radiogroup" aria-label="Colour">
          {COVER_COLOURS.map(c => {
            const cv: Cover = { kind: 'colour', colour: c };
            return <button key={c} type="button" role="radio" aria-checked={on(cv)} aria-label={c} className={`r-colour${on(cv) ? ' is-on' : ''}`} style={{ '--c': c } as React.CSSProperties} onClick={() => setPick(cv)} />;
          })}
        </div>
      </>}
      <p className="r-note"><RIcon name="lock-16" size={16} />Only admins can change this. Members see who set it.</p>
      <button type="button" className="btn-primary" onClick={() => onPicked(pick)}>Use this picture</button>
      {toast}
    </Sheet>
  );
}

/* LB4: drag to move, the slider to zoom, and how it will look in Find a room. */
function MoveZoom({ room, all, cover, onCancel, onSave }: { room: Room; all: Message[]; cover: Exclude<Cover, { kind: 'colour' }>; onCancel: () => void; onSave: (c: Cover) => void }) {
  const [c, setC] = useState(cover);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const z = c.zoom ?? 1;
  const clamp = (v: number) => Math.max(-50 * (z - 1) / z, Math.min(50 * (z - 1) / z, v));
  return (
    <main className="screen on-desk r-movezoom">
      <header className="screen-header">
        <button type="button" className="back-btn" aria-label="Close" onClick={onCancel}><RIcon name="close-20" size={20} /></button>
        <h1 className="screen-header-title">Move and zoom</h1>
      </header>
      <div ref={frame} className="r-mz-frame"
           onPointerDown={e => { (e.target as Element).setPointerCapture?.(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, cx: c.x ?? 0, cy: c.y ?? 0 }; }}
           onPointerMove={e => {
             const d = drag.current; const box = frame.current; if (!d || !box) return;
             setC({ ...c, x: clamp(d.cx + (e.clientX - d.x) * 100 / box.offsetWidth / z), y: clamp(d.cy + (e.clientY - d.y) * 100 / box.offsetHeight / z) });
           }}
           onPointerUp={() => { drag.current = null; }}>
        <CoverArt cover={c} name={room.name} className="r-mz-cover" />
        <span className="r-mz-grid" aria-hidden />
      </div>
      <div className="r-mz-zoom">
        <RIcon name="minus" size={20} />
        <input type="range" min={1} max={3} step={0.01} value={z} aria-label="Zoom"
               onChange={e => { const nz = +e.target.value; setC({ ...c, zoom: nz, x: Math.max(-50 * (nz - 1) / nz, Math.min(50 * (nz - 1) / nz, c.x ?? 0)), y: Math.max(-50 * (nz - 1) / nz, Math.min(50 * (nz - 1) / nz, c.y ?? 0)) }); }}
               style={{ '--p': `${(z - 1) * 50}%` } as React.CSSProperties} />
        <RIcon name="plus-20" size={20} />
      </div>
      <p className="t-label c-3">How it looks in Find a room</p>
      <RoomCard room={{ ...room, cover: c }} list={all} href={`/rooms/${room.id}/preview`} action={<span className="r-pill-dark">Ask to join</span>} find />
      <button type="button" className="btn-primary" onClick={() => onSave(c)}>Save picture</button>
      <button type="button" className="r-btn-text" onClick={onCancel}>Cancel</button>
    </main>
  );
}

function NameSheet({ room, open, onClose, onError }: { room: Room; open: boolean; onClose: () => void; onError: (text: string) => void }) {
  const [name, setName] = useState(room.name);
  const [about, setAbout] = useState(room.about);
  return (
    <Sheet open={open} onClose={onClose} title="Name and description" labelId="r-name-title">
      <label className="r-field"><span className="r-field-label">Room name</span>
        <input className="r-field-input" value={name} maxLength={40} onChange={e => setName(e.target.value)} /></label>
      <label className="r-field"><span className="r-field-label">Description</span>
        <input className="r-field-input" value={about} maxLength={80} placeholder="Gym every weekday. No excuses." onChange={e => setAbout(e.target.value)} /></label>
      <button type="button" className="btn-primary" aria-disabled={!name.trim()}
              onClick={() => {
                if (!name.trim()) return;
                const patch: Partial<Room> = {};
                if (name.trim() !== room.name) patch.name = name.trim();
                if (about.trim() !== room.about) patch.about = about.trim();
                rooms.update(room.id, patch).catch(e => onError(errText(e)));
                onClose();
              }}>Save</button>
    </Sheet>
  );
}

export default function RoomSettings({ id }: { id: string }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, room, all } = useRoom(id);
  const [sheet, setSheet] = useState<null | 'picture' | 'name' | 'notify' | 'join' | 'leave'>(null);
  const [moving, setMoving] = useState<Exclude<Cover, { kind: 'colour' }> | null>(null);
  const [more, setMore] = useState<HTMLElement | null>(null);
  const [toast, say] = useToast();
  useGone(ready, room, '/rooms');
  if (!ready || !room) return <Gate signedOut={signedOut} error={error} retry={retry} />;
  if (!isMember(room)) return <RoomPreview id={id} />;
  const admin = isAdmin(room);
  const set = (p: Partial<Room>) => { rooms.update(room.id, p).catch(e => say(errText(e))); };
  const streak = roomStreak(all);
  const owner = adminName(room);
  const wp = wallpaper(room.wallpaper);

  if (moving) return <MoveZoom room={room} all={all} cover={moving} onCancel={() => setMoving(null)} onSave={c => { set({ cover: c }); setMoving(null); }} />;

  return (
    <main className="screen on-desk r-roomset">
      <ScreenHeader title="Room settings" fallback={`/chats/${room.id}`}
                    actions={<button type="button" className="back-btn" aria-label="More" onClick={e => setMore(e.currentTarget)}><RIcon name="more" size={20} /></button>} />
      <div className="r-roomset-hero">
        <CoverArt cover={room.cover} name={room.name} className="r-roomset-cover" />
        {admin
          ? <>
              <span className="r-tag-blue r-hero-tag">You are the admin</span>
              <button type="button" className="r-glass-pill" onClick={() => setSheet('picture')}><RIcon name="camera" size={18} />Change picture</button>
            </>
          : <span className="r-glass-pill is-left"><RIcon name="lock-16" size={16} />Only admins can change the picture</span>}
      </div>
      <h1 className="r-roomset-name">{room.name}</h1>
      {room.about && <p className="t-body c-2">{room.about}</p>}
      <div className="r-roomset-people">
        <Avatars members={room.members} />
        <span className="t-caption c-2">{room.members.length} of {room.capacity} members{streak ? `  ·  ${streak}-day room streak` : ''}</span>
      </div>

      <p className="t-label c-3 r-sec">Room</p>
      <div className="card list r-group">
        {admin ? <>
          <Row tile="plain" icon="photo-22" label="Room picture" sub="Shows in the room and in Find a room" onClick={() => setSheet('picture')} />
          <Row tile="plain" icon="pencil-22" label="Name and description" sub={room.name} onClick={() => setSheet('name')} />
          <Row tile="plain" icon="palette" label="Chat theme" value={wp?.label ?? 'None'} href={`/chats/${room.id}/wallpaper`} />
        </> : (
          <Row tile="plain" icon="photo-22" label="Room picture" sub={`Set by ${owner}, the admin`} right={<RIcon name="lock-16" size={16} className="c-3" />} />
        )}
        <Row tile="plain" icon="bell-22" label="Notifications" value={room.notify} onClick={() => setSheet('notify')} />
        {!admin && <Row tile="plain" icon="eye-22" label="What the room sees" value="Tasks only" href="/settings" />}
      </div>

      {admin && <>
        <p className="t-label c-3 r-sec">Joining</p>
        <div className="card list r-group">
          {caps.joinPolicy && <Row tile="plain" icon="user-plus" label="Who can join" value={room.joinPolicy} onClick={() => setSheet('join')} />}
          <Row tile="plain" icon="compass" label="Show in Find a room" right={<Toggle label="Show in Find a room" on={room.findable} onChange={v => set({ findable: v })} />} />
          <Row tile="plain" icon="shield" label="Join requests" value={room.requests.length ? `${room.requests.length} waiting` : 'None'} href={`/rooms/${room.id}/requests`} />
        </div>
      </>}

      <p className="t-label c-3 r-sec">People</p>
      <div className="card list r-group">
        <Row tile="plain" icon="room-22" label={admin ? 'Members and roles' : 'Members'} value={`${room.members.length} of ${room.capacity}`} href={`/rooms/${room.id}/members`} />
        <Row tile="plain" icon="logout-22" label="Leave room" danger onClick={() => setSheet('leave')} />
      </div>

      <PictureSheet room={room} open={sheet === 'picture'} onClose={() => setSheet(null)}
                    onPicked={c => { setSheet(null); if (c.kind === 'colour') set({ cover: c }); else setMoving(c); }} />
      {sheet === 'name' && <NameSheet room={room} open onClose={() => setSheet(null)} onError={say} />}
      <Choices open={sheet === 'notify'} title="Notifications" options={['All messages', 'Check-ins and cheers', 'Off'] as const}
               value={room.notify} onPick={(v: Notify) => set({ notify: v })} onClose={() => setSheet(null)} />
      <Choices open={sheet === 'join'} title="Who can join" options={['Ask to join', 'Anyone with the code'] as const}
               value={room.joinPolicy} onPick={v => set({ joinPolicy: v })} onClose={() => setSheet(null)} />
      <LeaveSheet room={room} open={sheet === 'leave'} onClose={() => setSheet(null)} />
      {more && <PopMenu anchor={more} up={false} onClose={() => setMore(null)} items={[
        { label: 'Open chat', icon: 'chat-20', onClick: () => router.push(`/chats/${room.id}`) },
        { label: 'Invite someone', icon: 'user-plus', onClick: () => router.push(`/rooms/${room.id}/members?invite=1`) },
        { label: 'How it looks in Find a room', icon: 'compass', onClick: () => router.push(`/rooms/${room.id}/preview`) }
      ]} />}
      {toast}
    </main>
  );
}
