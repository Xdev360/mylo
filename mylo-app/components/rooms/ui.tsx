'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Icon from '../Icon';
import Skeleton from '../system/Skeleton';
import StatusScreen from '../system/StatusScreen';
import { setNext } from '@/lib/signin';
import { COVER_COLOURS, initial, sticker, tone, type Cover, type Member, type Room } from '@/lib/rooms';

/* Small pieces every rooms screen shares. */

export const RIcon = ({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) =>
  <Icon name={`rooms/${name}`} size={size} className={className} />;

/* Full-colour icons (the heart, the flame, the star): drawn as they are. */
export const ArtIcon = ({ name, size = 22 }: { name: string; size?: number }) =>
  <img src={`/figma/rooms/${name}.svg`} alt="" width={size} height={size} className="r-art-icon" />;

/* A face we only know is there (a room seen from outside): a plain disc, not a "?". */
export function Avatar({ name, size = 32, colour, ring = false, me = false }: { name: string; size?: number; colour?: string; ring?: boolean; me?: boolean }) {
  const blank = !name.trim();
  return (
    <span className={`avatar r-avatar${ring ? ' is-ring' : ''}${blank ? ' is-blank' : ''}`}
          style={{ width: size, height: size, background: blank ? undefined : colour ?? (me ? '#2B3150' : tone(name)), fontSize: Math.round(size * 0.38) }}>
      {blank ? null : initial(name)}
    </span>
  );
}

/* Opening a room from a list grows it out of its row, and going back folds
   it into the same row (the view transition named r-open in rooms.css).
   The row being opened, and the room to fold back into, live here. */
export const roomFx = { back: null as string | null };
const canMorph = () => typeof document !== 'undefined' && 'startViewTransition' in document && !matchMedia('(prefers-reduced-motion: reduce)').matches;
export function morphOpen(row: HTMLElement) {
  if (!canMorph() || matchMedia('(min-width: 1024px)').matches) return;
  document.querySelectorAll<HTMLElement>('[style*="r-open"]').forEach(el => { el.style.viewTransitionName = ''; });
  row.style.viewTransitionName = 'r-open';
  document.documentElement.dataset.nav = 'room';
  setTimeout(() => { if (document.documentElement.dataset.nav === 'room') document.documentElement.dataset.nav = 'push'; }, 900);
}
export function morphBack(roomId: string, chat: HTMLElement | null) {
  if (!canMorph() || !chat || matchMedia('(min-width: 1024px)').matches) return;
  roomFx.back = roomId;
  chat.style.viewTransitionName = 'r-open';
  document.documentElement.dataset.nav = 'room-back';
  // The history step stamps "pop" as it lands; this fold wins over it.
  window.addEventListener('popstate', () => { document.documentElement.dataset.nav = 'room-back'; }, { once: true });
  setTimeout(() => { roomFx.back = null; if (document.documentElement.dataset.nav === 'room-back') document.documentElement.dataset.nav = 'pop'; }, 900);
}

export function Avatars({ members, size = 24 }: { members: Member[]; size?: number }) {
  return (
    <span className="r-avatars">
      {members.slice(0, 4).map(m => <Avatar key={m.id} name={m.name} size={size} me={m.id === 'me'} ring />)}
    </span>
  );
}

/* Before a rooms screen has its data: the sign-in state when there is no
   account (rooms live on it), a retry when the server did not answer, and
   the chats skeleton while it loads. */
export function Gate({ signedOut, error, retry, className = 'screen on-desk' }: { signedOut?: boolean; error?: string | null; retry?: () => void; className?: string }) {
  if (signedOut) {
    return (
      <main className={`${className} r-gate`}>
        <span className="r-sent-disc"><img src="/figma/rooms/mylo-sent.svg" alt="" /></span>
        <h1 className="r-sent-title">Sign in to use rooms</h1>
        <p className="t-body c-2 r-center">Your rooms and chats live on your Mylo account.</p>
        <Link href="/signin" className="btn-primary r-bottom-btn" onClick={() => setNext(window.location.pathname + window.location.search)}>Sign in</Link>
      </main>
    );
  }
  if (error) return <main className={`${className} r-gate`}><StatusScreen kind="error" onRetry={retry} cover={false} /></main>;
  return <main className={`${className} r-gate is-loading`} aria-busy="true"><Skeleton variant="chats" /></main>;
}

/* A room's picture: a Mylo room, a photo, or a colour with its letter. */
export function CoverArt({ cover, name, className = '', letter = true }: { cover: Cover; name: string; className?: string; letter?: boolean }) {
  if (cover.kind === 'colour') {
    return (
      <span className={`r-cover is-colour ${className}`} style={{ '--c': cover.colour } as React.CSSProperties}>
        {letter && <span className="r-cover-letter">{initial(name)}</span>}
      </span>
    );
  }
  const src = cover.kind === 'scene' ? `/figma/rooms/scene-${cover.scene}.svg` : cover.src;
  const z = cover.zoom ?? 1;
  return (
    <span className={`r-cover ${className}`}>
      <img src={src} alt="" style={{ transform: `translate(${cover.x ?? 0}%, ${cover.y ?? 0}%) scale(${z})` }} />
    </span>
  );
}

/* The round room badge in a chat header (CT1, CT18): the room's letter on
   amber, as the frames draw it, or the photo when the admin set one. */
export function RoomBadge({ room, size = 40 }: { room: Room; size?: number }) {
  if (room.cover.kind === 'photo') {
    return <span className="r-badge has-art" style={{ width: size, height: size }}><CoverArt cover={room.cover} name={room.name} letter={false} /></span>;
  }
  return <span className="r-badge" style={{ width: size, height: size, fontSize: size * 0.4 }}>{initial(room.name)}</span>;
}

/* A room in a list (CT0 rows, DT5 rows): its letter on the room's colour, or
   its photo. Mylo rooms (scenes) are for the cards and the hero, not rows. */
export const roomColour = (room: Room) => room.cover.kind === 'colour' ? room.cover.colour : tone(room.name, COVER_COLOURS);
export function RoomTile({ room, className = '' }: { room: Room; className?: string }) {
  const cover: Cover = room.cover.kind === 'photo' ? room.cover : { kind: 'colour', colour: roomColour(room) };
  return <CoverArt cover={cover} name={room.name} className={className} />;
}

export function StickerArt({ id, cell }: { id: string; cell: number }) {
  const s = sticker(id);
  const w = Math.round(s.size * cell / 120);
  return (
    <span className="r-sticker" style={{ width: cell, height: cell }}>
      <img src={`/figma/rooms/sticker-${s.id}.svg`} alt={s.label} width={w} height={w} draggable={false} />
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`r-toggle${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

/* A bottom sheet without the title row, for CT10, CT14 and CT21: grabber,
   then the content. Same layer, dim and motion as Sheet. */
export function BareSheet({ open, onClose, label, children, className = '' }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode; className?: string }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={`sheet-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-label={label} className={`sheet r-bare ${className}`}
           style={drag ? { translate: `0 ${drag}px`, transition: 'none' } : undefined}>
        <div className="r-bare-grab"
             onPointerDown={e => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId); }}
             onPointerMove={e => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); }}
             onPointerUp={() => { if (drag > 90) onClose(); start.current = null; setDrag(0); }}>
          <span />
        </div>
        {children}
      </div>
    </div>
  );
}

