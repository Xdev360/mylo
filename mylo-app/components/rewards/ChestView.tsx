'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { morph, pause } from '@/components/apps/motion';
import Icon from '@/components/Icon';
import RwCard from './Card';
import { BackBtn, Chest, CloseBtn, Confetti, KeyPill, Sparkles } from './bits';
import { keyLine } from './Hub';
import { COLLECTABLE, EGGS, SHARDS_FOR_CARD, TIERS, cardById, eggArt, useRewards, type Opened, type Tier } from '@/lib/rewards';

/* The Sunday chest. U11 · Gold chest ready (877:123524) and XT7 · Chest
   dropped a level (877:125539) when it can open; the same screen, waiting,
   on any other day. Opening it shows what came out: XT3 · Wood chest result,
   XT4 · Silver chest result, U12 · New card (Legendary) and XT5 · Double
   becomes a shard.

   Opening is one sequence: the chest rattles harder three times while its
   glow builds, bursts into a flash, and the result rises out of the flash:
   the card turns over, the ring and glow open, then the title, the line and
   the buttons. The key is spent only when the result is in. */

const INSIDE: Record<Tier, string> = {
  wood: 'Inside: 1 card.',
  silver: 'Inside: 1 card, Common or Rare.',
  gold: 'Inside: 1 card, Rare or better. 1 in 2 chance of an egg.'
};

export default function ChestView() {
  const r = useRewards();
  const [opening, setOpening] = useState<null | 'shake' | 'burst'>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const { week, canOpen, openedThisWeek } = r;
  const result = openedThisWeek && !openedThisWeek.seen ? openedThisWeek : null;
  if (result) return <Result rec={result} />;

  const tier = TIERS[week.tier].name;
  const title = canOpen ? (week.dropped ? `This week: ${tier} chest` : `Your ${tier} chest is ready`) : `This week: ${tier} chest`;
  const line = week.dropped ? 'You missed last week, so it dropped one level.'
    : openedThisWeek ? 'Opened this week'
    : canOpen ? (week.weekNo > 1 ? `${week.count === 7 ? 'Perfect week' : `${week.count} of 7 days`}, and ${week.weekNo} weeks in a row.` : `${week.count} of 7 days.`)
    : keyLine(week.toKey);
  const back = week.dropped ? `Show up 5 days this week and ${week.tier === 'silver' ? 'Gold' : 'Silver'} is back next Sunday. Nothing you own is lost.` : INSIDE[week.tier];

  async function open() {
    if (!canOpen || opening) return;
    setOpening('shake');
    await pause(1250);
    if (!alive.current) return;
    setOpening('burst');
    await pause(320);
    if (!alive.current) return;
    morph(() => { r.openChest(); setOpening(null); });
  }

  return (
    <main className="screen rw on-desk">
      <header className="rw-top">
        <BackBtn fallback="/rewards" />
        <h1 className="rw-top-title">Sunday chest</h1>
        <span className="rw-top-gap" />
      </header>
      <div className="rw-chest-head">
        <p className="t-body c-2">{week.isSunday ? 'Sunday evening' : 'This week'}</p>
        <h2 className="rw-display">{title}</h2>
      </div>
      <section className={`rw-stage${opening ? ` is-opening is-${opening}` : ''}`} aria-label={`${tier} chest`} aria-busy={!!opening}>
        <span className="rw-stage-glow" />
        <Sparkles />
        <span className="rw-stage-chest"><Chest tier={week.tier} size={220} /></span>
      </section>
      <p className="rw-chest-line">{line}</p>
      <KeyPill className="rw-cost">Uses 1 key</KeyPill>
      <p className="rw-chest-inside">{back}</p>
      <span className="spacer" />
      <button type="button" className="btn-primary rw-wide" disabled={!canOpen || !!opening} onClick={open}>
        {canOpen ? 'Open chest' : openedThisWeek ? 'Opened this week' : 'Opens Sunday'}
      </button>
      {opening && <span className={`rw-flash is-${opening}`} aria-hidden />}
    </main>
  );
}

function Result({ rec }: { rec: Opened }) {
  const r = useRewards();
  const router = useRouter();
  const card = cardById(rec.card)!;
  const n = r.owned.length;
  const title = rec.dup ? 'Already yours' : card.rarity === 'legendary' ? 'Legendary!' : card.rarity === 'epic' ? 'Epic card!' : card.rarity === 'rare' ? 'Rare card!' : 'New card';
  const line = rec.dup ? `So it turns into a shard. ${r.state.shards} of ${SHARDS_FOR_CARD} shards.`
    : card.rarity === 'legendary' ? `Card ${n} of ${COLLECTABLE} in your collection`
    : `From your ${TIERS[rec.tier].name} chest. Card ${n} of ${COLLECTABLE}.`;
  const go = (href: string) => { r.seeResult(); router.push(href); };
  return (
    <main className="rw-reveal is-arriving" aria-labelledby="rw-reveal-title">
      <span className="rw-flash is-out" aria-hidden />
      <div className="rw-reveal-col">
        <span className="rw-reveal-close"><CloseBtn onClick={() => go('/rewards')} /></span>
        <h1 id="rw-reveal-title" className="rw-reveal-title">{title}</h1>
        <div className="rw-reveal-stage">
          <span className="rw-reveal-glow" />
          <span className="rw-reveal-ring" />
          <Sparkles />
          <RwCard card={card} className={`rw-reveal-card is-${card.rarity}`} dim={rec.dup} />
          {rec.dup && <span className="rw-chip-float"><Icon name="rewards/i-sparkle" size={18} />+1 shard</span>}
          {!rec.dup && rec.egg && <span className="rw-chip-float"><img src={eggArt(rec.egg)} alt="" width={14} height={18} />{EGGS[rec.egg].name}</span>}
          <Confetti thin />
        </div>
        <p className="rw-reveal-line">{line}</p>
        <span className="spacer" />
        {rec.dup ? <>
          <button type="button" className="rw-btn-white rw-wide" onClick={() => go('/rewards')}>Keep the shard</button>
          <button type="button" className="rw-btn-ghost rw-wide" onClick={() => go('/rewards/collection?pick=1')}>See my shards</button>
        </> : <>
          <button type="button" className="rw-btn-white rw-wide" onClick={() => { r.wear(card.id); go(`/rewards/card/${card.id}`); }}>Wear it now</button>
          <button type="button" className="rw-btn-ghost rw-wide" onClick={() => go('/rewards/collection')}>Add to collection</button>
        </>}
      </div>
    </main>
  );
}
