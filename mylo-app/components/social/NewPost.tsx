'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useRef, useState } from 'react';
import { Avatar, SIcon } from './ui';
import {
  CROPS, FILTERS, fileToDataUrl, QUOTE_TONES, REACTIONS, reactionArt, uid, useMe, usePosts,
  type Crop, type PhotoFilter, type Post, type QuoteSize, type QuoteTone, type ReactionKey
} from '@/lib/social';
import { useHydrated } from '@/lib/local';
import { canGoBack, goBack } from '@/components/NavMotion';

/* New posts: a thought (VF6), a quote (VF7), or photos picked (VF8) and
   edited (VF9). Post hands over to the feed, which shows it going up (VF10a). */
type Kind = 'thought' | 'quote' | 'photo';
const MAX = 280;

function Head({ title, onClose, action, disabled, onAction, dark = false }: {
  title: string; onClose: () => void; action: string; disabled: boolean; onAction: () => void; dark?: boolean;
}) {
  return (
    <header className={`sx-new-head${dark ? ' is-dark' : ''}`}>
      <button type="button" className="sx-nav" aria-label={dark ? 'Back' : 'Close'} onClick={onClose}>
        {dark ? <SIcon name="back" size={20} /> : <SIcon name="close" size={20} />}
      </button>
      {title && <h1 className="sx-new-title">{title}</h1>}
      <button type="button" className="sx-post-btn" disabled={disabled} onClick={onAction}>{action}</button>
    </header>
  );
}

