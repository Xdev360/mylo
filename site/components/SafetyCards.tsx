import Reveal from './Reveal';
import FigIcon from './FigIcon';
import { SAFETY_SECTION } from '@/lib/content';

/* Figma frames "07 Safety" (887:4601) and 887:189287: three cards in a row,
   stacked on a phone, each an icon tile over a heading and a line. */
export default function SafetyCards() {
  return (
    <Reveal className="safety-cards">
      {SAFETY_SECTION.cards.map((c, i) => (
        <article key={c.title} className="safety-card" style={{ '--i': i } as React.CSSProperties}>
          <span className="safety-tile"><FigIcon name={c.icon} /></span>
          <h3 className="safety-card-title">{c.title}</h3>
          <p className="safety-card-body safety-wide">{c.wide}</p>
          <p className="safety-card-body safety-phone">{c.phone}</p>
        </article>
      ))}
    </Reveal>
  );
}
