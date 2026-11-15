'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { gate, type Feature } from '@/lib/apps';
import { streak, useStore } from '@/lib/store';
import { FlameUnlocked, FreezeSheet, LaterSheet, LockedSheet } from './Moments';

/* LX1 · Apps (launch, with locks), 878:114201. The Apps tab's root. A tile
   behind a level opens LX2; one whose release is not out yet opens LX6. The
   result moments that land here from elsewhere open with ?moment=flame (LX3),
   ?moment=freeze (LX4) or ?moment=later (LX6). */
type Tile = { id: string; title: string; sub: string; open?: string; icon: string; href: string; gate?: Feature; badge?: 'flame' | 'blaze' };
const TILES: Tile[] = [
  { id: 'focus', title: 'Focus', sub: '25 min, room muted', icon: 'app-focus', href: '/focus' },
  { id: 'journal', title: 'Journal', sub: 'One line a night', icon: 'app-journal', href: '/journal' },
  { id: 'chest', title: 'Sunday chest', sub: 'Opens at Kindle', icon: 'app-chest', href: '/chest' },
  { id: 'place', title: 'Mylo’s place', sub: 'Your room and looks', icon: 'app-place', href: '/house' },
  { id: 'games', title: 'Games', sub: 'Opens at Flame', open: 'Chess and Chance with your room', icon: 'app-games', href: '/games', gate: 'games', badge: 'flame' },
  { id: 'challenges', title: 'Challenges', sub: 'Opens at Flame', open: 'Dare a friend, or run one together', icon: 'app-challenges', href: '/challenges', gate: 'challenges', badge: 'flame' },
  { id: 'pets', title: 'Pets', sub: 'Opens at Blaze', icon: 'app-pets', href: '/pets', gate: 'pets', badge: 'blaze' },
  { id: 'milestones', title: 'Milestones', sub: 'Mark the big moments', icon: 'app-milestones', href: '/milestones' }
];
/* The rest of Mylo's place lives with the world screens. */
const PLACE = [
  { title: 'House', href: '/house' }, { title: 'Visits', href: '/visits' }, { title: 'Eggs', href: '/eggs' },
  { title: 'Photo studio', href: '/photo' }, { title: 'Mylo style', href: '/style' }, { title: 'Customise Mylo', href: '/mylo' },
  { title: 'Themes', href: '/themes' }, { title: 'Widgets', href: '/widgets' }
];

export default function AppsHub() {
  const router = useRouter();
  const params = useSearchParams();
  const moment = params.get('moment');
  const { items, ready } = useStore();
  const [locked, setLocked] = useState<Feature | null>(null);
  const [later, setLater] = useState(false);
  const clearMoment = () => router.replace('/apps', { scroll: false });

  return (
    <main className="screen on-desk ax-hub">
      <header className="ax-title">
        <h1 className="ax-h1">Apps</h1>
        <p className="ax-14 c-2">Tools that live with Mylo</p>
      </header>

      <Link href="/ai" className="ax-ask">
        <span className="ax-ask-text">
          <span className="t-label ax-ask-label">Mylo AI</span>
          <span className="ax-ask-line">Plan my day around two meetings</span>
          <span className="ax-ask-btn">Ask Mylo</span>
        </span>
        <img className="ax-ask-mylo" src="/figma/apps/mylo-ai.svg" alt="" width={80} height={96} />
      </Link>

      <div className="ax-grid">
        {TILES.map(t => {
          const state = t.gate ? gate(t.gate) : 'open';
          const body = (
            <>
              <img className="ax-app-icon" src={`/figma/apps/${t.icon}.svg`} alt="" width={48} height={48} />
              {state !== 'open' && t.badge && <img className="ax-tile-badge" src={`/figma/apps/badge-${t.badge}.svg`} alt="" width={30} height={30} />}
              <span className="ax-tile-text">
                <span className="ax-tile-title">{t.title}</span>
                <span className="ax-tile-sub">{state === 'open' && t.open ? t.open : t.sub}</span>
              </span>
              {state !== 'open' && <img className="ax-tile-lock" src="/figma/apps/i-lock-18.svg" alt="" width={18} height={18} />}
            </>
          );
          if (state === 'open') return <Link key={t.id} href={t.href} className="ax-tile">{body}</Link>;
          return (
            <button key={t.id} type="button" className="ax-tile is-locked" aria-label={`${t.title}. ${t.sub}. Locked`}
                    onClick={() => (state === 'level' ? setLocked(t.gate!) : setLater(true))}>{body}</button>
          );
        })}
      </div>

      <section className="ax-place" aria-labelledby="ax-place-h">
        <h2 id="ax-place-h" className="ax-h2">Mylo&rsquo;s place</h2>
        <div className="card list ax-place-list">
          {PLACE.map(p => (
            <Link key={p.href} href={p.href} className="ax-row">
              <span className="ax-row-t">{p.title}</span>
              <Icon name="chevron-right" size={20} className="c-3" />
            </Link>
          ))}
        </div>
      </section>

      <LockedSheet feature={locked} onClose={() => setLocked(null)} />
      <LaterSheet open={later || moment === 'later'} onClose={() => { setLater(false); if (moment) clearMoment(); }} />
      <FreezeSheet open={moment === 'freeze'} onClose={clearMoment} streak={ready ? streak(items) : 0} />
      <FlameUnlocked open={moment === 'flame'} onClose={clearMoment} />
    </main>
  );
}
