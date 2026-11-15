'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { BGS, FORMATS, drawScene, loadImage, type Art, type Bg, type Format, type Scene } from './draw';
import { badgeArt, badgeById, cardArt, cardById, levelArt, levelOf, useRewards, useXp } from '@/lib/rewards';
import { useProfile } from '@/lib/profile';

/* SH1 · Download · new card (1002:30619), SH2 · badge (1002:31298), SH3 ·
   level up (1002:31606), SH4 · chess win (1002:32040). A real image, drawn
   on a canvas at 1080 wide in the chosen format and background, saved as a
   PNG or handed to the phone's share sheet.

   /rewards/download?kind=card&id=winter-cozy
   /rewards/download?kind=badge&id=streak_14
   /rewards/download?kind=level
   /rewards/download?kind=chess&vs=Tobi&moves=31                            */

export type DownloadProps = { kind: string; id?: string; vs?: string; moves?: string };
const DEFAULT_BG: Record<string, string> = { card: 'night', badge: 'mist', level: 'sky', chess: 'clean' };

type Spec = { src: string; title: string; sub?: string; art: 'card' | { w: number; h: number; glow?: string }; cardId?: string; file: string };

function useSpec({ kind, id, vs, moves }: DownloadProps, latestCard: string | null): Spec | null {
  const xp = useXp();
  return useMemo<Spec | null>(() => {
    if (kind === 'card') {
      const c = cardById(id ?? '') ?? cardById(latestCard ?? '');
      if (!c) return null;
      return { src: cardArt(c.id), title: `New card: ${c.name}`, art: 'card', cardId: c.id, file: `mylo-card-${c.id}` };
    }
    if (kind === 'badge') {
      const b = badgeById(id ?? '');
      if (!b) return null;
      return { src: badgeArt(b.id), title: b.title, sub: b.share ?? b.line, art: { w: 66, h: 66, glow: b.glow }, file: `mylo-badge-${b.id}` };
    }
    if (kind === 'level') {
      const { level, number } = levelOf(xp);
      return number > 1
        ? { src: '/figma/rewards/mylo-happy.svg', title: `I reached ${level.name}`, sub: `Level ${number} on Mylo`, art: { w: 92, h: 111 }, file: `mylo-level-${level.id}` }
        : { src: levelArt(level.id), title: `I reached ${level.name}`, sub: `Level ${number} on Mylo`, art: { w: 80, h: 80, glow: level.glow }, file: `mylo-level-${level.id}` };
    }
    if (kind === 'chess') {
      const who = (vs ?? 'Mylo').slice(0, 24);
      const n = Number(moves);
      return { src: '/figma/rewards/mylo-starry-big.svg', title: `I beat ${who} at chess`, sub: Number.isFinite(n) && n > 0 ? `Checkmate in ${n} moves` : undefined,
        art: { w: 86, h: 104 }, file: 'mylo-chess-win' };
    }
    return null;
  }, [kind, id, vs, moves, latestCard, xp]);
}

