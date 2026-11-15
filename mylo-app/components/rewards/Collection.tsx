'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import RwCard, { LockedTile } from './Card';
import { BackBtn } from './bits';
import { CARDS, EGGS, RARITIES, RARITY, SHARDS_FOR_CARD, eggArt, petArt, petName, useRewards, type Rarity } from '@/lib/rewards';

/* U2 · Collection (877:124425): Cards, Pets, Eggs, filtered by rarity, every
   card owned shown whole and every one still to find as a locked tile with
   where it comes from. With ?pick=1 it is XT6 · Shards · pick any card
   (879:181576): 5 shards buy any Common or Rare card. */

type Tab = 'cards' | 'pets' | 'eggs';
const SPECIAL = { label: 'Special', color: '#E5574A', source: 'Birthday week' };
const LOCK_COLOR: Record<Rarity, string> = { common: '#8E95A6', rare: '#3E7BFA', epic: '#8B5CF6', legendary: '#D99A1E' };
const lockSource = (r: Rarity) => r === 'common' ? 'Any chest' : r === 'rare' ? 'Silver or Gold · week 3' : 'Gold chest · week 4';

export default function Collection({ pick = false }: { pick?: boolean }) {
  const r = useRewards();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('cards');
  const [filter, setFilter] = useState<Rarity | 'all'>('all');
  const [chosen, setChosen] = useState<string | null>(null);
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const { state } = r;
  const has = (id: string) => (state.cards[id] ?? 0) > 0;
  const shown = CARDS.filter(c => filter === 'all' || c.rarity === filter);
  const pickable = (rar: Rarity) => rar === 'common' || rar === 'rare';
  const ready = state.shards >= SHARDS_FOR_CARD;
  const chosenCard = CARDS.find(c => c.id === chosen);

  return (
    <main className={`screen rw rw-coll on-desk${pick ? ' rw-has-foot' : ''}`}>
      <header className={pick ? 'rw-top rw-top-left' : 'rw-top'}>
        <BackBtn fallback="/rewards" />
        <h1 className={pick ? 'rw-left-title is-22' : 'rw-top-title'}>{pick ? 'Pick any card' : 'Collection'}</h1>
        {pick ? <span className="rw-shards">{Math.min(state.shards, SHARDS_FOR_CARD)} of {SHARDS_FOR_CARD} shards{ready ? ' ready' : ''}</span> : <span className="rw-top-gap" />}
      </header>

      <div className="rw-chips" role="tablist" aria-label="Collection">
        {(['cards', 'pets', 'eggs'] as Tab[]).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`rw-chip is-tab${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>
            {t === 'cards' ? 'Cards' : t === 'pets' ? 'Pets' : 'Eggs'}
          </button>
        ))}
      </div>

      {tab === 'cards' && <>
        <div className="rw-chips rw-chips-r" aria-label="Rarity">
          {(['all', ...RARITIES] as const).map(f => (
            <button key={f} type="button" aria-pressed={filter === f} className={`rw-chip${filter === f ? (pick ? ' is-pick' : ' is-on') : ''}`} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : RARITY[f].chip}
            </button>
          ))}
        </div>
        <div className="rw-grid">
          {shown.map(c => {
            if (pick && pickable(c.rarity)) return (
              <button key={c.id} type="button" className={`rw-grid-cell rw-pickable${chosen === c.id ? ' is-chosen' : ''}`} aria-pressed={chosen === c.id} onClick={() => setChosen(c.id)}>
                <RwCard card={c} />
              </button>
            );
            if (!pick && has(c.id)) return <Link key={c.id} href={`/rewards/card/${c.id}`} className="rw-grid-cell"><RwCard card={c} /></Link>;
            return <span key={c.id} className="rw-grid-cell"><LockedTile label={RARITY[c.rarity].label} color={LOCK_COLOR[c.rarity]} source={lockSource(c.rarity)} /></span>;
          })}
          {filter === 'all' && <span className="rw-grid-cell"><LockedTile {...SPECIAL} /></span>}
        </div>
      </>}

      {tab === 'pets' && (
        <div className="rw-tiles rw-tiles-wrap">
          {state.pets.map(p => (
            <Link key={p.id} href="/rewards/pets" className="rw-tile rw-slot">
              <img src={petArt(p.kind)} alt="" width={80} height={80} />
              <span className="rw-slot-name">{petName(p)}</span>
            </Link>
          ))}
          {state.pets.length === 0 && (
            <Link href="/rewards/nest" className="rw-tile rw-slot is-empty">
              <span className="rw-slot-plus"><Icon name="rewards/i-plus" size={20} /></span>
              <span className="rw-slot-hint">Hatch an egg</span>
            </Link>
          )}
        </div>
      )}

      {tab === 'eggs' && (
        <div className="rw-tiles rw-tiles-wrap">
          {[...(state.nest ? [state.nest] : []), ...state.eggs].map(e => (
            <Link key={e.id} href="/rewards/nest" className="rw-tile rw-slot">
              <img src={eggArt(e.kind)} alt="" width={56} height={70} />
              <span className="rw-slot-name">{EGGS[e.kind].name}</span>
            </Link>
          ))}
          {!state.nest && state.eggs.length === 0 && (
            <Link href="/rewards/nest" className="rw-tile rw-slot is-empty">
              <span className="rw-slot-plus"><Icon name="rewards/i-egg" size={20} /></span>
              <span className="rw-slot-hint">Your nest</span>
            </Link>
          )}
        </div>
      )}

      {pick && (
        <div className="rw-foot">
          <button type="button" className="btn-primary rw-wide" disabled={!ready || !chosenCard}
                  onClick={() => { if (chosenCard) { r.spendShards(chosenCard.id); router.push(`/rewards/card/${chosenCard.id}`); } }}>
            {chosenCard ? `Use ${SHARDS_FOR_CARD} shards on ${chosenCard.name}` : `Use ${SHARDS_FOR_CARD} shards`}
          </button>
        </div>
      )}
    </main>
  );
}
