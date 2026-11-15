/* The phones in the Figma mock-ups are scaled copies of the full-size screens,
   and some corners did not scale with them: the Today card keeps its radius of
   26 at 63 high, which turns it into a pill. These put back what the full-size
   screens have (C2 · Today, AI5 · Plan cards), and square up the screen inside
   each polaroid so it follows the photo's corner instead of leaving notches.

     node scripts/fix-mock-corners.mjs      after a fresh export */
import fs from 'node:fs';

const dir = 'public/figma/';
const num = (rect, k) => +rect.match(new RegExp(` ${k}="([^"]+)"`))?.[1];

/* Every <rect> of a frame, in its fill, its clip and its inside stroke. */
function setRadius(svg, w, h, now, want) {
  let n = 0;
  const out = svg.replace(/<rect\b[^>]*>/g, rect => {
    const rw = num(rect, 'width'), rh = num(rect, 'height'), rx = num(rect, 'rx');
    if (!rx || Math.abs(rw - w) > 1.2 || Math.abs(rh - h) > 1.2 || Math.abs(rx - now) > 1) return rect;
    n++;
    return rect.replace(/ rx="[^"]+"/, ` rx="${want}"`);
  });
  return [out, n];
}

const FIXES = [
  // Today number 26 at 160 high, Today's progress 22 at 138, on the small phones.
  [['hero-phone', 'hero-phone-dark'], [[136.68, 62.55, 26, 10.07], [136.68, 56.09, 22, 8.52]]],
  [['why-day-m', 'why-day-m-dark'], [[136, 62.51, 26, 10.02], [136, 55.98, 22, 8.48], [23.98, 18.56, 9.28, 6.19]]],
  // The selected tab in the tab bar: rounded on C2, a pill on the copies.
  [['hero-phone', 'hero-phone-dark'], [[24.09, 18.65, 9.32, 6.22]]],
  [['hero-wide', 'hero-wide-dark'], [[38.95, 30.16, 15.08, 10.05]]],
  [['plan-today', 'plan-today-dark', 'how-phone', 'how-phone-dark'], [[44.6, 34.53, 17.27, 11.51]]],
  [['why-day', 'why-day-dark'], [[42.91, 33.22, 16.61, 11.07]]]
];

for (const [names, list] of FIXES) for (const name of names) {
  let svg = fs.readFileSync(`${dir}${name}.svg`, 'utf8');
  for (const [w, h, now, want] of list) {
    const [out, n] = setRadius(svg, w, h, now, want);
    svg = out;
    console.log(`${name}: ${w}x${h} r${now} -> r${want} on ${n} rects`);
  }
  fs.writeFileSync(`${dir}${name}.svg`, svg);
}

/* The polaroids: Screen has radius 20 inside a Photo with radius 6, which
   showed the grey photo at every corner. */
for (const name of ['why-day', 'why-day-dark', 'why-day-m', 'why-day-m-dark', 'why-systems', 'why-systems-dark']) {
  const file = `${dir}${name}.svg`;
  if (!fs.existsSync(file)) continue;
  let svg = fs.readFileSync(file, 'utf8');
  const W = +svg.match(/ width="([\d.]+)"/)[1];
  let n = 0;
  svg = svg.replace(/<rect\b[^>]*>/g, rect => {
    if (num(rect, 'rx') !== 20 || num(rect, 'width') < W * .8) return rect;
    n++;
    return rect.replace(/ rx="[^"]+"/, ' rx="6"');
  });
  fs.writeFileSync(file, svg);
  console.log(`${name}: screen corners on ${n} rects`);
}

/* The chat's plan card: on AI5 it is a bubble, 20 20 20 6, with no outline. In
   the mock-up it is square with a dark line, so the line goes and it gets the
   bubble's shape, scaled. */
const CARD = 'M31.92 146.17h173.05V331.6H31.92z';
const r = 10.55, tail = 3.17, [x, y, w, h] = [31.92, 146.17, 173.05, 185.43];
const BUBBLE = `M${x + r} ${y}h${(w - 2 * r).toFixed(2)}a${r} ${r} 0 0 1 ${r} ${r}v${(h - 2 * r).toFixed(2)}a${r} ${r} 0 0 1-${r} ${r}H${x + tail}a${tail} ${tail} 0 0 1-${tail}-${tail}V${y + r}a${r} ${r} 0 0 1 ${r}-${r}z`;
for (const name of ['plan-ai', 'plan-ai-dark']) {
  const file = `${dir}${name}.svg`;
  let svg = fs.readFileSync(file, 'utf8');
  const lines = svg.match(new RegExp(`<path stroke="[^"]+" stroke-width="[^"]+" d="${CARD}"/>`, 'g'))?.length || 0;
  svg = svg.replace(new RegExp(`<path stroke="[^"]+" stroke-width="[^"]+" d="${CARD}"/>`, 'g'), '');
  const shapes = svg.split(CARD).length - 1;
  svg = svg.split(CARD).join(BUBBLE);
  svg = svg.replace(/(<rect width="190\.46" height="185\.96"[^>]*?) rx="22"/g, '$1');
  fs.writeFileSync(file, svg);
  console.log(`${name}: plan card ${shapes} shapes, ${lines} lines removed`);
}
