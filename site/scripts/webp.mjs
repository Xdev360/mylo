/* Turns the PNG art in public/figma into WebP next to it, at the same
   pixel size (the level badges, exported far larger than they are drawn,
   come down to 2x). Kept as PNG: the share image, which social sites read,
   and the cursors, which browsers want as PNG. Run: node scripts/webp.mjs */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const dir = path.resolve('public/figma');
const keep = /^(share|pgp-cursor-.*)\.png$/;
let before = 0, after = 0;
for (const f of fs.readdirSync(dir)) {
  if (!f.endsWith('.png') || keep.test(f)) continue;
  const src = path.join(dir, f), out = src.replace(/\.png$/, '.webp');
  let img = sharp(src);
  if (/^rm-badge-/.test(f)) img = img.resize({ width: 128 });
  await img.webp({ quality: 82, alphaQuality: 90, effort: 5 }).toFile(out);
  before += fs.statSync(src).size; after += fs.statSync(out).size;
  fs.unlinkSync(src);
}
console.log(`png ${(before / 1024).toFixed(0)} KiB -> webp ${(after / 1024).toFixed(0)} KiB`);
