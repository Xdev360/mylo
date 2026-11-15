'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import ScreenHeader from '../ScreenHeader';
import { RIcon } from './ui';
import { useGone } from './ChatSettings';
import { WALLPAPERS, rooms, useRoom, type WallpaperId } from '@/lib/rooms';

/* CT19 · Chat wallpaper. The locked ones come from chests. */
export default function Wallpaper({ id }: { id: string }) {
  const router = useRouter();
  const { ready, room } = useRoom(id);
  const [pick, setPick] = useState<WallpaperId | null | undefined>(undefined);
  useGone(ready, room);
  if (!ready || !room) return <main className="screen on-desk" aria-busy="true" />;
  const chosen = pick === undefined ? room.wallpaper : pick;
  return (
    <main className="screen on-desk r-wallpaper">
      <ScreenHeader title="Wallpaper" fallback={`/chats/${room.id}/settings`} />
      <p className="t-body-s c-2">Backgrounds you win from chests show up here too.</p>
      <div className="r-wallgrid" role="radiogroup" aria-label="Wallpaper">
        {WALLPAPERS.map(w => (
          <button key={w.id} type="button" role="radio" aria-checked={chosen === w.id} aria-label={w.locked ? `${w.label}, locked` : w.label}
                  aria-disabled={w.locked} className={`r-wall${chosen === w.id ? ' is-on' : ''}${w.locked ? ' is-locked' : ''}`}
                  onClick={() => { if (!w.locked) setPick(chosen === w.id ? null : w.id); }}>
            <img src={`/figma/rooms/wall-${w.id}.svg`} alt="" />
            {w.locked && <span className="r-wall-lock"><RIcon name="lock" size={24} /></span>}
          </button>
        ))}
      </div>
      <span className="spacer" />
      <button type="button" className="btn-primary r-bottom-btn" onClick={() => { rooms.update(room.id, { wallpaper: chosen ?? null }); router.push(`/chats/${room.id}`); }}>Set wallpaper</button>
    </main>
  );
}
