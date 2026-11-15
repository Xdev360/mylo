'use client';

import Link from 'next/link';
import { useRef } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { useHydrated } from '@/lib/local';
import { badgeHex, profileUrl, useProfile, type Profile } from '@/lib/profile';
import { useStreak } from '@/lib/goals';
import Room from './Room';
import { Avatar, Seal, copyText, useToast } from './bits';
import { useRoom } from './ProfileView';

/* P24 · Share profile card (877:116939). The card is drawn again on a canvas
   so "Save image" and "Story" hand over a real picture. */
const CW = 281, CH = 510, COVER = 250;
const SEAL = 'M11 0l2.888 2.108 3.575-.009 1.1 3.401 2.896 2.099L20.35 11l1.109 3.401-2.896 2.099-1.1 3.4-3.575-.008L11 22l-2.888-2.108-3.575.009-1.1-3.401L.541 14.401 1.65 11 .541 7.599 3.437 5.5l1.1-3.401 3.575.009L11 0z';

function loadImg(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src;
  });
}
function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
}

async function drawCard(svg: SVGSVGElement, p: Profile, meta: string, link: string, dark: boolean) {
  const S = 3, c = document.createElement('canvas');
  c.width = CW * S; c.height = CH * S;
  const ctx = c.getContext('2d')!; ctx.scale(S, S);
  const font = getComputedStyle(document.body).fontFamily;
  const ink = dark ? '#F5F5F7' : '#0F0F12', text2 = dark ? '#A3A3AC' : '#6B6B73', surf = dark ? '#2A2A2F' : '#F5F5F7';

  rr(ctx, 0, 0, CW, CH, 28); ctx.save(); ctx.clip();
  ctx.fillStyle = dark ? '#1F1F23' : '#FFFFFF'; ctx.fillRect(0, 0, CW, CH);

  // The room, then Mylo (an SVG drawn as an image cannot pull in Mylo itself).
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll('image').forEach(n => n.remove());
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); clone.setAttribute('width', '393'); clone.setAttribute('height', '300');
  const xml = new XMLSerializer().serializeToString(clone);
  const room = await loadImg(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`);
  const k = COVER / 300, rw = 393 * k, left = (CW - rw) / 2;
  ctx.drawImage(room, left, 0, rw, COVER);
  const mylo = await loadImg('/figma/profile/mylo-plain.svg');
  ctx.drawImage(mylo, left + 136 * k, (198 + 18 - 120) * k, 100 * k, 120 * k);

  // Photo
  const ax = 18, ay = 210, ar = 35;
  ctx.beginPath(); ctx.arc(ax + ar, ay + ar, ar + 3, 0, Math.PI * 2); ctx.fillStyle = dark ? '#1F1F23' : '#FFFFFF'; ctx.fill();
  ctx.save(); ctx.beginPath(); ctx.arc(ax + ar, ay + ar, ar, 0, Math.PI * 2); ctx.clip();
  ctx.fillStyle = dark ? '#2A2A2F' : '#EDEDF0'; ctx.fillRect(ax, ay, ar * 2, ar * 2);
  const src = p.photo ?? (p.myloLook ? '/figma/profile/mylo-plain.svg' : null);
  if (src) {
    try {
      const im = await loadImg(src);
      const s = Math.max((ar * 2) / im.width, (ar * 2) / im.height);
      ctx.drawImage(im, ax + ar - im.width * s / 2, ay + ar - im.height * s / 2, im.width * s, im.height * s);
    } catch { /* a photo the browser will not hand over stays blank */ }
  } else if (p.name) {
    ctx.fillStyle = '#2B3150'; ctx.fillRect(ax, ay, ar * 2, ar * 2);
    ctx.fillStyle = '#FFFFFF'; ctx.font = `600 28px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(p.name.trim()[0].toUpperCase(), ax + ar, ay + ar + 1);
  }
  ctx.restore();

  // Name, seal, meta
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ink; ctx.font = `600 24px ${font}`;
  const name = p.name || 'Mylo';
  ctx.fillText(name, 20, 320);
  if (p.verified) {
    const w = ctx.measureText(name).width;
    ctx.save(); ctx.translate(20 + w + 8, 302); ctx.fillStyle = badgeHex(p.badge); ctx.fill(new Path2D(SEAL));
    ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke(new Path2D('M6.967 11.275l2.75 2.658 5.316-5.5')); ctx.restore();
  }
  ctx.fillStyle = text2; ctx.font = `500 13px ${font}`; ctx.fillText(meta, 20, 344);

  // Link box
  rr(ctx, 20, 366, CW - 40, 60, 16); ctx.fillStyle = surf; ctx.fill();
  ctx.fillStyle = text2; ctx.font = `500 12px ${font}`; ctx.fillText('Add me on Mylo', 34, 388);
  ctx.fillStyle = ink; ctx.font = `600 15px ${font}`; ctx.fillText(link, 34, 410);

  // Mylo mark
  const icon = await loadImg('/brand/mylo-logo-192.webp');
  ctx.save(); rr(ctx, 20, 446, 40, 40, 10); ctx.clip(); ctx.drawImage(icon, 20, 446, 40, 40); ctx.restore();
  ctx.fillStyle = ink; ctx.font = `600 16px ${font}`; ctx.fillText('Mylo', 68, 472);
  ctx.restore();

  return new Promise<Blob>((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('No image'))), 'image/png'));
}

