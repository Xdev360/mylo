'use client';

import Icon from '@/components/Icon';
import { BackBtn } from './bits';
import { APP_ICONS, LEVELS, useRewards } from '@/lib/rewards';

/* XT2 · App icon (797:91013): pick how Mylo looks on the home screen; new
   ones unlock with levels. The choice is kept; the installed icon follows it
   once the app can set its own icon (a PWA's icon comes from its manifest). */
export default function AppIconView() {
  const r = useRewards();
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const lvl = r.level.index;
  return (
    <main className="screen rw rw-xt2 on-desk">
      <header className="rw-top rw-top-left"><BackBtn fallback="/settings" /></header>
      <div className="rw-xt2-head">
        <h1 className="rw-display">App icon</h1>
        <p className="t-body c-2">Pick how Mylo looks on your home screen. New ones unlock as you level up.</p>
      </div>
      <div className="rw-icons" role="radiogroup" aria-label="App icon">
        {APP_ICONS.map(ic => {
          const open = lvl >= ic.level;
          const on = r.state.appIcon === ic.id;
          const sub = ic.level === 0 ? 'Default' : open ? `Unlocked at ${LEVELS[ic.level].name}` : `Unlocks at ${LEVELS[ic.level].name}`;
          return (
            <button key={ic.id} type="button" role="radio" aria-checked={on} disabled={!open}
                    className={`rw-icon-opt${on ? ' is-on' : ''}`} onClick={() => r.setAppIcon(ic.id)}>
              <img src={`/figma/rewards/icon-${ic.id}.svg`} alt="" width={56} height={56} />
              <span className="rw-icon-text"><span className="rw-icon-name">{ic.name}</span><span className="t-body-s c-2">{sub}</span></span>
              <span className="rw-icon-state">
                {on ? <Icon name="rewards/i-check" size={24} /> : open ? <Icon name="rewards/i-circle" size={24} /> : <Icon name="rewards/i-lock" size={24} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="t-body-s c-3">Your Mylo stays the same inside the app.</p>
    </main>
  );
}
