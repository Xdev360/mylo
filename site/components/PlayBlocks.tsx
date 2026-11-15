import Reveal from './Reveal';
import Scroller from './Scroller';
import { PLAY } from '@/lib/content';

/* Figma frames "05 Play" (887:3041) and its mobile twin (887:187955).

   Four blocks under one heading: the five steps, the chest ladder, the
   wardrobe lineup and the fairness panel. The two dark panels keep their
   gradient in both schemes, they are the dark panels by design, the way
   the Play half of section 03 is.

   The artwork is transparent PNG at 2x, pulled with absolute bounds, so it
   drops onto either ground unchanged and needs no dark twin. The one piece
   that is not a picture is the first step: five green days and a count,
   which are a circle, an icon and a line of text, and read better as DOM
   than as a flattened image.

   The phone layout is not this one scaled. It swipes the steps, stacks the
   ladder into rows, and shows four outfits instead of seven. */

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span aria-hidden className={`fig-icon ${className ?? ''}`}
          style={{ '--m': `url(/figma/icons/${name}.svg)` } as React.CSSProperties} />
  );
}

/* Step 01's art: five days ticked off, then the count. */
function ShowUpArt() {
  return (
    <span className="play-days" aria-hidden>
      <span className="play-days-row">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className="play-day"><Icon name="check" /></span>
        ))}
      </span>
      <span className="play-days-count">5 of 5</span>
    </span>
  );
}

const STEP_ART: Record<string, React.ReactNode> = {
  '01': <ShowUpArt />,
  '02': <img loading="lazy" decoding="async" src="/figma/play-key.svg" alt="" className="play-art" style={{ '--x': 46, '--y': 46, '--w': 80 } as React.CSSProperties} />,
  '03': <img loading="lazy" decoding="async" src="/figma/play-chest-wood-open.svg" alt="" className="play-art" style={{ '--x': 16, '--y': 14, '--w': 140 } as React.CSSProperties} />,
  '04': <>
    <img loading="lazy" decoding="async" src="/figma/play-card-pink.svg" alt="" className="play-art" style={{ '--x': 5.72, '--y': 26, '--w': 95.5 } as React.CSSProperties} />
    <img loading="lazy" decoding="async" src="/figma/play-card-festival.svg" alt="" className="play-art" style={{ '--x': 70, '--y': 12.25, '--w': 93.66 } as React.CSSProperties} />
  </>,
  '05': <>
    <img loading="lazy" decoding="async" src="/figma/play-egg.svg" alt="" className="play-art" style={{ '--x': 20, '--y': 30, '--w': 88 } as React.CSSProperties} />
    <img loading="lazy" decoding="async" src="/figma/play-pip.svg" alt="" className="play-art" style={{ '--x': 82, '--y': 70, '--w': 90 } as React.CSSProperties} />
  </>
};

function Steps() {
  return (
    <Reveal className="play-steps">
      {/* The steps row swipes on a phone with no dots: the design does
          not draw any, and five cards with a sixth peeking already say so. */}
      <Scroller dots={0} className="play-steps-row">
        {PLAY.steps.map((s, i) => (
          <article key={s.n} className="play-step" style={{ '--i': i } as React.CSSProperties}>
            <span className="play-step-art">{STEP_ART[s.n]}</span>
            <span className="play-step-n">{s.n}</span>
            <span className="play-step-title">{s.title}</span>
            <span className="play-step-body play-wide">{s.wide}</span>
            <span className="play-step-body play-phone">{s.phone}</span>
          </article>
        ))}
      </Scroller>
    </Reveal>
  );
}

function Ladder() {
  const { ladder } = PLAY;
  return (
    <Reveal className="play-panel play-ladder">
      <h3 className="play-panel-title">{ladder.title}</h3>
      <p className="play-panel-lead play-wide">{ladder.leadWide}</p>
      <p className="play-panel-lead play-phone">{ladder.leadPhone}</p>
      <p className="play-ladder-chip play-wide"><Icon name="trophy" />{ladder.chip}</p>
      <ol className="play-rungs">
        {ladder.rungs.map((r, i) => (
          <li key={r.name} style={{ '--i': i } as React.CSSProperties}>
            <span className="play-rung-art" style={{ '--glow': r.glow } as React.CSSProperties}>
              <img loading="lazy" decoding="async" src={`/figma/${r.shot}.svg`} alt={r.alt} width={180} height={180} />
            </span>
            <span className="play-rung-text">
              <span className="play-rung-when">{r.when}</span>
              <span className="play-rung-name">{r.name}</span>
              <span className="play-rung-drops">{r.drops}</span>
            </span>
            {i < ladder.rungs.length - 1 && <Icon name="arrow" className="play-rung-arrow play-wide" />}
          </li>
        ))}
      </ol>
    </Reveal>
  );
}

function Wardrobe() {
  const { wardrobe } = PLAY;
  /* The phone shows four of the seven, and the last one runs off the panel
     edge there exactly as it does in Figma. */
  const phone = new Set(['mylo-winter', 'mylo-beach', 'mylo-festival', 'mylo-space']);
  return (
    <Reveal className="play-panel play-wardrobe">
      <h3 className="play-panel-title">{wardrobe.title}</h3>
      <p className="play-panel-lead play-wide">{wardrobe.leadWide}</p>
      <p className="play-panel-lead play-phone">{wardrobe.leadPhone}</p>
      <ul className="play-lineup">
        {wardrobe.outfits.map((o, i) => (
          <li key={o.shot}
              className={phone.has(o.shot) ? undefined : 'play-wide-only'}
              style={{ '--i': i } as React.CSSProperties}>
            <img loading="lazy" decoding="async" src={`/figma/${o.shot}.svg`} alt={`A Mylo wearing ${o.name}.`} />
            <span className="play-outfit-chip">{o.name}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

function Fair() {
  return (
    <Reveal className="play-panel play-fair">
      <h3 className="play-fair-title">{PLAY.fair.title}</h3>
      <ul className="play-fair-points">
        {PLAY.fair.points.map(p => (
          <li key={p.name}>
            <span className="play-fair-tile"><Icon name={p.icon} /></span>
            <span className="play-fair-name">{p.name}</span>
            <span className="play-fair-body play-wide">{p.wide}</span>
            <span className="play-fair-body play-phone">{p.phone}</span>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}

export default function PlayBlocks() {
  return (
    <div className="play-blocks">
      <Steps />
      <Ladder />
      <Wardrobe />
      <Fair />
    </div>
  );
}
