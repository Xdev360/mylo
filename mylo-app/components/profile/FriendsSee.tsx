'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { useHydrated } from '@/lib/local';
import { useProfile } from '@/lib/profile';
import { leave } from '@/lib/system';
import { Tabs } from './bits';

/* P22a/b/c · What friends see: Cards (877:115754), Pets (877:116472),
   Badges (877:116618). You pick what shows, in order. A new account has no
   cards, pets or badges yet, so each tab says where they come from. */
const TABS = [
  { id: 'cards', label: 'Cards', max: 5 },
  { id: 'pets', label: 'Pets', max: 6 },
  { id: 'badges', label: 'Badges', max: 6 }
] as const;
type Tab = typeof TABS[number]['id'];

const LOCKED = ['badge-streak-3-locked', 'badge-streak-7-locked', 'badge-first-win-locked', 'badge-streak-21-locked', 'badge-streak-30-locked'];

export default function FriendsSee() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { profile: p } = useProfile();
  const first = (TABS.find(t => t.id === params.get('tab'))?.id ?? 'cards') as Tab;
  /* The tab is kept in the address (so a reload or a shared link opens it)
     without a navigation, so the pill slides and the panel moves. */
  const [state, setState] = useState<{ tab: Tab; dir: 'fwd' | 'back' | null }>({ tab: first, dir: null });
  const tab = state.tab;
  const T = TABS.find(t => t.id === tab)!;
  const pick = (id: Tab) => {
    if (id === tab) return;
    const order = TABS.map(t => t.id) as Tab[];
    setState({ tab: id, dir: order.indexOf(id) > order.indexOf(tab) ? 'fwd' : 'back' });
    window.history.replaceState(window.history.state, '', `/profile/showcase?tab=${id}`);
  };
  if (!hydrated) return <main className="screen on-desk" aria-busy="true" />;
  const picked = tab === 'cards' ? p.showcase : tab === 'pets' ? p.pets : p.badges;

  return (
    <main className="screen on-desk pf-see">
      <ScreenHeader title="What friends see" fallback="/profile/edit" />
      <Tabs tabs={TABS} value={tab} onChange={pick} label="What friends see" className="is-three" />
      <div className={`pf-see-body${state.dir ? ` pf-pane is-${state.dir}` : ''}`} key={tab} role="tabpanel">
      <div className="pf-see-head">
        <p className="t-body c-2">Pick up to {T.max}. They show in this order.</p>
        <span className="pf-count t-body-s">{picked.length} of {T.max}</span>
      </div>

      {tab === 'cards' && (
        <Link href="/rewards/collection" className="pf-info">
          <Icon name="profile/layers" size={24} className="c-2" />
          <span className="t-body-s c-2">Cards come from your Sunday chest. Pick up to 5 to show here.</span>
        </Link>
      )}
      {tab === 'pets' && (
        <Link href="/eggs" className="pf-info">
          <Icon name="profile/egg" size={24} className="c-2" />
          <span className="t-body-s c-2">Hatch an egg to get your first pet.</span>
        </Link>
      )}
      {tab === 'badges' && <>
        <div className="pf-see-badges">
          {LOCKED.map(b => <img key={b} src={`/figma/profile/${b}.svg`} alt="Locked badge" width={80} height={80} className="pf-badge" />)}
        </div>
        <p className="t-body-s c-3">Locked badges cannot be shown yet.</p>
      </>}
      </div>

      <button type="button" className="btn-primary pf-wide pf-bottom-btn" onClick={() => leave(router, '/profile/edit')}>Save</button>
    </main>
  );
}
