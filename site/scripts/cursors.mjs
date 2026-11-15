/* Rebuilds the two hand cursors from Figma's "Cursor · grab (hover)"
   (1134:2927) and "Cursor · grabbing (dragging)" (1134:2934), exported as
   SVG into scripts/cursors/.

   Figma draws each finger as an open stroke with a white fill, so the gaps
   where fingers meet the palm are left unfilled and the page shows through.
   This renders the drawing large without its shadow, finds every pixel the
   outline encloses (anything a flood fill from the edge cannot reach) and
   paints it white under the ink, puts Figma's shadow back under the whole
   hand (0 3 6, 25% black), then writes the 2x picture the board shows and
   the 1x one CSS uses as the cursor. Run: node scripts/cursors.mjs */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const SCALE = 8;
const out = path.resolve('public/figma');

for (const name of ['grab', 'grabbing']) {
  const svg = Buffer.from(fs.readFileSync(path.resolve('scripts/cursors', `${name}.svg`), 'utf8')
    .replace(/ filter="url\(#[^)]+\)"/, ''));
  const { data, info } = await sharp(svg, { density: 72 * SCALE }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  // Outside = reachable from the border through pixels that are not ink.
  const outside = new Uint8Array(w * h);
  const stack = [];
  const open = i => data[i * 4 + 3] < 128;
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const i = stack.pop();
    if (outside[i] || !open(i)) continue;
    outside[i] = 1;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < w - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - w);
    if (y < h - 1) stack.push(i + w);
  }

  // Inside: the pixel laid over white, fully opaque.
  for (let i = 0; i < w * h; i++) {
    if (outside[i]) continue;
    const a = data[i * 4 + 3] / 255;
    for (let c = 0; c < 3; c++) data[i * 4 + c] = Math.round(data[i * 4 + c] * a + 255 * (1 - a));
    data[i * 4 + 3] = 255;
  }

  // The shadow, from the filled shape's own alpha: offset 3, blur 3.
  const shadow = Buffer.alloc(w * h * 4);
  const dy = 3 * SCALE;
  for (let i = dy * w; i < w * h; i++) shadow[i * 4 + 3] = data[(i - dy * w) * 4 + 3] * .25;
  const shadowPng = await sharp(shadow, { raw: { width: w, height: h, channels: 4 } })
    .blur(3 * SCALE).png().toBuffer();
  const hand = await sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
  const big = sharp(shadowPng).composite([{ input: hand }]);
  const flat = await big.png().toBuffer();
  const base = w / SCALE;
  await sharp(flat).resize(base * 2).png().toFile(path.join(out, `pgp-cursor-${name}.png`));
  await sharp(flat).resize(base).png().toFile(path.join(out, `pgp-cursor-${name}-1x.png`));
  console.log(name, `${base * 2}px and ${base}px`);
}