export default function NewPost() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const me = useMe();
  const [, setPosts] = usePosts();
  const [kind, setKind] = useState<Kind>((['thought', 'quote', 'photo'] as const).find(k => k === params.get('kind')) ?? 'thought');
  const [text, setText] = useState('');
  const [sticker, setSticker] = useState<ReactionKey | undefined>();
  const [stickers, setStickers] = useState(false);
  const [error, setError] = useState('');
  const area = useRef<HTMLTextAreaElement>(null);

  // Quote
  const [saidBy, setSaidBy] = useState('');
  const [tone, setTone] = useState<QuoteTone>('green');
  const [size, setSize] = useState<QuoteSize>('Large');

  // Photo
  const [library, setLibrary] = useState<string[]>([]);
  const [picked, setPicked] = useState<number[]>([]);
  const [focus, setFocus] = useState(0);
  const [multi, setMulti] = useState(false);
  const [step, setStep] = useState<'pick' | 'edit'>('pick');
  const [tool, setTool] = useState<'Crop' | 'Filter' | 'Text' | 'Sticker'>('Filter');
  const [filter, setFilter] = useState<PhotoFilter>('Normal');
  const [crop, setCrop] = useState<Crop>('Original');
  const [busy, setBusy] = useState(false);
  const pickInput = useRef<HTMLInputElement>(null);
  const camInput = useRef<HTMLInputElement>(null);

  const close = () => (canGoBack() ? goBack(router) : router.push('/feed'));
  const publish = (p: Omit<Post, 'id' | 'by' | 'at' | 'audience' | 'reactions' | 'comments' | 'reposts'>) => {
    const id = uid();
    const ok = setPosts(all => [{ id, by: me, at: Date.now(), audience: 'Friends', reactions: {}, comments: [], reposts: [], ...p }, ...all]);
    if (!ok) { setError('There is no room left on this device for this post. Try fewer or smaller photos.'); return; }
    router.replace(`/feed?posting=${id}`);
  };

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const urls = await Promise.all([...files].filter(f => f.type.startsWith('image/')).slice(0, 12).map(f => fileToDataUrl(f)));
      if (!urls.length) return;
      const n = urls.length;
      setLibrary(lib => [...urls, ...lib]);
      setPicked(p => multi ? [...urls.map((_, i) => i), ...p.map(i => i + n)].slice(0, 4) : [0]);
      setFocus(0);
    } catch { setError('That photo could not be opened.'); } finally { setBusy(false); }
  };
  const tapTile = (i: number) => {
    setFocus(i);
    if (!multi) { setPicked([i]); return; }
    setPicked(p => p.includes(i) ? p.filter(x => x !== i) : p.length >= 4 ? p : [...p, i]);
  };

  if (!hydrated) return <main className="screen on-desk sx-full" aria-busy="true" />;

  /* ── VF9 · Photo edit ─────────────────────────────────────────────────── */
  if (kind === 'photo' && step === 'edit') {
    const src = library[picked[0] ?? focus];
    const ratio = CROPS[crop];
    return (
      <main className="screen on-desk sx-full sx-editor">
        <Head title="" dark onClose={() => setStep('pick')} action="Next" disabled={false}
              onAction={() => publish({ kind: 'photo', text: text.trim(), photos: picked.map(i => library[i]), filter, crop, sticker })} />
        <div className="sx-edit-frame" style={{ aspectRatio: ratio ? String(ratio) : '353 / 430' }}>
          {src && <img src={src} alt="" style={{ filter: FILTERS[filter] }} />}
          {text && <p className="sx-edit-text">{text}</p>}
          {sticker && <img className="sx-photo-sticker" src={reactionArt(sticker)} alt="" />}
          {picked.length > 1 && <span className="sx-count">1/{picked.length}</span>}
        </div>
        <div className="sx-tools" role="tablist" aria-label="Edit">
          {([['Crop', 'scissors'], ['Filter', 'palette'], ['Text', 'pencil'], ['Sticker', 'sticker']] as const).map(([t, ic]) => (
            <button key={t} type="button" role="tab" aria-selected={tool === t} className="sx-tool" onClick={() => setTool(t)}>
              <SIcon name={ic} size={24} /><span>{t}</span>
            </button>
          ))}
        </div>
        <div className="sx-tool-panel">
          {tool === 'Filter' && (
            <div className="sx-filters">
              {(Object.keys(FILTERS) as PhotoFilter[]).map(f => (
                <button key={f} type="button" className="sx-filter" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                  <span className="sx-filter-img">{src && <img src={src} alt="" style={{ filter: FILTERS[f] }} />}</span>
                  <span>{f}</span>
                </button>
              ))}
            </div>
          )}
          {tool === 'Crop' && (
            <div className="sx-crop">
              {(Object.keys(CROPS) as Crop[]).map(c => (
                <button key={c} type="button" className="sx-dark-chip" aria-pressed={crop === c} onClick={() => setCrop(c)}>{c === 'Portrait' ? '4:5' : c}</button>
              ))}
            </div>
          )}
          {tool === 'Text' && (
            <label className="sx-dark-field">
              <span className="sr-only">Caption</span>
              <input autoFocus value={text} maxLength={MAX} onChange={e => setText(e.target.value)} placeholder="Add a caption" />
            </label>
          )}
          {tool === 'Sticker' && (
            <div className="sx-stickers is-dark">
              <button type="button" className="sx-sticker-none" aria-pressed={!sticker} onClick={() => setSticker(undefined)} aria-label="No sticker"><SIcon name="ban" size={22} /></button>
              {REACTIONS.map(r => (
                <button key={r.key} type="button" className="sx-sticker" aria-pressed={sticker === r.key} aria-label={r.label} onClick={() => setSticker(r.key)}><img src={r.art} alt="" /></button>
              ))}
            </div>
          )}
          {error && <p className="sx-error" role="alert">{error}</p>}
        </div>
      </main>
    );
  }

  /* ── VF8 · New photo post ─────────────────────────────────────────────── */
  if (kind === 'photo') {
    const preview = library[focus];
    return (
      <main className="screen on-desk sx-full sx-pick">
        <Head title="Recents" onClose={close} action="Next" disabled={!picked.length} onAction={() => setStep('edit')} />
        <input ref={pickInput} type="file" accept="image/*" multiple hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <input ref={camInput} type="file" accept="image/*" capture="environment" hidden onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
        <button type="button" className="sx-pick-preview" onClick={() => !preview && pickInput.current?.click()} aria-label={preview ? 'Selected photo' : 'Pick photos'}>
          {preview ? <img src={preview} alt="" /> : <span className="sx-pick-empty"><SIcon name="photo" size={40} />{busy && <span className="t-body-s">…</span>}</span>}
        </button>
        <div className="sx-pick-bar">
          <button type="button" className="sx-chip-plain" onClick={() => pickInput.current?.click()}>Recents</button>
          <span className="spacer" />
          <button type="button" className={`sx-round${multi ? ' is-dark' : ''}`} aria-pressed={multi} aria-label="Pick more than one"
                  onClick={() => { setMulti(m => !m); setPicked(p => p.slice(0, 1)); }}><SIcon name="layers" /></button>
          <button type="button" className="sx-round" aria-label="Take a photo" onClick={() => camInput.current?.click()}><SIcon name="camera" /></button>
        </div>
        {library.length > 0 && (
          <div className="sx-pick-grid">
            {library.map((src, i) => {
              const n = picked.indexOf(i);
              return (
                <button key={i} type="button" className={`sx-pick-tile${focus === i ? ' is-focus' : ''}`} aria-pressed={n >= 0} aria-label={`Photo ${i + 1}`} onClick={() => tapTile(i)}>
                  <img src={src} alt="" />
                  <span className={`sx-pick-mark${n >= 0 ? ' is-on' : ''}`}>{n >= 0 && multi ? n + 1 : n >= 0 ? <SIcon name="check" size={12} /> : null}</span>
                </button>
              );
            })}
          </div>
        )}
        {error && <p className="sx-error" role="alert">{error}</p>}
      </main>
    );
  }

  /* ── VF7 · New quote ──────────────────────────────────────────────────── */
  if (kind === 'quote') {
    const toneNow = QUOTE_TONES.find(t => t.key === tone)!;
    return (
      <main className="screen on-desk sx-full sx-newquote">
        <Head title="New quote" onClose={close} action="Post" disabled={!text.trim()}
              onAction={() => publish({ kind: 'quote', text: text.trim(), saidBy: saidBy.trim() || me.name, tone, size })} />
        <div className="sx-quote is-big" style={{ background: toneNow.bg, color: toneNow.ink }}>
          <SIcon name="quote" size={36} className="sx-quote-mark" />
          <label className="sx-quote-input">
            <span className="sr-only">Quote</span>
            <textarea autoFocus value={text} maxLength={140} onChange={e => setText(e.target.value)} rows={2}
                      style={{ fontSize: { Small: 20, Medium: 24, Large: 28 }[size] }} />
          </label>
          <p className="sx-quote-by" style={{ color: toneNow.sub }}>{saidBy || me.name}</p>
        </div>
        <label className="sx-field">
          <span className="t-body-s c-2">Who said it</span>
          <input value={saidBy} maxLength={40} onChange={e => setSaidBy(e.target.value)} />
        </label>
        <div className="sx-field">
          <span className="t-body-s c-2" id="sx-colour">Card colour</span>
          <div className="sx-swatches" role="radiogroup" aria-labelledby="sx-colour">
            {QUOTE_TONES.map(t => (
              <button key={t.key} type="button" role="radio" aria-checked={tone === t.key} aria-label={t.key} className="sx-swatch"
                      style={{ background: t.bg }} onClick={() => setTone(t.key)} />
            ))}
          </div>
        </div>
        <div className="sx-field">
          <span className="t-body-s c-2">Text size</span>
          <div className="sx-tabs is-slide" role="tablist" aria-label="Text size" style={{ '--i': ['Small', 'Medium', 'Large'].indexOf(size), '--n': 3 } as React.CSSProperties}>
            {(['Small', 'Medium', 'Large'] as const).map(s => <button key={s} type="button" role="tab" aria-selected={size === s} className="sx-tab" onClick={() => setSize(s)}>{s}</button>)}
          </div>
        </div>
        <p className="t-body-s c-3">Quotes are short. Keep it to what you would say out loud.</p>
        {error && <p className="sx-error" role="alert">{error}</p>}
      </main>
    );
  }

  /* ── VF6 · New thought ────────────────────────────────────────────────── */
  const insert = (s: string) => {
    const el = area.current; if (!el) { setText(t => (t + s).slice(0, MAX)); return; }
    const a = el.selectionStart, b = el.selectionEnd;
    const next = (text.slice(0, a) + s + text.slice(b)).slice(0, MAX);
    setText(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + s.length, a + s.length); });
  };
  return (
    <main className="screen on-desk sx-full sx-newthought">
      <Head title="New thought" onClose={close} action="Post" disabled={!text.trim()}
            onAction={() => publish({ kind: 'thought', text: text.trim(), sticker })} />
      <div className="sx-me">
        <Avatar name={me.name} size={40} me />
        <div className="sx-me-text">
          <span className="t-body sx-name">{me.name}</span>
          <span className="sx-audience">Friends</span>
        </div>
      </div>
      <label className="sx-thought-field">
        <span className="sr-only">What is on your mind?</span>
        <textarea ref={area} autoFocus value={text} maxLength={MAX} onChange={e => setText(e.target.value)} placeholder="What is on your mind?" rows={5} />
      </label>
      {sticker && (
        <button type="button" className="sx-thought-sticker is-edit" onClick={() => setSticker(undefined)} aria-label="Remove sticker">
          <img src={reactionArt(sticker)} alt="" />
        </button>
      )}
      {error && <p className="sx-error" role="alert">{error}</p>}
      <div className="sx-thought-tools">
        {stickers && (
          <div className="sx-stickers">
            {REACTIONS.map(r => (
              <button key={r.key} type="button" className="sx-sticker" aria-pressed={sticker === r.key} aria-label={r.label}
                      onClick={() => { setSticker(r.key); setStickers(false); }}><img src={r.art} alt="" /></button>
            ))}
          </div>
        )}
        <div className="sx-toolrow">
          <button type="button" className="sx-tool-btn" aria-label="Photo" onClick={() => setKind('photo')}><SIcon name="photo" /></button>
          <button type="button" className="sx-tool-btn" aria-label="Quote" onClick={() => setKind('quote')}><SIcon name="quote" /></button>
          <button type="button" className="sx-tool-btn" aria-label="Mylo sticker" aria-expanded={stickers} onClick={() => setStickers(s => !s)}><SIcon name="mylo-tool" /></button>
          <button type="button" className="sx-tool-btn" aria-label="Hashtag" onClick={() => insert('#')}><SIcon name="hash" /></button>
          <span className="spacer" />
          <span className="t-body-s c-3">{text.length} / {MAX}</span>
        </div>
      </div>
    </main>
  );
}
