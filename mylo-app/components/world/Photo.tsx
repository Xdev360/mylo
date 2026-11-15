'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Mylo from './Mylo';
import { drawMylo, lookPicture, shareOrSave } from './compose';
import { Scene, WorldHeader, WorldPage, wi } from './ui';
import { useLocal } from '@/lib/local';
import { MOODS, PHOTO_BGS, POSES, useLook, usePhotos, type Face, type Look, type Photo } from '@/lib/world';

/* The photo studio. With a friend it is PH1 to PH4 and their yes (PH3);
   friends come from the social area, so until there is one the photos are
   of your own Mylo, saved straight to the album (PH5). */
type Draft = { bg: string; pose: string; face: Face };
const DRAFT_KEY = 'mylo.world.photo-draft.v1';
const NEW: Draft = { bg: 'bedroom', pose: 'Side by side', face: 'laugh' };
const POSE_STYLE: Record<string, React.CSSProperties> = {
  'Side by side': {}, 'Lean in': { rotate: '-8deg' }, Jump: { translate: '0 -14%' }, Silly: { rotate: '10deg', scale: '-1 1' }
};
const artOf = (bg: string) => PHOTO_BGS.find(b => b.id === bg)?.art ?? 'bedroom';
const labelOf = (bg: string) => PHOTO_BGS.find(b => b.id === bg)?.label ?? '';
const AT: [number, number, number] = [0.31, 0.43, 0.38];

function Shot({ photo, look, className = '' }: { photo: Pick<Photo, 'bg' | 'pose' | 'face'>; look: Look; className?: string }) {
  return (
    <Scene art={artOf(photo.bg)} className={`w-shot ${className}`}>
      <span className="w-scene-mylo" style={{ left: `${AT[0] * 100}%`, top: `${AT[1] * 100}%`, width: `${AT[2] * 100}%`, ...POSE_STYLE[photo.pose] }}>
        <Mylo look={{ ...look, face: photo.face }} />
      </span>
    </Scene>
  );
}

/* ── PH5 · the album ───────────────────────────────────────────────────── */
export function Album() {
  return <WorldPage className="w-album" tabs><AlbumBody /></WorldPage>;
}
function AlbumBody() {
  const [photos] = usePhotos();
  return (
    <>
      <WorldHeader title="Us" fallback="/apps"
                   actions={<Link href="/photo/new" className="back-btn" aria-label="Take a photo"><Icon name={wi('camera')} size={20} /></Link>} />
      <p className="t-body c-2 w-center w-lede">{photos.length} {photos.length === 1 ? 'photo' : 'photos'} together</p>
      <div className="w-album-grid">
        {[...photos].reverse().map(p => (
          <Link key={p.id} href={`/photo/done/${p.id}`} className="w-album-item" aria-label={p.title}><Shot photo={p} look={p.look} /></Link>
        ))}
      </div>
    </>
  );
}

/* ── PH1 · Photo · background ──────────────────────────────────────────── */
export function PhotoBackground() {
  return <WorldPage className="w-photo"><BgBody /></WorldPage>;
}
function BgBody() {
  const router = useRouter();
  const [look] = useLook();
  const [draft, setDraft] = useLocal<Draft>(DRAFT_KEY, NEW);
  return (
    <>
      <WorldHeader kind="close" title="Photo" fallback="/photo" />
      <Shot photo={draft} look={look} className="w-shot-big" />
      <h2 className="t-title-s">Background</h2>
      <div className="w-bg-row" role="radiogroup" aria-label="Background">
        {PHOTO_BGS.map(b => (
          <button key={b.id} type="button" role="radio" aria-checked={draft.bg === b.id} className={`w-bg-pick${draft.bg === b.id ? ' is-on' : ''}`} onClick={() => setDraft(d => ({ ...d, bg: b.id }))}>
            <span className="w-bg-thumb"><img src={`/figma/world/room/${b.art}.svg`} alt="" /></span>
            <span className={`t-caption ${draft.bg === b.id ? 'c-ink' : 'c-3'}`}>{b.label}</span>
          </button>
        ))}
      </div>
      <div className="spacer" />
      <button type="button" className="btn-primary w-wide" onClick={() => router.push('/photo/pose')}>Next</button>
    </>
  );
}

