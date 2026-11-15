import Link from 'next/link';
import Reveal from './Reveal';
import FigIcon from './FigIcon';
import { ROADMAP_TEASER } from '@/lib/content';

/* Figma frame "08b Roadmap teaser" (887:190873): three cards pinned to a
   cork board, each with its level badge. The board keeps its warm paper
   colour in both schemes, it is a board, not a surface. */
export default function RoadmapTeaser() {
  return (
    <>
      <Reveal className="roadmap-board">
        {ROADMAP_TEASER.cards.map((c, i) => (
          <article key={c.name} className="roadmap-card"
                   style={{ '--r': `${c.rot}deg`, '--i': i } as React.CSSProperties}>
            <img loading="lazy" decoding="async" src={`/figma/${c.pin}.svg`} alt="" aria-hidden className="roadmap-pin" />
            <p className="roadmap-when">{c.when}</p>
            <h3 className="roadmap-name">{c.name}</h3>
            <img loading="lazy" decoding="async" src={`/figma/${c.badge}.svg`} alt="" aria-hidden className="roadmap-badge" />
            <p className="roadmap-body">{c.body}</p>
          </article>
        ))}
      </Reveal>
      <Reveal delay={120} className="mt-8 desktop:mt-[32px]">
        <Link href="/roadmap" className="roadmap-cta">
          <FigIcon name="arrow" />{ROADMAP_TEASER.cta}
        </Link>
      </Reveal>
    </>
  );
}
