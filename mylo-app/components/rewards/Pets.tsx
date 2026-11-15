'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { BackBtn } from './bits';
import { PET_HOUSE, petArt, petName, useRewards } from '@/lib/rewards';

/* U7 · Pet house (879:178334): the buddy out with your Mylo, the rest resting
   at home, empty places to fill by hatching eggs. */
export default function PetHouse() {
  const r = useRewards();
  const [swap, setSwap] = useState(false);
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const { pets, out } = r.state;
  const buddy = pets.find(p => p.id === out) ?? null;
  const home = pets.filter(p => p.id !== buddy?.id);
  const slots = Math.max(0, PET_HOUSE - 1 - home.length);

  return (
    <main className="screen rw rw-pets on-desk">
      <header className="rw-top">
        <BackBtn fallback="/rewards" />
        <h1 className="rw-top-title">Pet house</h1>
        <span className="rw-top-count">{pets.length} of {PET_HOUSE}</span>
      </header>
      <section className="rw-out" aria-label="Out with you">
        <span className="rw-out-ring a" /><span className="rw-out-ring b" />
        <img className="rw-out-mylo" src="/figma/rewards/mylo-plain.svg" alt="" width={157} height={189} />
        {buddy && <img className="rw-out-pet" src={petArt(buddy.kind)} alt="" width={120} height={120} />}
        {buddy && <p className="rw-out-text"><span className="rw-out-kicker">OUT WITH YOU</span><span className="rw-out-name">{petName(buddy)}</span></p>}
      </section>
      <h2 className="rw-h">Resting at home</h2>
      <div className="rw-tiles rw-tiles-wrap">
        {home.map(p => (
          <button key={p.id} type="button" className="rw-tile rw-slot" onClick={() => r.setOut(p.id)} aria-label={`Take ${petName(p)} out`}>
            <img src={petArt(p.kind)} alt="" width={80} height={80} />
            <span className="rw-slot-name">{petName(p)}</span>
          </button>
        ))}
        {Array.from({ length: slots }, (_, i) => (
          <Link key={i} href="/rewards/nest" className="rw-tile rw-slot is-empty">
            <span className="rw-slot-plus"><Icon name="rewards/i-plus" size={20} /></span>
            <span className="rw-slot-hint">Hatch an egg</span>
          </Link>
        ))}
      </div>
      <p className="t-body-s c-2 rw-14">One buddy walks with your Mylo at a time. Swap any time.</p>
      <button type="button" className="rw-btn-line rw-wide" disabled={pets.length < 2} onClick={() => setSwap(true)}>Swap buddy</button>

      <Sheet open={swap} onClose={() => setSwap(false)} title="Swap buddy" sub="One buddy walks with your Mylo at a time. Swap any time.">
        <div className="rw-tiles rw-tiles-wrap">
          {pets.map(p => (
            <button key={p.id} type="button" className={`rw-tile rw-slot${p.id === out ? ' is-picked' : ''}`} aria-pressed={p.id === out}
                    onClick={() => { r.setOut(p.id); setSwap(false); }}>
              <img src={petArt(p.kind)} alt="" width={80} height={80} />
              <span className="rw-slot-name">{petName(p)}</span>
            </button>
          ))}
        </div>
      </Sheet>
    </main>
  );
}
