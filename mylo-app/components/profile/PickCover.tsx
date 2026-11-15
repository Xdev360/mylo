'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { useHydrated } from '@/lib/local';
import Room from './Room';
import { useRoom } from './ProfileView';
import { COVERS, sameRoom } from './room-data';

/* P21 · Pick cover (879:180746). A cover is a whole room; using one puts
   that room behind the profile. Locked rooms show where they come from. */
export default function PickCover() {
  const hydrated = useHydrated();
  const router = useRouter();
  const [room, setRoom] = useRoom();
  const current = COVERS.find(c => !c.locked && sameRoom(c.room, room))?.id ?? null;
  const [pick, setPick] = useState<string | null>(null);
  if (!hydrated) return <main className="screen on-desk" aria-busy="true" />;
  const chosen = pick ?? current;

  return (
    <main className="screen on-desk pf-cover-pick">
      <ScreenHeader title="Profile cover" fallback="/profile/edit" />
      <p className="t-body c-2 pf-lead">Your cover is one of your rooms. Win new walls, floors and backgrounds from chests.</p>
      <div className="pf-covers" role="radiogroup" aria-label="Profile cover">
        {COVERS.map(c => {
          const on = chosen === c.id;
          return (
            <button key={c.id} type="button" role="radio" aria-checked={on} aria-disabled={Boolean(c.locked)}
                    className={`pf-cover-opt${on ? ' is-on' : ''}${c.locked ? ' is-locked' : ''}`}
                    onClick={() => { if (c.locked) router.push('/chest'); else setPick(c.id); }}>
              <span className="pf-cover-thumb">
                <Room room={c.room} H={298} F={198} />
                {c.locked && <><span className="pf-veil" /><span className="pf-lock is-big"><Icon name="profile/lock" size={16} /></span></>}
                {on && <span className="pf-opt-check is-big"><Icon name="check" size={16} /></span>}
              </span>
              <span className={c.locked ? 'pf-opt-from is-big' : 't-body pf-cover-label'}>{c.locked ?? c.label}</span>
            </button>
          );
        })}
      </div>
      <button type="button" className="btn-primary pf-wide pf-bottom-btn" disabled={!chosen}
              onClick={() => {
                const c = COVERS.find(x => x.id === chosen);
                if (c) setRoom(prev => ({ ...c.room, decor: c.room.decor.map(d => prev.decor.find(p => p.kind === d.kind) ?? d) }));
                router.push('/profile');
              }}>
        Use as cover
      </button>
    </main>
  );
}
