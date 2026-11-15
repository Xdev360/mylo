'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import Icon from '@/components/Icon';
import { AchBadge, CloseBtn, Confetti } from './bits';
import type { BadgeState } from '@/lib/rewards';

/* L4 · Badge unlocked (877:120996): the sheet that rises over whatever is on
   screen the first time a badge is earned, with confetti behind it. Shows the
   first earned badge not yet seen; closing it, pinning it or sharing it marks
   it seen. Mount it on any screen; the rewards screens do. */
export default function BadgeWatcher({ badges, seen, onSeen, onPin }: {
  badges: BadgeState[]; seen: string[]; onSeen: (ids: string[]) => void; onPin: (id: string) => void;
}) {
  const b = badges.find(x => x.earned && !seen.includes(x.id));
  useEffect(() => {
    if (!b) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onSeen([b.id]); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [b, onSeen]);
  if (!b) return null;
  const close = () => onSeen([b.id]);
  return (
    <div className="rw-modal" role="dialog" aria-modal="true" aria-labelledby="rw-badge-title">
      <button type="button" className="scrim rw-modal-scrim" aria-label="Close" tabIndex={-1} onClick={close} />
      <Confetti />
      <span className="rw-modal-close"><CloseBtn onClick={close} /></span>
      <div className="rw-modal-sheet">
        <span className="rw-modal-grab" />
        <AchBadge id={b.id} size={176} glow={b.glow} />
        <p className="t-label rw-new">New badge</p>
        <h2 id="rw-badge-title" className="rw-modal-title">{b.title}</h2>
        {b.line && <p className="t-body c-2">{b.line}</p>}
        <button type="button" className="btn-primary rw-wide rw-btn52" onClick={() => { onPin(b.id); close(); }}>
          <Icon name="rewards/i-pin" size={20} />Pin to profile
        </button>
        <Link href={`/rewards/download?kind=badge&id=${b.id}`} className="rw-btn-soft rw-wide" onClick={close}>
          <Icon name="rewards/i-share" size={20} />Share
        </Link>
      </div>
    </div>
  );
}
