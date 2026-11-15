/* Figma frames "02 Why we built it" (887:1037) and its mobile twin
   (887:186130). Six polaroids pinned to a 1000x880 board; five, laid out
   differently and cropped differently, on a 377-wide phone.

   The white card, the caption and the tape are DOM so they stay text and
   scale with the layout. The photo inside each one, a phone screen, a Mylo,
   a chest, is a 2x export, as is the pushpin and the paperclip.

   Figma rotates a node about its TOP-LEFT, so every card does the same. An
   export, though, is rendered in absolute space, so the card's tilt is
   already baked into the picture: <Baked> turns by the opposite amount and
   lets the card's own rotation put it back. Positioning by centre is what
   makes that exact, a rotated node and its bounding box share one.

   Every length is a multiple of --u, so each board scales as one object:
   a tenth of a container percent on the 1000-wide board, a 377th of one
   on the phone. */

import Reveal from './Reveal';

/** Where a card sits on one of the two boards. */
type Place = { x: number; y: number; w: number; h: number; r: number };
/** A photo: the window it shows through, and the export that fills it.
    Only the two phone screens have a dark twin, the Mylos, the chest and
    the streak card are the same picture in both schemes, as in Figma. */
type Shot = { src: string; dark?: string; w: number; h: number; iw: number; ih: number };
/** An export with its parent's tilt baked in: centre, size, and the undo. */
type Fix = { cx: number; cy: number; w: number; h: number } | null;

type Card = {
  key: string;
  alt: string;
  caption: string;
  d: Place; m: Place | null;          // null: not on the phone board
  photoD: Shot; photoM: Shot | null;
  fastener: 'pin-red' | 'pin-green' | 'pin-orange' | 'clip-a' | 'clip-b' | 'tape';
  fixD: Fix; fixM: Fix;               // tape needs none: it is a div
  tapeD?: Place; tapeM?: Place;
};

const CARDS: Card[] = [
  {
    key: 'day',
    caption: 'Your day, sorted',
    alt: "Mylo's Today screen: a greeting, the week, four tasks left and a shared progress bar.",
    d: { x: 10, y: 40, w: 300, h: 420, r: 3 },
    m: { x: 14, y: 30, w: 170, h: 240, r: 4 },
    photoD: { src: '/figma/why-day.svg',   dark: '/figma/why-day-dark.svg',
              w: 272, h: 346, iw: 289.74, ih: 359.76 },
    photoM: { src: '/figma/why-day-m.svg', dark: '/figma/why-day-m-dark.svg',
              w: 142, h: 188, iw: 154.77, ih: 197.45 },
    fastener: 'pin-red',
    fixD: { cx: 253.62, cy: -4.01, w: 45.9,  h: 54.0  },
    fixM: { cx: 149.47, cy: 6,     w: 46.47, h: 54.66 }
  },
  {
    key: 'mylo',
    caption: 'Your Mylo',
    alt: 'A Mylo character in a party hat, star glasses and a bow tie.',
    d: { x: 350, y: 10,  w: 300, h: 330, r: -2 },
    m: { x: 196, y: 20,  w: 166, h: 210, r: -3 },
    photoD: { src: '/figma/why-mylo.svg',   w: 272, h: 256, iw: 280.79, ih: 265.34 },
    photoM: { src: '/figma/why-mylo-m.svg', w: 138, h: 158, iw: 146.08, ih: 165.01 },
    fastener: 'clip-a',
    fixD: { cx: 14.07, cy: 13.02, w: 47.13, h: 82.29 },
    fixM: { cx: 10.05, cy: 12.99, w: 46.17, h: 82.59 }
  },
  {
    key: 'people',
    caption: 'Your people',
    alt: 'Three Mylos side by side, one with a hair bow, one in a sweatband, one in glasses.',
    d: { x: 690, y: 30,  w: 300, h: 300, r: 2 },
    m: { x: 18,  y: 300, w: 168, h: 210, r: -2 },
    photoD: { src: '/figma/why-people.svg',   w: 272, h: 226, iw: 279.72, ih: 235.35 },
    photoM: { src: '/figma/why-people-m.svg', w: 140, h: 158, iw: 145.43, ih: 162.79 },
    fastener: 'pin-green',
    fixD: { cx: 151.71, cy: 3.87, w: 45.2,  h: 53.7  },
    fixM: { cx: 93.38,  cy: 5.85, w: 44.54, h: 53.68 }
  },
  {
    key: 'chest',
    caption: 'Sunday chest',
    alt: 'An open gold chest glowing in the dark.',
    d: { x: 340, y: 380, w: 330, h: 300, r: 1 },
    m: { x: 196, y: 268, w: 166, h: 210, r: 3 },
    photoD: { src: '/figma/why-chest.svg',   w: 302, h: 226, iw: 305.9,  ih: 231.24 },
    photoM: { src: '/figma/why-chest-m.svg', w: 138, h: 158, iw: 146.08, ih: 165.01 },
    fastener: 'tape',
    fixD: null, fixM: null,
    tapeD: { x: 110, y: -16, w: 110, h: 34, r: 4 },
    tapeM: { x: 48,  y: -14, w: 74,  h: 34, r: 4 }
  },
  {
    key: 'systems',
    caption: 'Systems that run',
    alt: 'The Systems screen: morning routine, workout, reading and a no-phone rule, each with its streak.',
    d: { x: 0, y: 500, w: 310, h: 330, r: -3 },
    m: null,
    photoD: { src: '/figma/why-systems.svg', dark: '/figma/why-systems-dark.svg',
              w: 282, h: 256, iw: 295.01, ih: 270.41 },
    photoM: null,
    fastener: 'clip-b',
    fixD: { cx: 271.77, cy: 8.85, w: 45.54, h: 83.73 },
    fixM: null
  },
  {
    key: 'streak',
    caption: 'Just a number :)',
    alt: 'A flame over a big 12, labelled day streak.',
    d: { x: 700, y: 370, w: 280, h: 330, r: -4 },
    m: { x: 40,  y: 560, w: 170, h: 210, r: -4 },
    photoD: { src: '/figma/why-streak.svg',   w: 252, h: 256, iw: 269.24, ih: 272.96 },
    photoM: { src: '/figma/why-streak-m.svg', w: 142, h: 158, iw: 152.68, ih: 167.52 },
    fastener: 'pin-orange',
    fixD: { cx: 9.1,   cy: 8.01, w: 45.8,  h: 54.7  },
    fixM: { cx: 11.12, cy: 10,   w: 45.77, h: 54.66 }
  }
];

