'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Sheet from '@/components/Sheet';
import { BackBtn, CloseBtn, Sparkles } from './bits';
import { BASKET, EGGS, HATCH_DAYS, PETS, eggArt, petArt, petName, useRewards, type EggKind, type PetKind } from '@/lib/rewards';

/* U8 · Nest (879:178164): one egg at a time, hatching after 5 active days,
   with up to 3 more waiting in the basket. XT8 · Egg hatched (879:178257)
   greets the buddy that came out. Eggs come from Gold chests. */

const eggFor = (k: PetKind) => (Object.keys(EGGS) as EggKind[]).find(e => EGGS[e].hatches.includes(k))!;

export default function Nest() {
  const r = useRewards();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  const { ready, nestDays, hatch } = r;
  const nest = r.state.nest;
  useEffect(() => { if (ready && nest && nestDays >= HATCH_DAYS) hatch(); }, [ready, nest, nestDays, hatch]);
  if (!ready) return <main className="screen" aria-busy="true" />;
  const { eggs, hatched, pets } = r.state;
  const born = hatched ? pets.find(p => p.id === hatched) ?? null : null;

  const basket = (
    <section className="rw-basket" aria-label="Waiting in your basket">
      <p className="rw-basket-head"><span>Waiting in your basket</span><span className="rw-basket-n">{eggs.length} of {BASKET}</span></p>
      <div className="rw-basket-row">
        {Array.from({ length: BASKET }, (_, i) => {
          const e = eggs[i];
          if (!e) return <span key={i} className="rw-basket-slot" />;
          return (
            <button key={e.id} type="button" className="rw-basket-egg" disabled={!!nest} onClick={() => r.placeEgg(e.id)} aria-label={EGGS[e.kind].name}>
              <img src={eggArt(e.kind)} alt="" width={42} height={52} />
            </button>
          );
        })}
      </div>
    </section>
  );

  if (born) return (
    <main className="rw-night">
      <div className="rw-night-col">
        <header className="rw-night-head is-left">
          <div><h1 className="rw-hatched">It hatched!</h1><p className="rw-night-sub">Say hi to your new buddy</p></div>
          <CloseBtn onClick={r.greet} />
        </header>
        <div className="rw-nest">
          <span className="rw-nest-glow" /><Sparkles /><span className="rw-nest-bed" />
          <img className="rw-nest-pet" src={petArt(born.kind)} alt="" width={200} height={200} />
        </div>
        <h2 className="rw-nest-title">{petName(born)}</h2>
        <p className="rw-nest-days">From your {EGGS[eggFor(born.kind)].name}</p>
        {basket}
        <span className="spacer" />
        <button type="button" className="rw-btn-ghost rw-wide" onClick={() => { setName(born.name ?? ''); setNaming(true); }}>Name your buddy</button>
      </div>
      <Sheet open={naming} onClose={() => setNaming(false)} title="Name your buddy" sub={PETS[born.kind].name}>
        <form className="rw-name-form" onSubmit={e => { e.preventDefault(); r.namePet(born.id, name); setNaming(false); r.greet(); }}>
          <input className="rw-input" value={name} maxLength={20} autoFocus onChange={e => setName(e.target.value)} placeholder={PETS[born.kind].name.split(' · ')[0]} />
          <button type="submit" className="btn-primary rw-wide">Done</button>
        </form>
      </Sheet>
    </main>
  );

  return (
    <main className="rw-night">
      <div className="rw-night-col">
        <header className="rw-night-head">
          <BackBtn fallback="/rewards" light />
          <div className="rw-night-titles"><h1 className="rw-night-title">Your nest</h1><p className="rw-night-sub">One egg at a time</p></div>
          <span className="rw-top-gap" />
        </header>
        <div className="rw-nest">
          <span className="rw-nest-glow" /><Sparkles /><span className="rw-nest-bed" />
          {nest && <img className="rw-nest-egg" src={eggArt(nest.kind)} alt="" width={176} height={220} />}
        </div>
        {nest ? <>
          <h2 className="rw-nest-title">{EGGS[nest.kind].name}</h2>
          <p className="rw-nest-days">{Math.min(nestDays, HATCH_DAYS)} of {HATCH_DAYS} active days</p>
          <span className="rw-nest-bar"><span style={{ width: `${Math.min(1, nestDays / HATCH_DAYS) * 100}%` }} /></span>
        </> : <p className="rw-nest-days">1 in 2 chance of an egg</p>}
        {basket}
        <span className="spacer" />
        <Link href="/today" className="rw-btn-ghost rw-wide">Keep showing up</Link>
      </div>
    </main>
  );
}
