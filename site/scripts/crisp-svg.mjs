/* Keeps Figma's SVG exports sharp in Safari.

   WebKit draws everything inside an SVG <filter> into a low-resolution
   buffer, and Figma exports a shadow as a filter on the whole group it
   belongs to: a phone, a card, the entire hero. So in Safari and on every
   iPhone the art inside came out soft, as if screenshotted.

   This splits each filter into what it really is, with the art itself left
   as plain vector:

     <g filter="shadow+art+inner">art</g>
   becomes
     <use filter="shadow" href="#art"/>   the soft part, only that
     <g id="art">art</g>                  crisp at any zoom
     <use filter="inner" href="#art"/>    inner shadows and highlights

   The inner layer is clipped to the art's own outline, so its low-resolution
   edge cannot show as a staircase on top of the sharp one.

   A filter that blurs the art itself (a Figma layer blur) is soft on purpose
   and stays as it is.

   WebKit does the same to <mask>, and Figma exports every inside stroke as
   one. A mask that is only solid shapes means exactly what a clip means, and a
   clip is drawn as vector, so those become clipPaths.

   A shadow on the whole drawing that reaches past the image's own edge is cut
   off square there, which showed as a pale box around phones, cards and
   badges. It is taken out and printed as the CSS drop-shadow to use instead,
   which an image's edge does not stop.

   Glass goes the same way. Figma exports a background blur as a backdrop-
   filter in a <foreignObject>, which does nothing inside an image, so whatever
   sits behind a frosted bar showed through it sharp. The object is removed and
   the bar's fill thickened to what the blur reads as.

     node scripts/crisp-svg.mjs public/figma/a.svg [more.svg ...]        */
import fs from 'node:fs';

/* These files are machine-written: tags, attributes and nothing clever, so a
   small tree is enough and no XML dependency has to ship for one script. */