/* A short line that floats up and goes, for "Copied" and the like. */
export function useToast() {
  const [text, setText] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (s: string) => { setText(s); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setText(null), 2200); };
  const node = <div className={`r-toast${text ? ' is-on' : ''}`} role="status" aria-live="polite">{text}</div>;
  return [node, show] as const;
}

const mq = '(min-width: 1024px)';
export function useDesk() {
  return useSyncExternalStore(
    cb => { const m = matchMedia(mq); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); },
    () => matchMedia(mq).matches,
    () => false
  );
}

/* A row in a settings list: icon box, label, value, chevron. */
export function Row({ icon, label, sub, value, href, onClick, danger, right, tile = 'box' }: {
  icon: string; label: string; sub?: string; value?: string; href?: string; onClick?: () => void; danger?: boolean; right?: React.ReactNode; tile?: 'box' | 'plain';
}) {
  const inner = (
    <>
      <span className={tile === 'box' ? 'r-row-box' : 'r-row-plain'}><RIcon name={icon} size={tile === 'box' ? 24 : 22} /></span>
      <span className="r-row-text"><span className="r-row-label">{label}</span>{sub && <span className="t-caption c-2">{sub}</span>}</span>
      {value && <span className="r-row-value">{value}</span>}
      {right ?? ((href || onClick) && !danger ? <RIcon name="chev" size={22} className="r-row-chev" /> : null)}
    </>
  );
  const cls = `r-row${danger ? ' is-danger' : ''}`;
  if (href) return <Link className={cls} href={href}>{inner}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
  return <div className={cls}>{inner}</div>;
}
