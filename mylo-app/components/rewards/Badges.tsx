'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import Sheet from '@/components/Sheet';
import { AchBadge } from './bits';
import BadgeWatcher from './BadgeWatcher';
import { shortDay, useRewards, type BadgeState } from '@/lib/rewards';

/* L3 · Badges (877:120945): the pinned badge, then every badge, earned first
   with the day it was earned, the rest locked with what is left to do. Tap
   an earned badge to pin it or share it. */

const left = (b: BadgeState) => b.days ? (b.left === 1 ? '1 day to go' : `${b.left} days to go`) : b.goals ? `${b.left} to go` : 'Not yet';

export default function BadgesView() {
  const r = useRewards();
  const [open, setOpen] = useState<BadgeState | null>(null);
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const earned = r.badges.filter(b => b.earned);
  const list = [...earned, ...r.badges.filter(b => !b.earned)];
  const pinned = r.badges.find(b => b.id === r.state.pinned && b.earned) ?? null;
  return (
    <main className="screen rw on-desk">
      <BadgeWatcher badges={r.badges} seen={r.state.seenBadges} onSeen={r.seeBadges} onPin={r.pin} />
      <ScreenHeader title="Badges" fallback="/rewards" />
      {pinned && (
        <section className="rw-pinned">
          <AchBadge id={pinned.id} size={128} glow={pinned.glow} />
          <h2 className="t-title-m">{pinned.title}</h2>
          <p className="t-body-s c-2">Pinned{pinned.line ? ` · ${pinned.line}` : ''}</p>
        </section>
      )}
      <div className="section-head"><h2 className="t-title-s">Earned</h2><span className="t-body-s c-2">{earned.length} of {r.badges.length}</span></div>
      <div className="rw-bgrid">
        {list.map(b => b.earned ? (
          <button key={b.id} type="button" className="rw-bcell" onClick={() => setOpen(b)}>
            <AchBadge id={b.id} size={99} glow={b.glow} />
            <span className="t-body-s">{b.name}</span>
            <span className="t-caption c-3">{b.at ? shortDay(b.at) : ''}</span>
          </button>
        ) : (
          <div key={b.id} className="rw-bcell">
            <AchBadge id={b.id} earned={false} size={99} />
            <span className="t-body-s c-2">{b.name}</span>
            <span className="t-caption c-3">{left(b)}</span>
          </div>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''} sub={open?.line}>
        {open && <>
          <div className="rw-bsheet"><AchBadge id={open.id} size={128} glow={open.glow} /></div>
          <button type="button" className="btn-primary rw-wide" onClick={() => { r.pin(r.state.pinned === open.id ? null : open.id); setOpen(null); }}>
            <Icon name="rewards/i-pin" size={20} />{r.state.pinned === open.id ? 'Unpin' : 'Pin to profile'}
          </button>
          <Link href={`/rewards/download?kind=badge&id=${open.id}`} className="rw-btn-soft rw-wide"><Icon name="rewards/i-share" size={20} />Share</Link>
        </>}
      </Sheet>
    </main>
  );
}
