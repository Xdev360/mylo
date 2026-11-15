'use client';

import { BODY } from './Mylo';
import { COLOURS, STYLES, WEAR, type Look } from '@/lib/world';

/* Draws a saved look (and what is behind it) into a picture, for "Share my
   Mylo" and for saving a photo: the same Figma parts the screens use, laid
   on a canvas. */
function load(src: string) {
  return new Promise<HTMLImageElement>((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
}
function bodySvg(colour: string) {
  const c = COLOURS.find(x => x.id === colour) ?? COLOURS[0];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="720" viewBox="0 0 300 360"><defs><clipPath id="c"><path d="${BODY}"/></clipPath><filter id="a" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="23"/></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="15"/></filter></defs><ellipse cx="150" cy="347" rx="95" ry="11" fill="#1D1D22" fill-opacity="0.08"/><path d="${BODY}" fill="${c.body}"/><g clip-path="url(#c)"><ellipse cx="300" cy="230" rx="100" ry="190" fill="${c.shade}" opacity="0.9" filter="url(#a)"/><ellipse cx="150" cy="365" rx="170" ry="45" fill="${c.shade}" opacity="0.8" filter="url(#b)"/></g></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export async function drawMylo(ctx: CanvasRenderingContext2D, look: Look, x: number, y: number, w: number) {
  const h = w * 1.2;
  const style = look.style ? STYLES.find(s => s.id === look.style) : null;
  if (style) { ctx.drawImage(await load(`/figma/world/style/${style.art}.svg`), x, y, w, h); return; }
  ctx.drawImage(await load(bodySvg(look.colour)), x, y, w, h);
  ctx.drawImage(await load(`/figma/world/mylo/face-${look.face}.svg`), x, y, w, h);
  for (const id of [...look.extras.filter(e => e !== look.outfit), ...(look.outfit ? [look.outfit] : [])]) {
    const p = WEAR[id]; if (!p) continue;
    ctx.drawImage(await load(`/figma/world/mylo/wear-${id}.svg`), x, y + ((360 - p.h) / 360) * h, (p.w / 300) * w, (p.h / 360) * h);
  }
}

/* `bg` is a gradient pair or a picture under /figma, drawn to cover. */
export async function lookPicture(look: Look, bg: { from: string; to: string } | string, size = 1080, extra?: (ctx: CanvasRenderingContext2D, s: number) => Promise<void> | void) {
  const cv = document.createElement('canvas');
  cv.width = size; cv.height = size;
  const ctx = cv.getContext('2d')!;
  if (typeof bg === 'string') {
    const img = await load(bg);
    const k = Math.max(size / img.naturalWidth, size / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  } else {
    const g = ctx.createLinearGradient(0, 0, 0, size);
    g.addColorStop(0, bg.from); g.addColorStop(1, bg.to);
    ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  }
  if (extra) await extra(ctx, size);
  else await drawMylo(ctx, look, size * 0.24, size * 0.16, size * 0.52);
  return new Promise<Blob>((ok, no) => cv.toBlob(b => (b ? ok(b) : no(new Error('no picture'))), 'image/png'));
}

/* Shares the picture where the device can, and saves it where it cannot. */
export async function shareOrSave(blob: Blob, name: string, share = true) {
  const file = new File([blob], name, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (share && nav.canShare?.({ files: [file] })) {
    try { await nav.share({ files: [file] }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
