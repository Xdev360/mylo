'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from './Icon';
import { useStore } from '@/lib/store';

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
  const { openCapture } = useStore();
  return (
    <nav className="tabbar" aria-label="Tabs">
      {TABS.map((t, i) => {
        if (!t) return (
          <button key="add" type="button" className="tab-add" aria-label="Add" onClick={openCapture}>
            <Icon name="tab-plus" />
          </button>
        );
        const on = t.match.some(m => path === m || path.startsWith(m + '/'));
        return (
          <Link key={i} href={t.href} className="tab" aria-current={on ? 'page' : undefined}>
            <Icon name={t.icon} /><span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
