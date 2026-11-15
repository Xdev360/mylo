'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import ScreenHeader from '@/components/ScreenHeader';
import { SIcon } from './ui';
import { BGS, FORMATS, renderTemplate, saveBlob, shareBlob, toBlob, type Bg, type Format, type TemplateOpts } from './template';
import { isMe, useMe, usePosts, type Post } from '@/lib/social';
import { useHydrated } from '@/lib/local';

/* VF15 · Download, pick a template, and VF16 · Download, saved. The picture
   is drawn on a canvas at full size and saved as a PNG. */
const FORMAT_LIST = Object.keys(FORMATS) as Format[];
const BG_LIST = Object.keys(BGS) as Bg[];

function useTemplate(post: Post | undefined, o: TemplateOpts, width: number, size?: { w: number; h: number }) {
  const me = useMe();
  const [url, setUrl] = useState<string | null>(null);
  const { format, bg, showName, watermark } = o;
  useEffect(() => {
    if (!post) return;
    let live = true; let made: string | null = null;
    renderTemplate(post, isMe(post.by, me) ? me : post.by, { format, bg, showName, watermark }, width, size)
      .then(toBlob).then(b => { made = URL.createObjectURL(b); if (live) setUrl(made); else URL.revokeObjectURL(made); })
      .catch(() => {});
    return () => { live = false; if (made) URL.revokeObjectURL(made); };
  }, [post, me, format, bg, showName, watermark, width, size]);
  return url;
}

function useOpts(): TemplateOpts {
  const p = useSearchParams();
  const format = FORMAT_LIST.find(f => FORMATS[f].slug === p.get('f')) ?? 'Story 9:16';
  const bg = BG_LIST.find(b => b === p.get('bg')) ?? 'Graphite';
  return { format, bg, showName: p.get('n') !== '0', watermark: p.get('w') !== '0' };
}
const query = (o: TemplateOpts) => `?f=${FORMATS[o.format].slug}&bg=${o.bg}&n=${o.showName ? 1 : 0}&w=${o.watermark ? 1 : 0}`;
const fileName = (o: TemplateOpts) => `mylo-${FORMATS[o.format].slug}.png`;

async function makeFile(post: Post, by: Post['by'], o: TemplateOpts) {
  return toBlob(await renderTemplate(post, by, o, 1080));
}

const THUMB = { w: 56, h: 100 };
function Thumb({ post, bg, o, on, onPick }: { post: Post; bg: Bg; o: TemplateOpts; on: boolean; onPick: () => void }) {
  const url = useTemplate(post, { ...o, bg }, 112, THUMB);
  return (
    <button type="button" className={`sx-thumb${BGS[bg].dark ? ' is-dark' : ''}`} aria-pressed={on} aria-label={bg} onClick={onPick}>
      {url && <img src={url} alt="" />}
    </button>
  );
}

function Missing() {
  return (
    <section className="sx-gone">
      <img src="/figma/social/mylo-empty.svg" alt="" width={100} height={120} />
      <p className="t-title-s">This post is not here any more.</p>
      <Link href="/feed" className="btn-primary">Back to Vibe</Link>
    </section>
  );
}

