import Reveal from './Reveal';
import { HOW } from '@/lib/content';

/* Figma frames "03 Half plan, half play" (887:1648) and its mobile twin
   (887:186697).

   Two panels of the same shape, a chip, a heading, four points and an
   illustration at the bottom, side by side on a wide screen and stacked on
   a phone, with a white chip bridging them. The panels clip, so the phone
   and the cards run off their bottom edge exactly as they do in Figma.

   Nothing here is rotated, so the exports can go in at their own bounding
   boxes with no undoing. They were pulled with absolute bounds, which drops
   the drop shadow, so each one carries its Figma shadow as a CSS filter
   instead, that way the shadow scales with the art.

   Like the pinboard, every length is a multiple of --u: a hundredth of the
   panel's own width over its design width, so a panel scales as one object
   and the artwork keeps its place in it. */

type Art = {
  src: string; alt?: string;
  dark?: string;                          // its twin in the dark frame, if it differs
  d: [number, number, number, number];    // x, y, w, h on the 492 panel
  m: [number, number, number, number];    // the same on the 345 panel
  shadow?: [number, number, string];      // y, blur, colour, Figma's own
};

const PLAN_ART: Art[] = [
  { src: '/figma/how-phone.svg', dark: '/figma/how-phone-dark.svg',      // 893:200897
    alt: "Mylo's Goals screen: Run a 10K at 62 per cent, ahead of plan, and Read 12 books underneath.",
    d: [96, 430, 300, 630.2], m: [62, 350, 220, 462],
    shadow: [21.58, 43.17, 'rgba(15,10,46,.22)'] }
];

/* Painted in this order: the two side cards, the one in front, then the
   chest on top of all three. */
const PLAY_ART: Art[] = [
  { src: '/figma/how-card-weekend.svg',
    d: [-18.01, 500, 243.8, 312.1], m: [-9.72, 380, 166.88, 213.85],
    shadow: [7.6, 17.73, 'rgba(26,26,41,.14)'] },
  { src: '/figma/how-card-galaxy.svg',
    d: [262, 460.5, 243.8, 312.1], m: [186, 352.97, 166.88, 213.85],
    shadow: [6.33, 19, 'rgba(217,153,26,.35)'] },
  { src: '/figma/how-card-gala.svg',
    alt: 'Three outfit cards for a Mylo: Weekend Chill, Gala Night and Galaxy Drip.',
    d: [151, 450, 200, 293.3], m: [104, 350, 140, 205],
    shadow: [8, 18.67, 'rgba(26,26,41,.14)'] },
  { src: '/figma/how-chest.svg',
    alt: 'A closed gold chest.',
    d: [330, 640, 150, 150], m: [0, 0, 0, 0] }      // wide screens only
];

function Icon({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={`fig-icon ${className ?? ''}`}
      style={{ '--m': `url(/figma/icons/${name}.svg)` } as React.CSSProperties}
    />
  );
}

/* Art with a dark twin is drawn twice, one per scheme, and the stylesheet
   shows one; a hidden lazy picture is never fetched. */
function Artwork({ art, eager }: { art: Art; eager: boolean }) {
  if (art.dark) return (
    <>
      <picture className="theme-light-only"><Img art={art} src={art.src} eager={false} /></picture>
      <picture className="theme-dark-only"><Img art={art} src={art.dark} eager={false} /></picture>
    </>
  );
  return <Img art={art} src={art.src} eager={eager} />;
}

function Img({ art, src, eager }: { art: Art; src: string; eager: boolean }) {
  const hidden = art.m[2] === 0;
  return (
    <img loading={eager ? 'eager' : 'lazy'} decoding="async"
      src={src}
      alt={art.alt ?? ''}
      aria-hidden={art.alt ? undefined : true}
      className={`how-art${hidden ? ' how-art-wide-only' : ''}`}
      style={{
        '--dax': art.d[0], '--day': art.d[1], '--daw': art.d[2], '--dah': art.d[3],
        '--max': art.m[0], '--may': art.m[1], '--maw': art.m[2], '--mah': art.m[3],
        ...(art.shadow ? { '--shadow-y': art.shadow[0], '--shadow-b': art.shadow[1], '--shadow-c': art.shadow[2] } : {})
      } as React.CSSProperties}
    />
  );
}

function Panel({ half, art, tone, delay, eager }: {
  half: typeof HOW.plan; art: Art[]; tone: 'plan' | 'play'; delay: number; eager: boolean;
}) {
  return (
    <Reveal delay={delay} className={`how-panel how-${tone}`}>
      <p className="how-chip"><Icon name={half.chipIcon} />{half.chip}</p>
      <h3 className="how-panel-title">{half.title}</h3>
      <ul className="how-points">
        {half.points.map((p, i) => (
          <li key={p.name} style={{ '--i': i } as React.CSSProperties}>
            <span className="how-tile"><Icon name={p.icon} /></span>
            <span className="how-point-text">
              <span className="how-point-name">{p.name}</span>
              <span className="how-point-wide">{p.wide}</span>
              <span className="how-point-phone">{p.phone}</span>
            </span>
          </li>
        ))}
      </ul>
      {art.map(a => <Artwork key={a.src} art={a} eager={eager} />)}
    </Reveal>
  );
}

/* eager: the panels open the page (How it works), so their art should not
   wait to be scrolled to. */
export default function HowPanels({ eager = false }: { eager?: boolean }) {
  return (
    <div className="how-halves">
      <Panel half={HOW.plan} art={PLAN_ART} tone="plan" delay={0} eager={eager} />
      <Panel half={HOW.play} art={PLAY_ART} tone="play" delay={120} eager={eager} />
      <Reveal delay={300} className="how-seam">
        <p><Icon name="repeat" />{HOW.seam}</p>
      </Reveal>
    </div>
  );
}
