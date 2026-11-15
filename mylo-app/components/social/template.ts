'use client';

import { FILTERS, type Person, type Post } from '@/lib/social';

/* Draws a post onto a downloadable picture (VF15): a story, post, square or
   status, on one of six backgrounds, with or without the person's name and the
   Mylo mark. Measured from the 208 wide story preview in Figma and scaled. */
export type Format = 'Story 9:16' | 'Post 4:5' | 'Square 1:1' | 'Status 9:16';
export type Bg = 'Clean' | 'Night' | 'Graphite' | 'Mist' | 'Sky' | 'Sage';
export const FORMATS: Record<Format, { w: number; h: number; slug: string }> = {
  'Story 9:16': { w: 1080, h: 1920, slug: 'story' },
  'Post 4:5': { w: 1080, h: 1350, slug: 'post' },
  'Square 1:1': { w: 1080, h: 1080, slug: 'square' },
  'Status 9:16': { w: 1080, h: 1920, slug: 'status' }
};
export const BGS: Record<Bg, { fill: string | [string, string]; ink: string; sub: string; dark: boolean }> = {
  Clean: { fill: '#FFFFFF', ink: '#0F0F12', sub: '#6B6B73', dark: false },
  Night: { fill: '#111114', ink: '#FFFFFF', sub: '#A3A3AB', dark: true },
  Graphite: { fill: ['#3A3A40', '#0F0F12'], ink: '#FFFFFF', sub: '#A3A3AB', dark: true },
  Mist: { fill: ['#FFFFFF', '#E4E4E8'], ink: '#0F0F12', sub: '#6B6B73', dark: false },
  Sky: { fill: '#EAF1FF', ink: '#0F0F12', sub: '#6B6B73', dark: false },
  Sage: { fill: '#E7F2EC', ink: '#0F0F12', sub: '#6B6B73', dark: false }
};
export type TemplateOpts = { format: Format; bg: Bg; showName: boolean; watermark: boolean };

const images = new Map<string, Promise<HTMLImageElement>>();
function load(src: string) {
  if (!images.has(src)) images.set(src, new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }));
  return images.get(src)!;
}
function family() {
  return typeof document === 'undefined' ? 'sans-serif' : getComputedStyle(document.body).fontFamily || 'sans-serif';
}
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number) {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width <= width || !line) line = test; else { out.push(line); line = word; }
    }
    out.push(line);
  }
  return out;
}
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/* Renders at `width` pixels wide (1080 for the file, smaller for previews). */
export async function renderTemplate(post: Post, by: Person, o: TemplateOpts, width = 1080, size?: { w: number; h: number }) {
  const f = size ?? FORMATS[o.format];
  const W = width, H = Math.round(width * f.h / f.w), k = W / 208;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  const bg = BGS[o.bg];
  if (Array.isArray(bg.fill)) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, bg.fill[0]); g.addColorStop(1, bg.fill[1]); ctx.fillStyle = g; }
  else ctx.fillStyle = bg.fill;
  ctx.fillRect(0, 0, W, H);

  const fam = family();
  try { await document.fonts.load(`600 ${Math.round(17.68 * k)}px ${fam}`); } catch { /* system font */ }
  const pad = 21 * k, foot = 18 * k, maxW = W - pad * 2;
  const top = pad * 1.4, bottom = H - foot - 40 * k;

  const lineText = post.kind === 'quote'
    ? [post.saidBy, o.showName ? `@${by.handle}` : null].filter(Boolean).join(' · ')
    : o.showName ? `${by.name} · @${by.handle}` : '';

  let photo: HTMLImageElement | null = null;
  if (post.kind === 'photo' && post.photos?.[0]) { try { photo = await load(post.photos[0]); } catch { photo = null; } }

  // The words, shrunk until they fit the space left.
  const body = post.kind === 'photo' ? post.text : `“${post.text}”`;
  let fs = (post.kind === 'photo' ? 13 : 17.68) * k;
  const subFs = 10.4 * k;
  let lines: string[] = [];
  const photoH = photo ? Math.min(maxW * 1.25, (bottom - top) * (body ? 0.72 : 0.9)) : 0;
  const room = bottom - top - photoH - (photo ? 14 * k : 0) - (lineText ? subFs * 1.3 + 10 * k : 0);
  for (let i = 0; i < 24; i++) {
    ctx.font = `600 ${fs}px ${fam}`;
    lines = body ? wrap(ctx, body, maxW) : [];
    if (lines.length * fs * 1.25 <= room || fs < 8 * k) break;
    fs *= 0.92;
  }
  const lh = fs * 1.25;
  const textH = lines.length * lh + (lineText ? 10 * k + subFs * 1.3 : 0);
  const blockH = photoH + (photo && textH ? 14 * k : 0) + textH;
  let y = photo ? top + Math.max(0, (bottom - top - blockH) / 2) : Math.max(top, (H - textH) * 0.45);

  if (photo) {
    const pw = maxW, ph = photoH, r = 12 * k;
    ctx.save(); rounded(ctx, pad, y, pw, ph, r); ctx.clip();
    const s = Math.max(pw / photo.naturalWidth, ph / photo.naturalHeight);
    const dw = photo.naturalWidth * s, dh = photo.naturalHeight * s;
    const filt = FILTERS[post.filter ?? 'Normal'];
    if (filt !== 'none' && 'filter' in ctx) ctx.filter = filt;
    ctx.drawImage(photo, pad + (pw - dw) / 2, y + (ph - dh) / 2, dw, dh);
    ctx.restore();
    y += ph + 14 * k;
  }
  ctx.fillStyle = bg.ink; ctx.textBaseline = 'top';
  ctx.font = `600 ${fs}px ${fam}`;
  for (const l of lines) { ctx.fillText(l, pad, y + (lh - fs) / 2); y += lh; }
  if (lineText) {
    y += 10 * k;
    ctx.fillStyle = bg.sub; ctx.font = `500 ${subFs}px ${fam}`;
    ctx.fillText(lineText, pad, y);
  }

  if (o.watermark) {
    ctx.fillStyle = bg.ink; ctx.font = `600 ${11.44 * k}px ${fam}`; ctx.textBaseline = 'alphabetic';
    ctx.fillText('mylo', pad, H - foot - 3 * k);
    try {
      const m = await load('/figma/social/mylo-mark.svg');
      const mw = 21 * k, mh = 25 * k;
      ctx.drawImage(m, W - pad - mw, H - foot - mh + 2 * k, mw, mh);
    } catch { /* the word is enough */ }
  }
  return c;
}

export const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('blob'))), 'image/png'));

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* Hands the picture to the phone's share sheet; false when it can't. */
export async function shareBlob(blob: Blob, name: string, text?: string) {
  const file = new File([blob], name, { type: 'image/png' });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], text }); return true; } catch (e) { return (e as Error)?.name === 'AbortError'; }
  }
  return false;
}