export default function ShareCard() {
  const hydrated = useHydrated();
  const { profile: p } = useProfile();
  const streakNow = useStreak();
  const [room] = useRoom();
  const svg = useRef<SVGSVGElement>(null);
  const toast = useToast();
  if (!hydrated) return <main className="screen on-desk" aria-busy="true" />;

  const days = streakNow;
  const meta = p.showStreak ? `Spark · ${days} day streak` : 'Spark';
  const url = p.username ? profileUrl(p.username) : '';
  const link = url.replace(/^https?:\/\//, '');
  const dark = typeof window !== 'undefined' && getComputedStyle(document.documentElement).colorScheme === 'dark';
  const file = async () => new File([await drawCard(svg.current!, p, meta, link, dark)], `mylo-${p.username || 'profile'}.png`, { type: 'image/png' });

  async function copy() {
    if (!url) { toast.show('Add a username first'); return; }
    toast.show((await copyText(url)) ? 'Link copied' : url);
  }
  async function save() {
    try {
      const f = await file();
      const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name;
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast.show('Image saved');
    } catch { toast.show('Could not make the image'); }
  }
  async function story() {
    try {
      const f = await file();
      if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], title: 'Add me on Mylo', url: url || undefined }); return; }
      await save();
    } catch (e) { if ((e as Error)?.name !== 'AbortError') toast.show('Could not share the image'); }
  }
  async function more() {
    if (!url) { toast.show('Add a username first'); return; }
    try { if (navigator.share) { await navigator.share({ title: 'Add me on Mylo', url }); return; } } catch { return; }
    await copy();
  }

  return (
    <main className="screen on-desk pf-share">
      <ScreenHeader title="Share profile" fallback="/profile" />
      <article className="pf-card" aria-label="Your profile card">
        <div className="pf-card-cover">
          <Room ref={svg} room={room} H={300} F={198} mylo="cover" className="pf-card-room" />
        </div>
        <Avatar photo={p.photo} mylo={p.myloLook} name={p.name} size={64} mode="initial" className="pf-card-photo" />
        <div className="pf-card-body">
          <p className="pf-card-name">{p.name || 'Mylo'}{p.verified && <Seal colour={badgeHex(p.badge)} />}</p>
          <p className="t-body-s c-2">{meta}</p>
          {url
            ? <div className="pf-card-link"><span className="t-caption c-2">Add me on Mylo</span><span className="pf-card-url">{link}</span></div>
            : <Link href="/profile/edit" className="pf-card-link"><span className="t-caption c-2">Add me on Mylo</span><span className="pf-card-url">Add a username</span></Link>}
          <p className="pf-card-brand"><img src="/brand/mylo-logo-192.webp" alt="" width={40} height={40} />Mylo</p>
        </div>
      </article>
      <div className="pf-share-actions">
        <button type="button" className="pf-share-btn" onClick={copy}><Icon name="profile/copy" size={28} />Copy link</button>
        <button type="button" className="pf-share-btn" onClick={save}><Icon name="profile/download" size={28} />Save image</button>
        <button type="button" className="pf-share-btn" onClick={story}><Icon name="profile/share" size={28} />Story</button>
        <button type="button" className="pf-share-btn" onClick={more}><Icon name="profile/more" size={28} />More</button>
      </div>
      {toast.node}
    </main>
  );
}
