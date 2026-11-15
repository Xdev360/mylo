'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import RwCard from './Card';
import { BackBtn, Sparkles } from './bits';
import { LEGENDARY_WITHIN, RARITY, cardById, useRewards, type Card } from '@/lib/rewards';

/* U3 · Card detail (877:124986): the card on its stage, how many you have,
   where it comes from, wear it or gift a spare. */

function sources(c: Card): { icon: string; title: string; sub: string }[] {
  const key = { icon: 'rewards/i-key', title: '1 key', sub: 'From 5 active days or a level up' };
  if (c.rarity === 'common') return [key, { icon: 'rewards/i-lock', title: 'Any chest', sub: c.source }];
  if (c.rarity === 'rare') return [key, { icon: 'rewards/i-lock', title: 'Silver chest', sub: 'Unlocks after 3 weeks of showing up' }];
  if (c.rarity === 'epic') return [key, { icon: 'rewards/i-lock', title: 'Gold chest', sub: 'Unlocks after 4 weeks of showing up' },
    { icon: 'rewards/i-star', title: 'Epic, 1 in 8', sub: 'Each Gold chest has a 1 in 8 chance' }];
  return [key, { icon: 'rewards/i-lock', title: 'Gold chest', sub: 'Unlocks after 4 weeks of showing up' },
    { icon: 'rewards/i-star', title: 'Legendary guarantee', sub: `Within ${LEGENDARY_WITHIN} Gold chests.` }];
}

export default function CardDetail({ id }: { id: string }) {
  const r = useRewards();
  const card = cardById(id);
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  if (!card) return (
    <main className="screen rw on-desk">
      <header className="rw-top rw-top-left"><BackBtn fallback="/rewards/collection" /></header>
    </main>
  );
  const n = r.state.cards[card.id] ?? 0;
  const wearing = r.state.wearing === card.id;
  const rar = RARITY[card.rarity];
  return (
    <main className="screen rw on-desk">
      <header className="rw-top rw-top-left">
        <BackBtn fallback="/rewards/collection" />
        <h1 className="rw-left-title">{card.name}</h1>
      </header>
      <section className="rw-cardstage" style={{ '--stage': rar.stage, '--glow': rar.glow } as React.CSSProperties} aria-label={card.name}>
        <span className="rw-cardstage-glow" />
        <Sparkles />
        <RwCard card={card} className="rw-cardstage-card" dim={n === 0} />
        {n > 0 && <span className="rw-owned">You have {n}</span>}
      </section>
      <h2 className="rw-h">Where it comes from</h2>
      <div className="rw-sources">
        {sources(card).map(s => (
          <div key={s.title} className="rw-source">
            <span className="rw-source-icon"><Icon name={s.icon} size={20} /></span>
            <span className="rw-source-text"><span className="rw-source-title">{s.title}</span><span className="rw-source-sub">{s.sub}</span></span>
          </div>
        ))}
      </div>
      {n > 0 && <>
        <button type="button" className="btn-primary rw-wide" aria-pressed={wearing} onClick={() => r.wear(wearing ? null : card.id)}>
          {wearing ? <><Icon name="rewards/i-check" size={20} />Wearing</> : 'Wear it'}
        </button>
        {n > 1
          ? <Link href={`/rewards/gift?card=${card.id}`} className="rw-btn-line rw-wide">Gift to a friend</Link>
          : <Link href={`/rewards/download?kind=card&id=${card.id}`} className="rw-btn-line rw-wide"><Icon name="rewards/i-download" size={20} />Download</Link>}
      </>}
    </main>
  );
}
