import Reveal from './Reveal';
import Scroller from './Scroller';
import { PLAN } from '@/lib/content';

/* Figma frames "04 Plan" (887:2482) and its mobile twin (887:187480).

   Five tiles, each a card with a heading, a line of copy and a phone that
   runs off the bottom edge. Two wide ones over three narrow ones on a big
   screen; on a phone the first stands alone and the rest become a swipe
   row, minus the calendar, which the mobile frame drops.

   The phone inside a tile is placed as a percentage of the tile's width, so
   the composition holds at any width without a container query, the export
   is exactly the phone's own box, so its height follows from the picture.

   Light and dark are different screenshots of the app, not one picture
   recoloured, so each tile names both and <picture> picks. */

type Tile = (typeof PLAN.tiles)[number];

function PlanTile({ tile }: { tile: Tile }) {
  const wideOnly = 'wideOnly' in tile && tile.wideOnly;
  return (
    <article className={`plan-tile plan-tile-${tile.size}${wideOnly ? ' plan-tile-wide-only' : ''}`}>
      <h3 className="plan-tile-title">{tile.title}</h3>
      <p className="plan-tile-copy plan-copy-wide">{tile.wide}</p>
      {tile.phone && <p className="plan-tile-copy plan-copy-phone">{tile.phone}</p>}
      <picture className="theme-light-only">
        <img loading="lazy" decoding="async" src={`/figma/${tile.shot}.svg`} alt={tile.alt} className="plan-shot" />
      </picture>
      <picture className="theme-dark-only">
        <img loading="lazy" decoding="async" src={`/figma/${tile.shot}-dark.svg`} alt={tile.alt} className="plan-shot" />
      </picture>
    </article>
  );
}

export default function PlanTiles() {
  const [first, ...rest] = PLAN.tiles;
  return (
    <Reveal className="plan-grid">
      <PlanTile tile={first} />
      <Scroller dots={rest.filter(t => !('wideOnly' in t && t.wideOnly)).length} className="plan-rest">
        {rest.map(t => <PlanTile key={t.key} tile={t} />)}
      </Scroller>
    </Reveal>
  );
}