function parse(src) {
  const root = { name: '#root', attrs: {}, kids: [] };
  const stack = [root];
  const tag = /<(\/?)([\w:-]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/g;
  let m, at = 0;
  while ((m = tag.exec(src))) {
    if (m.index !== at) throw new Error(`cannot read the SVG at ${at}`);
    at = tag.lastIndex;
    if (m[5] !== undefined) { if (m[5].trim()) stack.at(-1).kids.push({ text: m[5] }); continue; }
    if (m[1]) { stack.pop(); continue; }
    const attrs = {};
    for (const a of m[3].matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[a[1]] = a[2];
    const node = { name: m[2], attrs, kids: [] };
    stack.at(-1).kids.push(node);
    if (!m[4]) stack.push(node);
  }
  if (at !== src.length) throw new Error(`cannot read the SVG at ${at}`);
  return root;
}

function print(n) {
  if (n.text !== undefined) return n.text;
  const inner = n.kids.map(print).join('');
  if (n.name === '#root') return inner;
  const attrs = Object.entries(n.attrs).map(([k, v]) => ` ${k}="${v}"`).join('');
  return inner ? `<${n.name}${attrs}>${inner}</${n.name}>` : `<${n.name}${attrs}/>`;
}

function walk(n, fn) {
  for (const k of [...(n.kids || [])]) { if (k.name) { fn(k, n); walk(k, fn); } }
}

/* Applied by the wrapper, so they still cover the shadow as well as the art. */
const OUTER = ['transform', 'clip-path', 'mask', 'opacity', 'style'];

const SHAPES = new Set(['path', 'rect', 'circle', 'ellipse', 'polygon']);

/* The art's outline as a clipPath, when it is plain shapes all the way down:
   a clipPath cannot hold a group, so nested groups are flattened, carrying
   their transforms. Anything else (a mask, a clip, a stroke) returns null and
   the layer goes unclipped. */
function outlineOf(n, transform = '') {
  const t = [transform, n.attrs.transform].filter(Boolean).join(' ');
  if (n.attrs.mask || n.attrs['clip-path'] || n.attrs.filter || n.attrs.stroke) return null;
  if (SHAPES.has(n.name)) {
    if (n.attrs.fill === 'none') return [];
    const { fill: _f, id: _i, opacity: _o, style: _s, ...attrs } = n.attrs;
    return [{ name: n.name, attrs: { ...attrs, ...(t ? { transform: t } : {}) }, kids: [] }];
  }
  if (n.name !== 'g') return null;
  const out = [];
  for (const k of n.kids) {
    const part = k.name ? outlineOf(k, t) : [];
    if (!part) return null;
    out.push(...part);
  }
  return out;
}

function splitFilter(f) {
  const prims = f.kids.filter(k => k.name);
  const at = prims.findIndex(p => p.name === 'feBlend' && p.attrs.in === 'SourceGraphic');
  if (at < 0) return null;
  const shape = prims[at].attrs.result;
  const later = prims.slice(at + 1);
  // A blur of the art itself: soft by design.
  if (prims.some(p => p.name === 'feGaussianBlur' && p.attrs.in === 'SourceGraphic')) return null;
  if (later[0]?.name === 'feGaussianBlur' && !later[0].attrs.in) return null;
  if (later.some(p => p.attrs.in === 'SourceGraphic')) return null;

  const flood = prims[0];
  if (flood.name !== 'feFlood' || flood.attrs['flood-opacity'] !== '0') return null;
  const clear = flood.attrs.result;
  const before = prims.slice(0, at);
  const after = later.map(p => ({ ...p, attrs: Object.fromEntries(
    Object.entries(p.attrs).map(([k, v]) => [k, v === shape ? clear : v])) }));
  return {
    under: before.length > 1 ? { ...f, attrs: { ...f.attrs, id: `${f.attrs.id}-u` }, kids: before } : null,
    over: after.length ? { ...f, attrs: { ...f.attrs, id: `${f.attrs.id}-o` }, kids: [flood, ...after] } : null
  };
}

const WHITE = new Set(['#fff', '#ffffff', 'white']);

/* The solid shapes of a mask, or null if it does anything a clip cannot: a
   gradient, a partial opacity, a stroke, black to cut a hole. In an alpha mask
   any solid colour counts; in a luminance mask only white does. */
function maskShapes(mask, opaque) {
  const alpha = /mask-type:\s*alpha/.test(mask.attrs.style || '');
  const isSolid = (fill, n) => {
    if (n.attrs.stroke || n.attrs.filter || n.attrs.mask || n.attrs['clip-path']) return false;
    if (n.attrs.opacity || n.attrs['fill-opacity']) return false;
    if (!fill) return false;
    if (fill.startsWith('url(')) return alpha && opaque.has(fill.slice(5, -1));
    return alpha ? fill !== 'none' : WHITE.has(fill.toLowerCase());
  };
  const out = [];
  const take = (n, fill, transform) => {
    const f = n.attrs.fill ?? fill;
    const t = [transform, n.attrs.transform].filter(Boolean).join(' ');
    if (n.name === 'g') {
      if (!isSolid(f, n)) return false;
      return n.kids.every(k => !k.name || take(k, f, t));
    }
    if (!(SHAPES.has(n.name) || n.name === 'use') || !isSolid(f, n)) return false;
    const { fill: _f, 'fill-rule': rule, id: _i, style: _s, ...attrs } = n.attrs;
    delete attrs.transform;
    if (t) attrs.transform = t;
    if (rule && !attrs['clip-rule']) attrs['clip-rule'] = rule;
    out.push({ name: n.name, attrs, kids: [] });
    return true;
  };
  const kids = mask.kids.filter(k => k.name);
  return kids.length && kids.every(k => take(k, mask.attrs.fill)) ? out : null;
}

function masksToClips(root) {
  // A gradient with no transparency in it masks like a solid.
  const opaque = new Set();
  walk(root, n => {
    if (!/Gradient$/.test(n.name)) return;
    const seeThrough = n.kids.some(k => k.name === 'stop' && +(k.attrs['stop-opacity'] ?? 1) < 1);
    if (!seeThrough && n.kids.some(k => k.name === 'stop')) opaque.add(n.attrs.id);
  });
  const clipIds = new Set();
  walk(root, n => {
    if (n.name !== 'mask') return;
    const shapes = maskShapes(n, opaque);
    if (!shapes) return;
    clipIds.add(n.attrs.id);
    n.name = 'clipPath';
    n.attrs = { id: n.attrs.id };
    n.kids = shapes;
  });
  walk(root, (n, p) => {
    const id = n.attrs.mask?.match(/^url\(#(.+)\)$/)?.[1];
    if (!clipIds.has(id)) return;
    delete n.attrs.mask;
    if (n.attrs['clip-path']) {
      // The element keeps its own clip; the old mask goes on a group around it.
      p.kids[p.kids.indexOf(n)] = { name: 'g', attrs: { 'clip-path': `url(#${id})` }, kids: [n] };
    } else n.attrs['clip-path'] = `url(#${id})`;
  });
}

function shadowAsCss(f) {
  const of = f.kids.find(k => k.name === 'feOffset')?.attrs || {};
  const blur = +f.kids.find(k => k.name === 'feGaussianBlur')?.attrs.stdDeviation || 0;
  const m = f.kids.filter(k => k.name === 'feColorMatrix').at(-1).attrs.values.split(/\s+/).map(Number);
  const rgb = [m[4], m[9], m[14]].map(v => Math.round(v * 255)).join(',');
  return `drop-shadow(${+of.dx || 0}px ${+of.dy || 0}px ${+(blur * 2).toFixed(2)}px rgba(${rgb},${m[18]}))`;
}

function liftRootShadow(root) {
  const svg = root.kids.find(k => k.name === 'svg');
  const W = +svg.attrs.width, H = +svg.attrs.height;
  const first = svg.kids.find(k => k.name && k.name !== 'defs');
  const holder = first?.name === 'g' && first.kids[0]?.name === 'use' ? first : svg;
  const use = holder.kids[0];
  if (use?.name !== 'use' || !use.attrs.filter?.endsWith('-u)')) return null;
  const id = use.attrs.filter.slice(5, -1);
  let f = null, defs = null;
  walk(root, (n, p) => { if (n.attrs.id === id) { f = n; defs = p; } });
  const x = +f.attrs.x, y = +f.attrs.y;
  if (x >= -.5 && y >= -.5 && x + +f.attrs.width <= W + .5 && y + +f.attrs.height <= H + .5) return null;
  const css = shadowAsCss(f);
  holder.kids.shift();
  defs.kids.splice(defs.kids.indexOf(f), 1);
  return css;
}

const GLASS = .94;

function thickenGlass(root) {
  walk(root, (n, p) => {
    if (n.name === 'foreignObject') p.kids.splice(p.kids.indexOf(n), 1);
  });
  walk(root, n => {
    if (n.attrs['data-figma-bg-blur-radius'] === undefined) return;
    delete n.attrs['data-figma-bg-blur-radius'];
    const fill = n.kids.find(k => k.name && k.attrs['fill-opacity']);
    if (fill) fill.attrs['fill-opacity'] = String(GLASS);
  });
}

export function crisp(src) {
  const root = parse(src);
  masksToClips(root);
  thickenGlass(root);
  const filters = new Map();
  walk(root, n => { if (n.name === 'filter') filters.set(n.attrs.id, n); });

  const parents = [];
  walk(root, (n, p) => { if (n.attrs.filter && n.name !== 'filter') parents.push([n, p]); });

  let split = 0, soft = 0;
  const clips = [];
  for (const [n, p] of parents) {
    const id = n.attrs.filter.match(/^url\(#(.+)\)$/)?.[1];
    const f = filters.get(id);
    const parts = f && splitFilter(f);
    if (!parts) { soft++; continue; }

    const artId = `${id}-art`;
    const wrapper = { name: 'g', attrs: {}, kids: [] };
    for (const k of OUTER) if (n.attrs[k] !== undefined) { wrapper.attrs[k] = n.attrs[k]; delete n.attrs[k]; }
    delete n.attrs.filter;
    n.attrs.id = artId;
    const use = fid => ({ name: 'use', attrs: { href: `#${artId}`, filter: `url(#${fid})` }, kids: [] });
    if (parts.under) wrapper.kids.push(use(parts.under.attrs.id));
    wrapper.kids.push(n);
    if (parts.over) {
      const { transform: _t, ...art } = n.attrs;
      const outline = outlineOf({ ...n, attrs: art });
      if (outline?.length) {
        const clipId = `${id}-edge`;
        clips.push({ name: 'clipPath', attrs: { id: clipId }, kids: outline });
        wrapper.kids.push({ name: 'g', attrs: { 'clip-path': `url(#${clipId})` }, kids: [use(parts.over.attrs.id)] });
      } else wrapper.kids.push(use(parts.over.attrs.id));
    }
    p.kids[p.kids.indexOf(n)] = wrapper;

    const holder = [];
    walk(root, (x, xp) => { if (x === f) holder.push(xp); });
    const defs = holder[0];
    defs.kids.splice(defs.kids.indexOf(f), 1, ...[parts.under, parts.over].filter(Boolean));
    split++;
  }
  if (clips.length) {
    let defs = null;
    walk(root, x => { if (x.name === 'defs') defs ||= x; });
    defs.kids.push(...clips);
  }
  const shadow = liftRootShadow(root);
  return { svg: print(root), split, soft, shadow };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  for (const file of process.argv.slice(2)) {
    const before = fs.readFileSync(file, 'utf8');
    const { svg, split, soft, shadow } = crisp(before);
    fs.writeFileSync(file, svg);
    console.log(`${file}: ${split} split, ${soft} left soft, ${before.length} -> ${svg.length} bytes${shadow ? `, css: ${shadow}` : ''}`);
  }
}
