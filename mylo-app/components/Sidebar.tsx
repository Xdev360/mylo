'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import Icon from './Icon';
import { useSession } from '@/lib/session';
import { SlidePill, useSlidePill } from './SlidePill';

/* DT2's sidebar, Figma 943:27302: the wordmark, then Today, Goals, Rooms,
   Mylo AI, Apps, Rewards, with you at the foot. Desktop only; the phone has
   the tab bar. It folds to its icons for a wider view, like the website's,
   and remembers. The icons never move when it folds. */
export const NAV = [
  { href: '/today', label: 'Today', icon: 'nav-today', match: ['/today'] },
  { href: '/goals', label: 'Goals', icon: 'nav-goals', match: ['/goals', '/calendar', '/journal', '/focus', '/plan', '/milestones'] },
  { href: '/chats', label: 'Rooms', icon: 'nav-rooms', match: ['/chats', '/rooms', '/friends', '/people'] },
  { href: '/ai', label: 'Mylo AI', icon: 'nav-ai', match: ['/ai'] },
  { href: '/apps', label: 'Apps', icon: 'nav-apps', match: ['/apps', '/games', '/feed', '/challenges', '/vibes', '/eggs', '/pets', '/house', '/visits', '/photo', '/widgets', '/themes', '/style', '/mylo'] },
  { href: '/rewards', label: 'Rewards', icon: 'nav-rewards', match: ['/rewards', '/level', '/levels', '/streak', '/badges', '/xp', '/chest', '/report-a-bug'] }
];
const KEY = 'mylo.side';
const subscribe = (cb: () => void) => { window.addEventListener('mylo-side', cb); return () => window.removeEventListener('mylo-side', cb); };
const read = () => document.documentElement.dataset.side === 'rail';

export default function Sidebar() {
  const path = usePathname();
  const { session, loading, name, profile } = useSession();
  const folded = useSyncExternalStore(subscribe, read, () => false);
  const current = NAV.find(n => n.match.some(m => path === m || path.startsWith(m + '/')))?.href ?? null;
  // The highlight slides between items as you move; it follows the fold too.
  const track = useSlidePill<HTMLElement>(`${current}|${folded}`);
  function toggle() {
    const next = !folded;
    if (next) document.documentElement.dataset.side = 'rail'; else delete document.documentElement.dataset.side;
    try { if (next) localStorage.setItem(KEY, 'rail'); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
    window.dispatchEvent(new Event('mylo-side'));
  }
  return (
    <aside className="sidebar" aria-label="Mylo">
      <div className="side-top">
        <Link href="/today" className="side-logo" title="Mylo">
          <img src="/brand/mylo-logo-96.webp" alt="" width={32} height={32} className="side-logo-img" />
          <span className="side-label">mylo</span>
        </Link>
        <button type="button" className="side-fold" onClick={toggle} aria-label={folded ? 'Open sidebar' : 'Fold sidebar'} aria-expanded={!folded}>
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
      <nav ref={track} className="side-nav slide-track">
        <SlidePill />
        {NAV.map(n => {
          const on = current === n.href;
          return (
            <Link key={n.href} href={n.href} className="side-item" aria-current={on ? 'page' : undefined} title={n.label}>
              <Icon name={n.icon} size={20} /><span className="side-label">{n.label}</span>
            </Link>
          );
        })}
      </nav>
      <span className="spacer" />
      {!loading && !session
        ? <Link href="/welcome" className="side-item side-me" title="Sign in"><Icon name="nav-me" size={20} /><span className="side-label">Sign in</span></Link>
        : <Link href="/profile" className="side-me" aria-current={path.startsWith('/profile') || path.startsWith('/settings') ? 'page' : undefined} title={name ?? 'You'}>
            {/* DT2's "Me" (943:27378): you, your name, your handle. */}
            <Me photo={profile?.avatar_url ?? null} name={name} size={36} />
            <span className="side-me-text side-label">
              <span className="side-me-name">{name ?? 'You'}</span>
              <span className="side-me-sub">{profile?.username ? `@${profile.username}` : 'Your profile'}</span>
            </span>
          </Link>}
    </aside>
  );
}

/* You, as the top bar and the sidebar draw you: your photo, or your initial
   on navy; the Mylo picture until there is a name. */
export function Me({ photo, name, size }: { photo: string | null; name: string | null; size: number }) {
  const initial = (name?.trim()[0] ?? '').toUpperCase();
  if (photo) return <img className="me-av" src={photo} alt="" width={size} height={size} />;
  if (!initial) return <img className="me-av" src="/brand/mylo-logo-96.webp" alt="" width={size} height={size} />;
  return <span className="me-av is-initial" style={{ width: size, height: size }}>{initial}</span>;
}
