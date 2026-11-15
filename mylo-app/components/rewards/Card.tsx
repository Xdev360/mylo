import Icon from '@/components/Icon';
import { RARITY, cardArt, cardNo, type Card } from '@/lib/rewards';

/* The collectible card, "Card · ·v4" (877:123663 and its smaller copies):
   a rarity-coloured frame, the art, the rarity and number pills, the name,
   what Mylo wears, where it comes from and the rarity stars. Drawn at the
   220 wide master and scaled to whatever width it is given, so the 107 wide
   grid copy and the 220 wide reveal are the same drawing. */
export default function RwCard({ card, className = '', dim = false }: { card: Card; className?: string; dim?: boolean }) {
  const r = RARITY[card.rarity];
  return (
    <span className={`rw-card${dim ? ' is-dim' : ''} ${className}`} style={{ '--frame': r.frame, '--pill': r.pill } as React.CSSProperties}>
      <span className="rw-card-u">
        <span className="rw-card-in">
          <img className="rw-card-art" src={cardArt(card.id)} alt="" draggable={false} />
          <span className="rw-card-rarity"><Icon name="rewards/i-sparkle" size={7} />{r.label}</span>
          <span className="rw-card-no">{cardNo(card)}</span>
          <span className="rw-card-name">{card.name}</span>
          <span className="rw-card-desc">{card.desc}</span>
          <span className="rw-card-line" />
          <span className="rw-card-foot">
            <span className="rw-card-src">{card.source}</span>
            <span className="rw-card-stars" aria-label={`${r.stars} of 5`}>
              {[0, 1, 2, 3, 4].map(i => <Icon key={i} name="rewards/i-sparkle" size={7} className={i < r.stars ? 'on' : ''} />)}
            </span>
          </span>
        </span>
      </span>
    </span>
  );
}

/* A card not yet owned, U2's "Locked · Gold chest · week 4" tile. */
export function LockedTile({ label, color, source }: { label: string; color: string; source: string }) {
  return (
    <span className="rw-locked">
      <span className="rw-locked-blob" />
      <span className="rw-locked-lock"><img src="/figma/rewards/i-lock.svg" alt="" width={16} height={16} /></span>
      <span className="rw-locked-src">
        <span className="rw-locked-label" style={{ color }}>{label}</span>
        <span className="rw-locked-text">{source}</span>
      </span>
    </span>
  );
}
