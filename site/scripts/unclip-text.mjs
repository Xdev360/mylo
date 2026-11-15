/* Some of the phone mock-ups in the Figma file wrap their text in invisible
   frames that have rounded corners and clip their content, so the corner
   slices the first or last letter: "Thursday" came out as "hursday", "tasks
   left" as "tasks lef". Figma's own render does the same.

   The frame's corner does nothing else, there being no fill to round, so this
   squares the clip off in the export. It asks Figma which frames those are,
   and only touches a frame that holds text, draws nothing and has no child
   filling it.

     FIGMA_TOKEN=... node scripts/unclip-text.mjs name=NODE_ID [name=NODE_ID ...]
   for public/figma/name.svg. */
import fs from 'node:fs';
import path from 'node:path';

const FILE = 'V9DfX3Oc3FSM9T9P9YYb7X';
const headers = { 'X-Figma-Token': process.env.FIGMA_TOKEN };
const shows = p => p.visible !== false && (p.opacity ?? 1) > 0 && (p.color?.a ?? 1) > 0;
const holdsText = n => n.type === 'TEXT' || (n.children || []).some(holdsText);

function culprits(n, out = []) {
  const w = n.size?.x, h = n.size?.y;
  if (n.clipsContent && n.cornerRadius > 0 && w && h
      && !(n.fills || []).some(shows) && !(n.strokes || []).some(shows)
      && holdsText(n)
      && !(n.children || []).some(k => k.type !== 'TEXT' && k.size?.x >= w * .9 && k.size?.y >= h * .9)) {
    out.push({ w, h, r: n.cornerRadius });
  }
  for (const k of n.children || []) culprits(k, out);
  return out;
}

/* A whole phone can be too much for one request: Figma answers 400, and its
   children are asked for one at a time. */
async function ask(url) {
  let res = await fetch(url, { headers });
  while (res.status === 429) {
    await new Promise(r => setTimeout(r, 30000));
    res = await fetch(url, { headers });
  }
  return res;
}

async function framesIn(id) {
  const base = `https://api.figma.com/v1/files/${FILE}/nodes?ids=${encodeURIComponent(id)}`;
  const res = await ask(`${base}&geometry=paths`);
  if (res.ok) return culprits((await res.json()).nodes[id].document);
  if (res.status !== 400) throw new Error(`${id}: Figma said ${res.status}`);
  const top = await ask(`${base}&depth=1`);
  if (!top.ok) throw new Error(`${id}: Figma said ${top.status}`);
  const out = [];
  for (const k of (await top.json()).nodes[id].document.children || []) out.push(...await framesIn(k.id));
  return out;
}

/* An export can be scaled a little (160 comes out as 160.11), so the match is
   on the frame's proportions and its corner, not its exact size. */
function sameFrame(w, h, rx, f) {
  const scale = w / f.w;
  return scale > .5 && scale < 2
    && Math.abs(h - f.h * scale) < .06
    && Math.abs(rx - Math.min(f.r, f.w / 2, f.h / 2) * scale) < .06;
}

for (const arg of process.argv.slice(2)) {
  const [name, id] = arg.split('=');
  const found = await framesIn(id);
  if (!found.length) continue;

  const file = path.join('public/figma', `${name}.svg`);
  let svg = fs.readFileSync(file, 'utf8');
  let fixed = 0;
  svg = svg.replace(/<clipPath\b[^>]*>(<rect\b[^>]*>)<\/clipPath>/g, (whole, rect) => {
    const a = k => +rect.match(new RegExp(` ${k}="([^"]+)"`))?.[1];
    if (!a('rx') || !found.some(f => sameFrame(a('width'), a('height'), a('rx'), f))) return whole;
    fixed++;
    return whole.replace(/ rx="[^"]+"/, '').replace(/ ry="[^"]+"/, '');
  });
  fs.writeFileSync(file, svg);
  console.log(`${name}: ${found.length} frames, ${fixed} clips squared`);
}