/* ── PH2 · Photo · pose ────────────────────────────────────────────────── */
export function PhotoPose() {
  return <WorldPage className="w-photo"><PoseBody /></WorldPage>;
}
function PoseBody() {
  const router = useRouter();
  const [look] = useLook();
  const [draft, setDraft] = useLocal<Draft>(DRAFT_KEY, NEW);
  const [, setPhotos] = usePhotos();
  const [count, setCount] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  const shoot = () => {
    const p: Photo = { id: crypto.randomUUID(), ...draft, look, at: new Date().toISOString(), title: labelOf(draft.bg), frame: 'Polaroid' };
    setPhotos(ps => [...ps, p]);
    router.push(`/photo/done/${p.id}`);
  };
  const later = () => {
    if (timer.current) return;
    setCount(3);
    timer.current = setInterval(() => setCount(c => {
      if (c && c > 1) return c - 1;
      clearInterval(timer.current!); timer.current = null; shoot(); return null;
    }), 1000);
  };
  const shuffle = () => setDraft(d => ({ ...d, pose: POSES[Math.floor(Math.random() * POSES.length)], face: MOODS[Math.floor(Math.random() * MOODS.length)].face }));
  return (
    <>
      <WorldHeader title="Pose" fallback="/photo/new" />
      <div className="w-shot-wrap">
        <Shot photo={draft} look={look} className="w-shot-big" />
        {count && <span className="w-countdown" aria-live="assertive">{count}</span>}
      </div>
      <div className="w-chips" role="radiogroup" aria-label="Pose">
        {POSES.map(p => <button key={p} type="button" role="radio" aria-checked={draft.pose === p} className={`w-tab${draft.pose === p ? ' is-on' : ''}`} onClick={() => setDraft(d => ({ ...d, pose: p }))}>{p}</button>)}
      </div>
      <p className="t-caption c-3">Your Mylo</p>
      <div className="w-chips" role="radiogroup" aria-label="Your Mylo">
        {MOODS.map(m => <button key={m.label} type="button" role="radio" aria-checked={draft.face === m.face} className={`w-tab${draft.face === m.face ? ' is-on' : ''}`} onClick={() => setDraft(d => ({ ...d, face: m.face }))}>{m.label}</button>)}
      </div>
      <div className="w-shutter-row">
        <button type="button" className="w-round" aria-label="Timer" onClick={later}><Icon name={wi('timer')} size={22} /></button>
        <button type="button" className="w-shutter" aria-label="Take the photo" onClick={shoot}><span /></button>
        <button type="button" className="w-round" aria-label="Shuffle" onClick={shuffle}><Icon name={wi('shuffle')} size={22} /></button>
      </div>
    </>
  );
}

/* ── PH3 · Photo · waiting: only while a friend has to say yes ─────────── */
export function PhotoWaiting() {
  const router = useRouter();
  useEffect(() => { router.replace('/photo'); }, [router]);
  return <WorldPage className="w-photo"><></></WorldPage>;
}

/* ── PH4 · Photo · done ────────────────────────────────────────────────── */
const FRAMES = ['Polaroid', 'Clean', 'Stickers', 'Date'] as const;
export function PhotoDone({ id }: { id: string }) {
  return <WorldPage className="w-photo"><DoneBody id={id} /></WorldPage>;
}
function DoneBody({ id }: { id: string }) {
  const router = useRouter();
  const [photos, setPhotos] = usePhotos();
  const [busy, setBusy] = useState(false);
  const p = photos.find(x => x.id === id);
  useEffect(() => { if (!p) router.replace('/photo'); }, [p, router]);
  if (!p) return null;
  const date = new Date(p.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const picture = () => lookPicture(p.look, `/figma/world/room/${artOf(p.bg)}.svg`, 1080, async (ctx, s) => {
    await drawMylo(ctx, { ...p.look, face: p.face }, s * 0.3, s * 0.36, s * 0.4);
    ctx.font = `600 ${s * 0.03}px system-ui, sans-serif`; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.textAlign = 'right';
    ctx.fillText(p.frame === 'Date' ? `${date} · Mylo` : 'Mylo', s * 0.96, s * 0.96);
  });
  const out = async (share: boolean) => { setBusy(true); try { await shareOrSave(await picture(), `${p.title || 'Mylo'}.png`, share); } finally { setBusy(false); } };
  const setFrame = (frame: string) => setPhotos(ps => ps.map(x => (x.id === p.id ? { ...x, frame } : x)));
  return (
    <>
      <WorldHeader kind="close" fallback="/photo" onNav={() => router.push('/photo')} />
      <div className={`w-print is-${p.frame.toLowerCase()}`}>
        <div className="w-print-shot">
          <Shot photo={p} look={p.look} />
          {p.frame === 'Stickers' && <><img className="w-print-sticker is-a" src="/figma/world/sticker-love.svg" alt="" /><img className="w-print-sticker is-b" src="/figma/world/sticker-wow.svg" alt="" /></>}
          {p.frame === 'Date' && <span className="w-print-date">{date}</span>}
        </div>
        {p.frame !== 'Clean' && (
          <div className="w-print-text">
            <input className="w-print-title" value={p.title} maxLength={28} aria-label="Photo title"
                   onChange={e => setPhotos(ps => ps.map(x => (x.id === p.id ? { ...x, title: e.target.value } : x)))} />
            <span className="t-body-s c-2">{date}</span>
          </div>
        )}
      </div>
      <p className="w-note"><Icon name={wi('done')} size={24} className="w-green" /><span className="t-body-s">Saved to your album.</span></p>
      <div className="w-chips" role="radiogroup" aria-label="Frame">
        {FRAMES.map(f => <button key={f} type="button" role="radio" aria-checked={p.frame === f} className={`w-tab${p.frame === f ? ' is-on' : ''}`} onClick={() => setFrame(f)}>{f}</button>)}
      </div>
      <div className="w-two">
        <button type="button" className="w-grey-btn" onClick={() => out(false)} disabled={busy}><Icon name={wi('download')} size={20} />Save</button>
        <button type="button" className="btn-primary" onClick={() => out(true)} disabled={busy}><Icon name={wi('share')} size={20} />Share</button>
      </div>
      <p className="t-caption c-3 w-center">Shared copies carry a small Mylo mark.</p>
    </>
  );
}
