'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { useLocal } from '@/lib/local';
import { todayIso } from '@/lib/dates';
import { KEYS, type Egg as OldEgg } from '@/lib/world';
import { EGGS, HATCH_DAYS, eggArt, useRewards } from '@/lib/rewards';
import { morph } from '@/components/apps/motion';
import { WorldHeader, WorldPage, wi } from './ui';

/* EG1 · You found an egg (879:178114) until it is kept warm, then
   EG2 · Hatching soon (879:178134): five active days and it hatches.

   The egg lives in the rewards nest, the same one Gold chest eggs go to
   (lib/rewards.ts), so the hub, the collection, the pet house and this
   screen always count the same eggs. EG1 shows the first egg, given once,
   or a chest egg waiting in the basket; with nothing to warm it sends you to
   the nest. When the days are in, the nest plays the hatch (XT8). */
export default function Eggs() {
  return <WorldPage className="w-egg-screen"><EggBody /></WorldPage>;
}

function EggBody() {
  const router = useRouter();
  const r = useRewards();
  const { ready, state, nestDays, days } = r;
  // An egg kept warm before the egg moved into the rewards nest: carry it over.
  const [old, setOld] = useLocal<OldEgg>(KEYS.egg, { foundOn: null });
  useEffect(() => {
    if (!ready || !old.foundOn) return;
    if (!state.firstEgg) r.warmFirstEgg(old.foundOn);
    setOld({ foundOn: null });
  }, [ready, old.foundOn, state.firstEgg, r, setOld]);

  const waiting = state.eggs[0] ?? null;
  const nothing = ready && !state.nest && !waiting && state.firstEgg;
  const hatched = ready && !!state.nest && nestDays >= HATCH_DAYS;
  useEffect(() => { if (nothing || hatched) router.replace('/rewards/nest'); }, [nothing, hatched, router]);
  if (!ready || nothing || hatched) return null;

  if (!state.nest) {
    const first = !state.firstEgg;
    return (
      <>
        <WorldHeader kind="close" fallback="/apps" />
        <div className="w-egg-intro">
          <p className="t-label w-amber">{first ? 'New at Blaze' : EGGS[waiting!.kind].name}</p>
          <h1 className="w-display-s">You found an egg</h1>
          <p className="t-body c-2 w-egg-lede">Show up for 5 days and it hatches into {first || !state.pets.length ? 'your first pet' : 'a new buddy'}.</p>
        </div>
        <div className="w-egg-stage" aria-hidden>
          <span className="w-egg-floor" />
          <img className="w-egg-art" style={{ viewTransitionName: 'w-egg' }} src={first ? '/figma/world/egg-new.svg' : eggArt(waiting!.kind)} alt="" />
          <span className="w-spark w-spark-a"><Icon name={wi('sparkle')} size={28} /></span>
          <span className="w-spark w-spark-b"><Icon name={wi('sparkle')} size={20} /></span>
        </div>
        <p className="w-pill"><Icon name={wi('bolt')} size={18} className="w-amber" />{HATCH_DAYS} active days to hatch</p>
        <div className="spacer" />
        <button type="button" className="btn-primary w-wide" onClick={() => morph(() => (first ? r.warmFirstEgg() : r.placeEgg(waiting!.id)))}>Keep it warm</button>
        <p className="t-caption c-3 w-center">It lives in Mylo’s room</p>
      </>
    );
  }

  const n = Math.min(nestDays, HATCH_DAYS);
  const today = days.has(todayIso());
  const rad = 130, c = 2 * Math.PI * rad, part = n / HATCH_DAYS;
  return (
    <>
      <WorldHeader kind="close" title="Hatching soon" fallback="/apps" />
      <div className="w-ring" role="img" aria-label={`${n} of ${HATCH_DAYS} active days`}>
        <svg viewBox="0 0 280 280" aria-hidden>
          <circle cx="140" cy="140" r={rad} className="w-ring-track" />
          <circle cx="140" cy="140" r={rad} className="w-ring-fill" strokeDasharray={`${c * part} ${c}`} transform="rotate(-90 140 140)"
                  style={{ '--ring-c': c } as React.CSSProperties} />
        </svg>
        <img src={state.nest.first ? '/figma/world/egg-warm.svg' : eggArt(state.nest.kind)} alt="" className="w-ring-egg" style={{ viewTransitionName: 'w-egg' }} />
      </div>
      <p className="w-count"><span className="w-count-n">{n}</span><span className="t-body c-2">/ {HATCH_DAYS} days</span></p>
      <ul className="w-rows card">
        <li><Icon name={wi('done')} size={22} /><span className="t-body">Tick 1 task today</span><span className="t-body-s w-green">Day {Math.min(n + (today ? 0 : 1), HATCH_DAYS)}</span></li>
        <li><Icon name={wi('heart')} size={22} /><span className="t-body">Two minute versions count</span><span className="t-body-s w-green">Yes</span></li>
        <li><Icon name={wi('streak')} size={22} /><span className="t-body">Keep your streak</span><span className="t-body-s w-green">Doesn’t reset</span></li>
      </ul>
      <div className="spacer" />
      <p className="t-caption c-3 w-end">Missed days pause it. They never crack it back.</p>
    </>
  );
}