export default function Download(props: DownloadProps) {
  const r = useRewards();
  const { profile } = useProfile();
  const latest = r.state.opened.at(-1)?.card ?? r.owned[0]?.id ?? null;
  const spec = useSpec(props, latest);
  const [format, setFormat] = useState<Format>(FORMATS[0]);
  const [bg, setBg] = useState<Bg>(() => BGS.find(b => b.id === DEFAULT_BG[props.kind]) ?? BGS[0]);
  const [showName, setShowName] = useState(true);
  const [mark, setMark] = useState(true);
  const [imgs, setImgs] = useState<{ src: string; art: HTMLImageElement; mylo: HTMLImageElement; font: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useRef<HTMLCanvasElement>(null);
  const thumbs = useRef<(HTMLCanvasElement | null)[]>([]);
  const name = (profile.username ? `@${profile.username}` : profile.name).trim();
  const src = spec?.src ?? null;

  useEffect(() => {
    if (!src) return;
    let live = true;
    Promise.all([loadImage(src), loadImage('/figma/rewards/mylo-plain.svg'), document.fonts?.ready]).then(([art, mylo]) => {
      if (!live) return;
      const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
      setImgs({ src, art, mylo, font });
    }).catch(() => {});
    return () => { live = false; };
  }, [src]);

  const scene = useMemo<Scene | null>(() => {
    if (!spec || !imgs || imgs.src !== spec.src) return null;
    const art: Art = spec.art === 'card'
      ? { kind: 'card', card: cardById(spec.cardId!)!, img: imgs.art }
      : { kind: 'image', img: imgs.art, ...spec.art };
    return { art, title: spec.title, sub: spec.sub, name: showName && name ? name : undefined, watermark: mark, mylo: imgs.mylo, font: imgs.font };
  }, [spec, imgs, showName, mark, name]);

  useEffect(() => {
    if (!scene) return;
    const c = preview.current;
    if (c) {
      const w = 208 * 2; const h = Math.round(w * format.h / format.w);
      c.width = w; c.height = h;
      drawScene(c.getContext('2d')!, w, h, bg, scene);
    }
    thumbs.current.forEach((t, i) => {
      if (!t) return;
      t.width = 112; t.height = 200;
      drawScene(t.getContext('2d')!, 112, 200, BGS[i], scene);
    });
  }, [scene, format, bg]);

  async function render(): Promise<Blob | null> {
    if (!scene) return null;
    const c = document.createElement('canvas');
    c.width = format.w; c.height = format.h;
    drawScene(c.getContext('2d')!, format.w, format.h, bg, scene);
    return new Promise(ok => c.toBlob(b => ok(b), 'image/png'));
  }
  const fileName = () => `${spec?.file ?? 'mylo'}-${format.id}.png`;
  function save(blob: Blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = fileName();
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function download() { setBusy(true); try { const b = await render(); if (b) save(b); } finally { setBusy(false); } }
  async function share() {
    setBusy(true);
    try {
      const b = await render(); if (!b) return;
      const file = new File([b], fileName(), { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: spec?.title });
      else save(b);
    } catch { /* closed the share sheet */ } finally { setBusy(false); }
  }

  if (!r.ready) return <main className="screen" aria-busy="true" />;
  return (
    <main className="screen rw rw-dl on-desk">
      <ScreenHeader title="Download" fallback="/rewards" />
      {!spec ? <p className="t-body c-2 rw-center">Nothing to download yet.</p> : <>
        <div className="rw-dl-stage">
          <canvas ref={preview} className={`rw-dl-preview is-${format.id}${bg.stroke ? ' has-stroke' : ''}`} aria-label={spec.title} role="img" />
        </div>
        <div className="rw-dl-formats" role="radiogroup" aria-label="Format">
          {FORMATS.map(f => (
            <button key={f.id} type="button" role="radio" aria-checked={format.id === f.id} className={`rw-chip is-sm${format.id === f.id ? ' is-on' : ''}`} onClick={() => setFormat(f)}>{f.label}</button>
          ))}
        </div>
        <p className="t-body-s c-2">Background</p>
        <div className="rw-dl-thumbs" role="radiogroup" aria-label="Background">
          {BGS.map((b, i) => (
            <button key={b.id} type="button" role="radio" aria-checked={bg.id === b.id} aria-label={b.name}
                    className={`rw-dl-thumb${bg.id === b.id ? ' is-on' : ''}${b.stroke ? ' has-stroke' : ''}`} onClick={() => setBg(b)}>
              <canvas ref={el => { thumbs.current[i] = el; }} />
            </button>
          ))}
        </div>
        <div className="rw-dl-opts">
          <button type="button" className="rw-toggle" aria-pressed={showName} onClick={() => setShowName(v => !v)}>
            <Icon name={showName ? 'rewards/i-check' : 'rewards/i-circle'} size={14} />Show my name
          </button>
          <button type="button" className="rw-toggle" aria-pressed={mark} onClick={() => setMark(v => !v)}>
            <Icon name={mark ? 'rewards/i-check' : 'rewards/i-circle'} size={14} />Mylo watermark
          </button>
        </div>
        <div className="rw-dl-actions">
          <button type="button" className="btn-primary rw-dl-go" disabled={!scene || busy} onClick={download}><Icon name="rewards/i-download" size={22} />Download</button>
          <button type="button" className="rw-dl-share" disabled={!scene || busy} onClick={share} aria-label="Share"><Icon name="rewards/i-share" size={22} /></button>
        </div>
      </>}
    </main>
  );
}