export function DownloadPick() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const me = useMe();
  const [posts] = usePosts();
  const post = posts.find(p => p.id === id);
  const start = useOpts();
  const [o, setO] = useState<TemplateOpts>(start);
  const [busy, setBusy] = useState(false);
  const preview = useTemplate(post, o, 624);
  const f = FORMATS[o.format];
  const by = post && (isMe(post.by, me) ? me : post.by);

  const download = async () => {
    if (!post || !by) return;
    setBusy(true);
    try { saveBlob(await makeFile(post, by, o), fileName(o)); router.push(`/feed/${id}/download/saved${query(o)}`); } finally { setBusy(false); }
  };
  const share = async () => {
    if (!post || !by) return;
    const b = await makeFile(post, by, o);
    if (!(await shareBlob(b, fileName(o)))) saveBlob(b, fileName(o));
  };

  return (
    <main className="screen on-desk sx-full sx-download">
      <ScreenHeader title="Download" fallback={`/feed/${id}`} />
      {!hydrated ? null : !post ? <Missing /> : <>
        <div className="sx-dl-stage">
          <div className="sx-dl-preview" style={{ aspectRatio: `${f.w} / ${f.h}`, width: f.h / f.w > 1.5 ? 208 : f.h / f.w > 1.1 ? 240 : 270 }}>
            {preview && <img src={preview} alt={`${o.format} picture of the post`} />}
          </div>
        </div>
        <div className="sx-chip-row" role="radiogroup" aria-label="Size">
          {FORMAT_LIST.map(x => (
            <button key={x} type="button" role="radio" aria-checked={o.format === x} className="sx-pill" onClick={() => setO({ ...o, format: x })}>{x}</button>
          ))}
        </div>
        <p className="t-body-s c-2">Background</p>
        <div className="sx-thumbs" role="radiogroup" aria-label="Background">
          {BG_LIST.map(b => <Thumb key={b} post={post} bg={b} o={o} on={o.bg === b} onPick={() => setO({ ...o, bg: b })} />)}
        </div>
        <div className="sx-chip-row">
          <button type="button" className="sx-toggle-chip" aria-pressed={o.showName} onClick={() => setO({ ...o, showName: !o.showName })}>
            {o.showName && <SIcon name="check" size={14} />}Show my name
          </button>
          <button type="button" className="sx-toggle-chip" aria-pressed={o.watermark} onClick={() => setO({ ...o, watermark: !o.watermark })}>
            {o.watermark && <SIcon name="check" size={14} />}Mylo watermark
          </button>
        </div>
        <div className="sx-dl-actions">
          <button type="button" className="btn-primary sx-dl-btn" onClick={download} disabled={busy}><SIcon name="download" size={24} />Download</button>
          <button type="button" className="sx-dl-share" aria-label="Share" onClick={share}><SIcon name="share" /></button>
        </div>
      </>}
    </main>
  );
}

export function DownloadSaved() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const hydrated = useHydrated();
  const me = useMe();
  const [posts] = usePosts();
  const post = posts.find(p => p.id === id);
  const o = useOpts();
  const preview = useTemplate(post, o, 540);
  const f = FORMATS[o.format];
  const by = post && (isMe(post.by, me) ? me : post.by);
  const send = async () => {
    if (!post || !by) return;
    const b = await makeFile(post, by, o);
    if (!(await shareBlob(b, fileName(o)))) saveBlob(b, fileName(o));
  };
  const size = o.format.split(' ')[0];
  return (
    <main className="screen on-desk sx-full sx-saved">
      {!hydrated ? null : !post ? <Missing /> : <>
        <div className="sx-saved-stage">
          <div className="sx-saved-preview" style={{ aspectRatio: `${f.w} / ${f.h}`, width: f.h / f.w > 1.5 ? 180 : 220 }}>
            {preview && <img src={preview} alt="" />}
            <span className="sx-saved-check"><SIcon name="dl-icon" size={22} /></span>
          </div>
        </div>
        <h1 className="sx-saved-title">Saved to your photos</h1>
        <p className="sx-saved-text">{size} size, {f.w} x {f.h}. Post it anywhere.</p>
        <p className="t-body-s c-2 sx-saved-label">Share to</p>
        <div className="sx-share-to-apps">
          {([['Story', 'fr-camera'], ['Status', 'chat'], ['Post', 'photo'], ['More', 'more-round']] as const).map(([l, ic]) => (
            <button key={l} type="button" className="sx-app" onClick={send}><span className="sx-app-ic"><SIcon name={ic} size={22} /></span><span className="t-body-s">{l}</span></button>
          ))}
        </div>
        <div className="sx-bottom"><button type="button" className="btn-primary sx-wide" onClick={() => router.replace(`/feed/${id}`)}>Done</button></div>
      </>}
    </main>
  );
}
