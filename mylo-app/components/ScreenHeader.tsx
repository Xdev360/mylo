'use client';

import { useRouter } from 'next/navigation';
import Icon from './Icon';
import { canGoBack, goBack } from './NavMotion';

/* Pushed screens, handoff §2: 56 high, a 40 round back button at the left,
   the title centred at 17/600, actions at the right. Back goes to the previous
   screen, or to `fallback` when there is none. */
export default function ScreenHeader({ title, fallback = '/today', actions }: { title?: string; fallback?: string; actions?: React.ReactNode }) {
  const router = useRouter();
  return (
    <header className="screen-header">
      <button type="button" className="back-btn" aria-label="Back"
              onClick={() => { if (canGoBack()) goBack(router); else router.push(fallback); }}>
        <Icon name="chevron-right" size={20} className="flip" />
      </button>
      {title && <h1 className="screen-header-title">{title}</h1>}
      <div className="screen-header-actions">{actions}</div>
    </header>
  );
}
