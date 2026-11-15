import { RARITY, cardNo, type Card } from '@/lib/rewards';

/* Draws the SH download templates (SH1 to SH4) on a canvas, at any size: the
   frames are laid out on a 208 wide preview, so everything here is in those
   units and scaled. The same drawing makes the preview, the background
   thumbnails and the 1080 wide image that is downloaded or shared. */

export type Format = { id: string; label: string; w: number; h: number };
export const FORMATS: Format[] = [
  { id: 'story', label: 'Story 9:16', w: 1080, h: 1920 },
  { id: 'post', label: 'Post 4:5', w: 1080, h: 1350 },
  { id: 'square', label: 'Square 1:1', w: 1080, h: 1080 },
  { id: 'status', label: 'Status 9:16', w: 1080, h: 1920 }
];

export type Bg = { id: string; name: string; fill: string | [string, string]; ink: string; sub: string; stroke?: string };
export const BGS: Bg[] = [
  { id: 'clean', name: 'Clean', fill: '#FFFFFF', ink: '#0F0F12', sub: '#6B6B73', stroke: '#E1E1E6' },
  { id: 'night', name: 'Night', fill: '#111114', ink: '#FFFFFF', sub: '#A3A3AB' },
  { id: 'graphite', name: 'Graphite', fill: ['#3A3A40', '#0F0F12'], ink: '#FFFFFF', sub: '#A3A3AB' },
  { id: 'mist', name: 'Mist', fill: ['#FFFFFF', '#E4E4E8'], ink: '#0F0F12', sub: '#6B6B73', stroke: '#E1E1E6' },
  { id: 'sky', name: 'Sky', fill: '#EAF1FF', ink: '#0F0F12', sub: '#4A5B7A' },
  { id: 'sage', name: 'Sage', fill: '#E7F2EC', ink: '#0F0F12', sub: '#4F6B5B' }
];

export type Art =
  | { kind: 'card'; card: Card; img: HTMLImageElement }
  | { kind: 'image'; img: HTMLImageElement; w: number; h: number; glow?: string };

export type Scene = { art: Art; title: string; sub?: string; name?: string; watermark: boolean; mylo: HTMLImageElement | null; font: string };

export function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, no) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = no;
    img.src = src;
  });
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const words = text.split(' '); const lines: string[] = []; let line = '';
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (ctx.measureText(t).width > max && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}

function sparkle(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.15, cy - r * 0.15, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.15, cy + r * 0.15, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.15, cy + r * 0.15, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.15, cy - r * 0.15, cx, cy - r);
  ctx.fill();
}