/* One card carries both boards' numbers; the stylesheet decides which pair
   it reads. A card the phone board leaves out falls back to its desktop
   values and is hidden below the breakpoint, so nothing here is undefined. */
function vars(c: Card): React.CSSProperties {
  const m = c.m ?? c.d;
  const pm = c.photoM ?? c.photoD;
  const fm = c.fixM ?? c.fixD;
  const tm = c.tapeM ?? c.tapeD;
  return {
    '--dx': c.d.x, '--dy': c.d.y, '--dw': c.d.w, '--dh': c.d.h, '--dr': `${c.d.r}deg`,
    '--mx': m.x, '--my': m.y, '--mw': m.w, '--mh': m.h, '--mr': `${m.r}deg`,
    '--dpw': c.photoD.w, '--dph': c.photoD.h, '--dbw': c.photoD.iw, '--dbh': c.photoD.ih,
    '--mpw': pm.w, '--mph': pm.h, '--mbw': pm.iw, '--mbh': pm.ih,
    ...(fm && c.fixD ? {
      '--dfx': c.fixD.cx, '--dfy': c.fixD.cy, '--dfw': c.fixD.w, '--dfh': c.fixD.h,
      '--mfx': fm.cx, '--mfy': fm.cy, '--mfw': fm.w, '--mfh': fm.h
    } : {}),
    ...(tm && c.tapeD ? {
      '--dtx': c.tapeD.x, '--dty': c.tapeD.y, '--dtw': c.tapeD.w, '--dth': c.tapeD.h,
      '--mtx': tm.x, '--mty': tm.y, '--mtw': tm.w, '--mth': tm.h
    } : {})
  } as React.CSSProperties;
}

/* One picture per scheme, each with its own <source> for the wide board.
   A card with no dark twin draws the same picture in both, so it gets one
   plain picture and no theme class. */
function hasDark(c: Card) { return !!(c.photoD.dark || c.photoM?.dark); }
function Photo({ c, scheme }: { c: Card; scheme?: 'light' | 'dark' }) {
  const phone = c.photoM ?? c.photoD;
  const pick = (p: typeof phone) => (scheme === 'dark' && p.dark) || p.src;
  return (
    <picture className={scheme ? `theme-${scheme}-only` : undefined}>
      {c.photoM && <source media="(min-width:768px)" srcSet={pick(c.photoD)} />}
      <img loading="lazy" decoding="async" src={pick(phone)} alt={c.alt} className="polaroid-shot" />
    </picture>
  );
}

export default function Pinboard() {
  return (
    <Reveal className="pinboard mt-12 desktop:mt-[61px]">
      {CARDS.map((c, i) => (
        <article
          key={c.key}
          className={`polaroid${c.m ? '' : ' polaroid-wide-only'}`}
          style={{ ...vars(c), '--d': `${i * 90}ms` } as React.CSSProperties}
        >
          <div className="polaroid-photo">
            {hasDark(c)
              ? <><Photo c={c} scheme="light" /><Photo c={c} scheme="dark" /></>
              : <Photo c={c} />}
          </div>
          <p className="polaroid-caption">{c.caption}</p>
          {c.fastener === 'tape'
            ? <div className="pin-tape" aria-hidden />
            : <img loading="lazy" decoding="async" src={`/figma/${c.fastener}${c.fastener.startsWith('clip') ? '.svg' : '.svg'}`}
                   alt="" aria-hidden className="pin-fix" />}
        </article>
      ))}
    </Reveal>
  );
}
