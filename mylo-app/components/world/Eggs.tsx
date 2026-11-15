'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useLocal } from '@/lib/local';
import { useStore } from '@/lib/store';
import { todayIso } from '@/lib/dates';
import { activeDays, HATCH_DAYS, KEYS, type Egg } from '@/lib/world';
import { WorldHeader, WorldPage, wi } from './ui';

/* EG1 · You found an egg (879:178114) until it is kept warm, then
   EG2 · Hatching soon (879:178134): five active days and it hatches into
   the first pet, which lives at /pets. */
export default function Eggs() {
  return <WorldPage className="w-egg-screen"><EggBody /></WorldPage>;
}

function EggBody() {
  const router = useRouter();
  const { items } = useStore();
  const [egg, setEgg] = useLocal<Egg>(KEYS.egg, { foundOn: null });
  const { days, today } = activeDays(items, egg.foundOn);
  const hatched = days >= HATCH_DAYS;
  useEffect(() => { if (hatched) router.replace('/pets'); }, [hatched, router]);

  if (!egg.foundOn) {
    return (
      <>
        <WorldHeader kind="close" fallback="/apps" />
        <div className="w-egg-intro">
          <p className="t-label w-amber">New at Blaze</p>
          <h1 className="w-display-s">You found an egg</h1>
          <p className="t-body c-2 w-egg-lede">Show up for 5 days and it hatches into your first pet.</p>
        </div>
        <div className="w-egg-stage" aria-hidden>
          <span className="w-egg-floor" />
          <img className="w-egg-art" src="/figma/world/egg-new.svg" alt="" />
          <span className="w-spark w-spark-a"><Icon name={wi('sparkle')} size={28} /></span>
          <span className="w-spark w-spark-b"><Icon name={wi('sparkle')} size={20} /></span>
        </div>
        <p className="w-pill"><Icon name={wi('bolt')} size={18} className="w-amber" />{HATCH_DAYS} active days to hatch</p>
        <div className="spacer" />
        <button type="button" className="btn-primary w-wide" onClick={() => setEgg({ foundOn: todayIso() })}>Keep it warm</button>
        <p className="t-caption c-3 w-center">It lives in Mylo’s room</p>
      </>
    );
  }

  const r = 130, c = 2 * Math.PI * r, part = Math.min(days, HATCH_DAYS) / HATCH_DAYS;
  return (
    <>
      <WorldHeader kind="close" title="Hatching soon" fallback="/apps" />
      <div className="w-ring" role="img" aria-label={`${days} of ${HATCH_DAYS} active days`}>
        <svg viewBox="0 0 280 280" aria-hidden>
          <circle cx="140" cy="140" r={r} className="w-ring-track" />
          <circle cx="140" cy="140" r={r} className="w-ring-fill" strokeDasharray={`${c * part} ${c}`} transform="rotate(-90 140 140)" />
        </svg>
        <img src="/figma/world/egg-warm.svg" alt="" className="w-ring-egg" />
      </div>
      <p className="w-count"><span className="w-count-n">{days}</span><span className="t-body c-2">/ {HATCH_DAYS} days</span></p>
      <ul className="w-rows card">
        <li><Icon name={wi('done')} size={22} /><span className="t-body">Tick 1 task today</span><span className="t-body-s w-green">Day {Math.min(days + (today ? 0 : 1), HATCH_DAYS)}</span></li>
        <li><Icon name={wi('heart')} size={22} /><span className="t-body">Two minute versions count</span><span className="t-body-s w-green">Yes</span></li>
        <li><Icon name={wi('streak')} size={22} /><span className="t-body">Keep your streak</span><span className="t-body-s w-green">Doesn’t reset</span></li>
      </ul>
      <div className="spacer" />
      <p className="t-caption c-3 w-end">Missed days pause it. They never crack it back.</p>
    </>
  );
}