/* The card, as RwCard draws it, w wide at (x, y). */
export function drawCard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, card: Card, img: HTMLImageElement, font: string) {
  const u = w / 220; const h = 323 * u; const r = RARITY[card.rarity];
  const stops = { common: ['#F4F6FA', '#C3C9D6', '#9AA2B4'], rare: ['#BFD8FF', '#5B8EF0', '#2F5FD0'], epic: ['#E4D4FF', '#9B6BF0', '#5A2DC0'], legendary: ['#FFF1B8', '#F5C64A', '#B97A12'] }[card.rarity];
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,.22)'; ctx.shadowBlur = 24 * u; ctx.shadowOffsetY = 10 * u;
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, stops[0]); g.addColorStop(0.55, stops[1]); g.addColorStop(1, stops[2]);
  ctx.fillStyle = g; rr(ctx, x, y, w, h, 19 * u); ctx.fill();
  ctx.restore();
  const ix = x + 5 * u, iy = y + 5 * u, iw = w - 10 * u, ih = h - 10 * u;
  ctx.fillStyle = '#FFFFFF'; rr(ctx, ix, iy, iw, ih, 14.7 * u); ctx.fill();
  ctx.save(); rr(ctx, ix, iy, iw, 214 * u, [14.7 * u, 14.7 * u, 0, 0]); ctx.clip();
  ctx.drawImage(img, ix, iy, iw, 214 * u);
  ctx.restore();
  // rarity pill
  ctx.font = `600 ${8.8 * u}px ${font}`;
  const lw = ctx.measureText(r.label).width;
  ctx.fillStyle = r.pill; rr(ctx, ix + 8 * u, iy + 9 * u, lw + 26 * u, 18 * u, 9 * u); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; sparkle(ctx, ix + 15.5 * u, iy + 18 * u, 3.5 * u);
  ctx.textBaseline = 'middle'; ctx.fillText(r.label, ix + 22.5 * u, iy + 18.5 * u);
  // number pill
  const no = cardNo(card); ctx.font = `600 ${8 * u}px ${font}`;
  const nw = ctx.measureText(no).width + 16 * u;
  ctx.fillStyle = 'rgba(255,255,255,.7)'; rr(ctx, ix + iw - 7 * u - nw, iy + 9 * u, nw, 17 * u, 8.5 * u); ctx.fill();
  ctx.fillStyle = '#3A3A44'; ctx.fillText(no, ix + iw - 7 * u - nw + 8 * u, iy + 18 * u);
  // text
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#0F0F12'; ctx.font = `600 ${16.13 * u}px ${font}`; ctx.fillText(card.name, ix + 13 * u, iy + 240 * u);
  ctx.fillStyle = '#6B6B73'; ctx.font = `500 ${10.27 * u}px ${font}`;
  wrap(ctx, card.desc, 183 * u).slice(0, 2).forEach((l, i) => ctx.fillText(l, ix + 13 * u, iy + 259 * u + i * 14.4 * u));
  ctx.fillStyle = '#E9E9EE'; ctx.fillRect(ix + 13 * u, iy + 282 * u, 183 * u, Math.max(1, u));
  ctx.fillStyle = '#A3A3AB'; ctx.font = `500 ${8.8 * u}px ${font}`; ctx.fillText(card.source, ix + 13 * u, iy + 298 * u);
  for (let i = 0; i < 5; i++) { ctx.fillStyle = i < r.stars ? r.pill : '#D9D9DE'; sparkle(ctx, ix + 156 * u + i * 9 * u, iy + 295.5 * u, 3.5 * u); }
}

/* One template, w by h. */
export function drawScene(ctx: CanvasRenderingContext2D, w: number, h: number, bg: Bg, s: Scene) {
  const k = w / 208;
  ctx.clearRect(0, 0, w, h);
  if (Array.isArray(bg.fill)) { const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, bg.fill[0]); g.addColorStop(1, bg.fill[1]); ctx.fillStyle = g; }
  else ctx.fillStyle = bg.fill;
  ctx.fillRect(0, 0, w, h);

  // The art and the words, centred a little above the middle.
  const artH = s.art.kind === 'card' ? 159 : s.art.h;
  const block = artH + 22 + 18 + (s.sub ? 26 : 0);
  let y = (h / k) * 0.43 - block / 2;
  if (s.art.kind === 'card') {
    drawCard(ctx, (w - 114 * k) / 2, y * k, 114 * k, s.art.card, s.art.img, s.font);
  } else {
    const { img, w: aw, h: ah, glow } = s.art;
    ctx.save();
    if (glow) { ctx.shadowColor = glow; ctx.shadowBlur = 18 * k; ctx.shadowOffsetY = 6 * k; }
    ctx.drawImage(img, (w - aw * k) / 2, y * k, aw * k, ah * k);
    ctx.restore();
  }
  y += artH + 22;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = bg.ink; ctx.font = `600 ${15.6 * k}px ${s.font}`;
  ctx.fillText(s.title, w / 2, (y + 14) * k, w - 32 * k);
  if (s.sub) { ctx.fillStyle = bg.sub; ctx.font = `500 ${10.4 * k}px ${s.font}`; ctx.fillText(s.sub, w / 2, (y + 38) * k, w - 32 * k); }

  // Footer: the wordmark, your name, Mylo.
  ctx.textAlign = 'left';
  const fy = h - 22 * k;
  ctx.fillStyle = bg.ink; ctx.font = `600 ${11.44 * k}px ${s.font}`;
  ctx.fillText('mylo', 21 * k, fy);
  if (s.name) { const mw = ctx.measureText('mylo').width; ctx.fillStyle = bg.sub; ctx.font = `500 ${10.4 * k}px ${s.font}`; ctx.fillText(s.name, 21 * k + mw + 6 * k, fy); }
  if (s.watermark && s.mylo) ctx.drawImage(s.mylo, w - 41 * k, h - 42 * k, 21 * k, 25 * k);
}
