'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import ScreenHeader from '@/components/ScreenHeader';
import ReportBlockSheet from './ReportBlockSheet';
import { SIcon, useToast } from './ui';
import { firstName, tintFor, useFriends, type Person } from '@/lib/social';
import { useHydrated } from '@/lib/local';

/* FR1 · Friends: the people you have added, a heart to cheer each one, and
   (hold a row, or right-click) report or block (FR3). Starts empty. */
export default function FriendsView() {
  const hydrated = useHydrated();
  const [friends, setFriends] = useFriends();
  const [who, setWho] = useState<Person | null>(null);
  const [toastNode, toast] = useToast();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);

  const hold = (p: Person) => ({
    onPointerDown: () => { held.current = false; timer.current = setTimeout(() => { held.current = true; setWho(p); }, 450); },
    onPointerUp: () => { if (timer.current) clearTimeout(timer.current); },
    onPointerLeave: () => { if (timer.current) clearTimeout(timer.current); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); setWho(p); },
    onClick: (e: React.MouseEvent) => { if (held.current) { e.preventDefault(); held.current = false; } }
  });

  return (
    <main className="screen on-desk sx-friends">
      <ScreenHeader title="Friends" fallback="/feed"
        actions={<Link href="/friends/add" className="back-btn" aria-label="Add a friend"><SIcon name="fr-user-plus" size={20} /></Link>} />
      {hydrated && <>
        <h2 className="t-title-s">Your friends · {friends.length}</h2>
        {friends.length === 0 ? (
          <section className="sx-friends-empty">
            <img src="/figma/social/mylo-empty.svg" alt="" width={100} height={120} />
            <Link href="/friends/add" className="btn-primary"><SIcon name="user-plus" />Add a friend</Link>
          </section>
        ) : (
          <ul className="sx-friend-list">
            {friends.map(f => (
              <li key={f.handle} className="sx-friend">
                <Link href={`/u/${f.handle}`} className="sx-friend-link" {...hold(f)}>
                  <span className="sx-friend-art" style={{ background: tintFor(f.handle) }}><img src="/figma/social/mylo-qr.svg" alt="" /></span>
                  <span className="sx-friend-text">
                    <span className="t-title-s">{f.name}</span>
                    <span className="t-caption c-2">@{f.handle}</span>
                  </span>
                </Link>
                <button type="button" className={`sx-round sx-love${f.loved ? ' is-on' : ''}`} aria-pressed={!!f.loved} aria-label={`Cheer ${firstName(f.name)}`}
                        onClick={() => setFriends(all => all.map(x => x.handle === f.handle ? { ...x, loved: !x.loved } : x))}>
                  <SIcon name="fr-heart" size={20} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>}
      <ReportBlockSheet person={who} open={!!who} onClose={() => setWho(null)} onBlocked={p => toast(`${firstName(p.name)} is blocked`)} />
      {toastNode}
    </main>
  );
}
