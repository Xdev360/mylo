'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import { useStore } from '@/lib/store';
import { SlidePill, useSlidePill } from './SlidePill';

/* "TabBar · glass" (877:108718): Today · Goals · centre + · Chats · Apps.
   The + opens D1, the capture sheet. Phone and tablet only: from 1024 the
   sidebar takes over. */
const TABS = [
  { href: '/today', label: 'Today', icon: 'tab-today', match: ['/today'] },
  { href: '/goals', label: 'Goals', icon: 'tab-goals', match: ['/goals', '/calendar', '/journal', '/focus', '/plan', '/milestones'] },
  null,
  { href: '/chats', label: 'Chats', icon: 'tab-chats', match: ['/chats', '/rooms', '/friends', '/people'] },
  { href: '/apps', label: 'Apps', icon: 'tab-apps', match: ['/apps', '/games', '/feed', '/challenges', '/vibes', '/eggs', '/pets', '/house', '/visits', '/photo', '/widgets', '/themes', '/style', '/mylo', '/ai', '/rewards', '/level', '/levels', '/streak', '/badges', '/xp', '/chest', '/report-a-bug'] }
] as const;

export default function TabBar() {
  const path = usePathname();
  const { openCapture, captureOpen } = useStore();
  const current = TABS.find(t => t?.match.some(m => path === m || path.startsWith(m + '/')))?.href ?? null;
  // The active pill glides between tabs; the bar itself never moves.
  const track = useSlidePill<HTMLElement>(current);
  return (
    <nav ref={track} className="tabbar slide-track" aria-label="Tabs">
      <SlidePill />
      {TABS.map((t, i) => {
        if (!t) return (
          <button key="add" type="button" className={`tab-add${captureOpen ? ' is-open' : ''}`} aria-label="Add" aria-expanded={captureOpen} onClick={openCapture}>
            <Icon name="tab-plus" />
          </button>
        );
        const on = current === t.href;
        return (
          <Link key={i} href={t.href} className="tab" aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} /><span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
