'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Mylo from './Mylo';
import { lookPicture, shareOrSave } from './compose';
import { Switch, Toast, WorldHeader, WorldPage, useBack, wi } from './ui';
import { useLocal } from '@/lib/local';
import { useStore } from '@/lib/store';
import {
  BACKDROPS, COLOURS, EXTRAS, FACES, HATCH_DAYS, KEYS, OUTFITS, RARITY, SCENES, STYLES,
  activeDays, shuffleLook, useLook, type Egg, type Look, type Rarity
} from '@/lib/world';

type SetDraft = (f: (l: Look) => Look) => void;

/* ── The panels both customisers share ─────────────────────────────────── */

function ColourPanel({ look, set }: { look: Look; set: SetDraft }) {
  const cur = COLOURS.find(c => c.id === look.colour) ?? COLOURS[0];
  return (
    <div className="w-panel">
      <div className="w-panel-head"><h2 className="t-title-s">Body colour</h2><span className="t-body-s c-2">{cur.label}</span></div>
      <div className="w-swatches" role="radiogroup" aria-label="Body colour">
        {COLOURS.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={look.colour === c.id} aria-disabled={c.locked || undefined}
                  className={`w-swatch${look.colour === c.id ? ' is-on' : ''}${c.locked ? ' is-locked' : ''}`}
                  onClick={() => !c.locked && set(l => ({ ...l, colour: c.id, style: null }))}>
            <span className="w-swatch-ring"><span className="w-swatch-dot" style={{ background: `linear-gradient(180deg, ${c.body}, ${c.shade})` }} />
              {c.locked && <span className="w-lock-badge"><Icon name={wi('lock')} size={12} /></span>}</span>
            <span className="t-caption">{c.label}</span>
          </button>
        ))}
      </div>
      <div className="w-shine">
        <Icon name={wi('sparkle')} size={22} className="w-amber" />
        <span className="t-caption c-2 w-grow">Soft shine around Mylo</span>
        <Switch on={look.shine} onChange={v => set(l => ({ ...l, shine: v }))} label="Soft shine around Mylo" />
      </div>
    </div>
  );
}

function FacePanel({ look, set }: { look: Look; set: SetDraft }) {
  return (
    <div className="w-panel">
      <div className="w-tiles" role="radiogroup" aria-label="Face">
        {FACES.map(f => (
          <button key={f} type="button" role="radio" aria-checked={look.face === f} aria-label={f}
                  className={`w-tile-btn w-face-tile${look.face === f ? ' is-on' : ''}`}
                  onClick={() => set(l => ({ ...l, face: f, style: null }))}>
            <Mylo look={{ ...look, face: f, outfit: null, extras: [], style: null, shine: false }} className="w-face-mylo" shadow={false} />
          </button>
        ))}
      </div>
    </div>
  );
}

function WearPanel({ look, set, kind }: { look: Look; set: SetDraft; kind: 'outfit' | 'extras' }) {
  const list = kind === 'outfit' ? OUTFITS : EXTRAS;
  const on = (id: string | null) => (kind === 'outfit' ? look.outfit === id : id !== null && look.extras.includes(id));
  const pick = (id: string | null) => set(l => kind === 'outfit'
    ? { ...l, outfit: id, style: null }
    : { ...l, extras: l.extras.includes(id!) ? l.extras.filter(e => e !== id) : [...l.extras, id!], style: null });
  return (
    <div className="w-panel">
      {kind === 'extras' && <div className="w-panel-head"><h2 className="t-title-s">Glasses, scarves, flowers</h2><span className="t-body-s c-2">{look.extras.length} on</span></div>}
      <div className="w-tiles" role={kind === 'outfit' ? 'radiogroup' : 'group'} aria-label={kind === 'outfit' ? 'Outfit' : 'Extras'}>
        {list.map(p => {
          const id = p?.id ?? null;
          const sel = on(id);
          const piece: Look = { ...look, face: 'smile', shine: false, style: null, outfit: kind === 'outfit' ? id : null, extras: kind === 'extras' && id ? [id] : [] };
          return (
            <button key={id ?? 'none'} type="button" role={kind === 'outfit' ? 'radio' : 'checkbox'} aria-checked={sel}
                    aria-label={p?.label ?? 'Nothing on'} aria-disabled={p?.locked || undefined}
                    className={`w-tile-btn w-wear-tile${sel ? ' is-on' : ''}${p?.locked ? ' is-locked' : ''}`}
                    onClick={() => !p?.locked && pick(id)}>
              {sel && <span className="w-tile-disc" />}
              <Mylo look={piece} className="w-wear-mylo" />
              {p?.locked && <span className="w-lock-badge is-corner"><Icon name={wi('lock')} size={12} /></span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScenePanel({ look, set }: { look: Look; set: SetDraft }) {
  const cur = SCENES.find(s => s.id === look.scene) ?? SCENES[0];
  const [busy, setBusy] = useState(false);
  const share = async () => {
    setBusy(true);
    try { await shareOrSave(await lookPicture(look, cur), `${look.name || 'Mylo'}.png`); } finally { setBusy(false); }
  };
  return (
    <div className="w-panel">
      <div className="w-panel-head"><h2 className="t-title-s">Background</h2><span className="t-body-s c-2">{cur.label}</span></div>
      <div className="w-scenes" role="radiogroup" aria-label="Background">
        {SCENES.map(s => (
          <button key={s.id} type="button" role="radio" aria-checked={look.scene === s.id} className={`w-scene-pick${look.scene === s.id ? ' is-on' : ''}`}
                  onClick={() => set(l => ({ ...l, scene: s.id }))}>
            <span style={{ background: `linear-gradient(180deg, ${s.from}, ${s.to})` }} />
            <span className="t-caption c-2">{s.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="w-soft-btn" onClick={share} disabled={busy}><Icon name={wi('share')} size={20} />Share my Mylo</button>
    </div>
  );
}

function Tabs<T extends string>({ tabs, value, onChange, className = '' }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; className?: string }) {
  return (
    <div className={`w-chips ${className}`} role="tablist">
      {tabs.map(t => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} className={`w-tab${value === t.id ? ' is-on' : ''}`} onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}

/* ── M1 to M5 · Make your Mylo (454:99388 …) ───────────────────────────── */
type MTab = 'colour' | 'face' | 'outfit' | 'extras' | 'scene';
const M_TABS: { id: MTab; label: string }[] = [
  { id: 'colour', label: 'Colour' }, { id: 'face', label: 'Face' }, { id: 'outfit', label: 'Outfit' }, { id: 'extras', label: 'Extras' }, { id: 'scene', label: 'Scene' }
];

export function MakeMylo() {
  return <WorldPage className="w-make"><MakeBody /></WorldPage>;
}
function MakeBody() {
  const [saved, setSaved] = useLook();
  const [draft, setDraft] = useState<Look>(saved);
  const [tab, setTab] = useState<MTab>('colour');
  const [naming, setNaming] = useState(false);
  const [toast, setToast] = useState(false);
  const set: SetDraft = f => setDraft(f);
  const scene = SCENES.find(s => s.id === draft.scene) ?? SCENES[0];
  const save = () => { setSaved({ ...draft, name: draft.name.trim() || 'Mylo' }); setToast(true); };
  const hideToast = useCallback(() => setToast(false), []);
  return (
    <>
      <WorldHeader title="Make your Mylo" fallback="/apps"
                   actions={<button type="button" className="w-save" onClick={save}>Save</button>} />
      <div className={`w-stage${scene.id === 'night' ? ' is-night' : ''}`} style={{ background: `linear-gradient(180deg, ${scene.from}, ${scene.to})` }}>
        {naming ? (
          <input className="w-name w-name-input" autoFocus maxLength={16} value={draft.name} aria-label="Mylo’s name"
                 onChange={e => setDraft(l => ({ ...l, name: e.target.value }))}
                 onBlur={() => setNaming(false)} onKeyDown={e => { if (e.key === 'Enter') setNaming(false); }} />
        ) : (
          <button type="button" className="w-name" onClick={() => setNaming(true)} aria-label={`Rename ${draft.name}`}>
            {draft.name || 'Mylo'}<Icon name={wi('pencil')} size={16} className="c-2" />
          </button>
        )}
        <button type="button" className="w-shuffle" aria-label="Shuffle" onClick={() => setDraft(l => shuffleLook(l))}><Icon name={wi('shuffle')} size={18} /></button>
        <span className="w-stage-floor" />
        <Mylo look={draft} className="w-stage-mylo" shadow={false} label={draft.name} />
      </div>
      <Tabs tabs={M_TABS} value={tab} onChange={setTab} className="w-mtabs" />
      {tab === 'colour' && <ColourPanel look={draft} set={set} />}
      {tab === 'face' && <FacePanel look={draft} set={set} />}
      {tab === 'outfit' && <WearPanel look={draft} set={set} kind="outfit" />}
      {tab === 'extras' && <WearPanel look={draft} set={set} kind="extras" />}
      {tab === 'scene' && <ScenePanel look={draft} set={set} />}
      <Toast text="Look saved. Friends see it now." show={toast} onDone={hideToast} />
    </>
  );
}

/* ── MS1, MS2, MS5 · Mylo style (879:181009, 877:121166, 877:122852) ───── */
export type STab = 'colour' | 'face' | 'outfit' | 'extras' | 'background';
const S_TABS: { id: STab; label: string }[] = [
  { id: 'colour', label: 'Colour' }, { id: 'face', label: 'Face' }, { id: 'outfit', label: 'Outfit' }, { id: 'extras', label: 'Extras' }, { id: 'background', label: 'Background' }
];

export function StyleStudio({ start = 'background' }: { start?: STab }) {
  return <WorldPage className="w-studio"><StudioBody start={start} /></WorldPage>;
}
function StudioBody({ start }: { start: STab }) {
  const back = useBack('/apps');
  const [saved, setSaved] = useLook();
  const [draft, setDraft] = useState<Look>(saved);
  const [tab, setTab] = useState<STab>(start);
  const [toast, setToast] = useState(false);
  const hideToast = useCallback(() => setToast(false), []);
  const set: SetDraft = f => setDraft(f);
  const bd = BACKDROPS.find(b => b.id === draft.backdrop) ?? BACKDROPS[1];
  const owned = BACKDROPS.filter(b => !b.from);
  const ownedStyles = STYLES.filter(s => !s.from);
  return (
    <>
      <div className="w-hero" style={{ backgroundImage: `url(/figma/world/bg/${bd.hero ?? bd.id}.svg)` }}>
        <button type="button" className="back-btn w-hero-back" aria-label="Back" onClick={back}><Icon name={wi('back')} size={20} /></button>
        <button type="button" className="w-save is-raised" onClick={() => { setSaved(draft); setToast(true); }}>Save look</button>
        <Mylo look={draft} className="w-hero-mylo" label={draft.name} />
        <Toast text="Look saved. Friends see it now." show={toast} onDone={hideToast} />
      </div>
      <section className="w-style-panel">
        <span className="w-grabber" />
        <Tabs tabs={S_TABS} value={tab} onChange={setTab} className="w-stabs" />
        {tab === 'colour' && <ColourPanel look={draft} set={set} />}
        {tab === 'face' && <FacePanel look={draft} set={set} />}
        {tab === 'extras' && <WearPanel look={draft} set={set} kind="extras" />}
        {tab === 'background' && (
          <div className="w-panel">
            <div><h2 className="w-title-xs">Backgrounds</h2>
              <p className="t-caption c-3">{owned.length} of {BACKDROPS.length} owned. Your background also shows behind Mylo in chats and stories.</p></div>
            <div className="w-cards">
              {BACKDROPS.map(b => {
                const on = draft.backdrop === b.id, locked = !!b.from;
                return (
                  <button key={b.id} type="button" className={`w-card${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`} aria-pressed={on} aria-disabled={locked || undefined}
                          aria-label={locked ? `${b.label}, ${b.from}` : b.label} onClick={() => !locked && set(l => ({ ...l, backdrop: b.id }))}>
                    <span className="w-card-art"><img src={`/figma/world/bg/${b.id}.svg`} alt="" />
                      {locked && <span className="w-lock-badge is-big"><Icon name={wi('lock')} size={14} /></span>}
                      {on && <span className="w-check-badge"><Icon name={wi('check')} size={14} /></span>}</span>
                    <span className="w-card-label"><span className={locked ? 'c-3 w-tiny' : ''}>{locked ? b.from : b.label}</span><span className="w-rarity" style={{ background: RARITY[b.rarity].color }} /></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {tab === 'outfit' && (
          <div className="w-panel">
            <div><h2 className="w-title-xs">Outfits</h2>
              <p className="t-caption c-3">{ownedStyles.length} of {STYLES.length} owned. Locked cards say where they come from.</p></div>
            <div className="w-cards">
              {STYLES.map(s => {
                const on = draft.style === s.id, locked = !!s.from;
                return (
                  <button key={s.id} type="button" className={`w-card w-card-fit${on ? ' is-on' : ''}${locked ? ' is-locked' : ''}`} aria-pressed={on} aria-disabled={locked || undefined}
                          aria-label={locked ? `${s.label}, ${s.from}` : s.label} onClick={() => !locked && set(l => ({ ...l, style: l.style === s.id ? null : s.id }))}>
                    <span className="w-card-art"><img className="w-card-fig" src={`/figma/world/style/${s.art}.svg`} alt="" />
                      {locked && <span className="w-lock-badge is-big"><Icon name={wi('lock')} size={14} /></span>}</span>
                    <span className="w-card-label"><span className={locked ? 'c-3 w-tiny' : ''}>{locked ? s.from : s.label}</span><span className="w-rarity" style={{ background: RARITY[s.rarity].color }} /></span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <Link href="/style/collection" className="w-more t-body-s c-2">Collection<Icon name="chevron-right" size={16} /></Link>
      </section>
    </>
  );
}

/* ── MS4 · Collection · Backgrounds (879:181296) ───────────────────────── */
type CTab = 'outfits' | 'backgrounds' | 'pets' | 'eggs';
const TIERS: Rarity[] = ['legendary', 'epic', 'rare', 'common', 'special'];

export function Collection() {
  return <WorldPage className="w-collection" tabs><CollectionBody /></WorldPage>;
}
function CollectionBody() {
  const [tab, setTab] = useState<CTab>('backgrounds');
  const { items } = useStore();
  const [egg] = useLocal<Egg>(KEYS.egg, { foundOn: null });
  const hatched = activeDays(items, egg.foundOn).days >= HATCH_DAYS;
  const shelves = tab === 'backgrounds'
    ? TIERS.map(t => ({ t, list: BACKDROPS.filter(b => b.rarity === t).map(b => ({ id: b.id, label: b.label, locked: !!b.from, src: `/figma/world/bg/${b.id}.svg`, href: `/style/card/${b.id}` })) }))
    : tab === 'outfits'
      ? TIERS.map(t => ({ t, list: STYLES.filter(s => s.rarity === t).map(s => ({ id: s.id, label: s.label, locked: !!s.from, src: `/figma/world/style/${s.art}.svg`, href: '/style/outfit' })) }))
      : [];
  return (
    <>
      <h1 className="w-h1 w-h1-l">Collection</h1>
      <div className="w-chips" role="tablist" aria-label="Collection">
        {(['outfits', 'backgrounds', 'pets', 'eggs'] as CTab[]).map(c => (
          <button key={c} type="button" role="tab" aria-selected={tab === c} className={`w-tab${tab === c ? ' is-on' : ''}`} onClick={() => setTab(c)}>
            {c[0].toUpperCase() + c.slice(1)}
          </button>
        ))}
      </div>
      {shelves.filter(s => s.list.length).map(s => (
        <section key={s.t} className="w-shelf" aria-label={RARITY[s.t].label}>
          <h2 className="w-tier"><span style={{ background: RARITY[s.t].color }} />{RARITY[s.t].label}</h2>
          <div className="w-shelf-row">
            {s.list.map(i => i.locked ? (
              <span key={i.id} className={`w-shelf-item is-locked${tab === 'outfits' ? ' is-fit' : ''}`} role="img" aria-label={`${i.label}, locked`}>
                <img src={i.src} alt="" /><span className="w-veil" /><Icon name={wi('lock')} size={24} className="w-shelf-lock" />
              </span>
            ) : (
              <Link key={i.id} href={i.href} className={`w-shelf-item${tab === 'outfits' ? ' is-fit' : ''}`} aria-label={i.label}><img src={i.src} alt="" /></Link>
            ))}
          </div>
        </section>
      ))}
      {tab === 'pets' && hatched && (
        <div className="w-shelf-row"><Link href="/pets" className="w-shelf-item is-fit" aria-label="Momo"><img src="/figma/world/momo.svg" alt="" /></Link></div>
      )}
      {tab === 'eggs' && egg.foundOn && !hatched && (
        <div className="w-shelf-row"><Link href="/eggs" className="w-shelf-item is-fit" aria-label="Hatching soon"><img src="/figma/world/egg-warm.svg" alt="" /></Link></div>
      )}
    </>
  );
}

/* ── MS3 · Background card (879:181259) ────────────────────────────────── */
export function BackdropCard({ id }: { id: string }) {
  return <WorldPage className="w-reveal"><CardBody id={id} /></WorldPage>;
}
function CardBody({ id }: { id: string }) {
  const router = useRouter();
  const back = useBack('/style/collection');
  const [, setLook] = useLook();
  const b = BACKDROPS.find(x => x.id === id && !x.from);
  const once = useRef(false);
  useEffect(() => { if (!b && !once.current) { once.current = true; router.replace('/style/collection'); } }, [b, router]);
  if (!b) return null;
  const r = RARITY[b.rarity];
  return (
    <>
      <WorldHeader kind="close" onNav={back} />
      <div className="w-reveal-card" style={{ '--tier': r.color } as React.CSSProperties}>
        <div className="w-reveal-inner">
          <span className="w-reveal-art"><img src={`/figma/world/${b.id === 'space' ? 'card-space' : `bg/${b.id}`}.svg`} alt="" /></span>
          <span className="w-reveal-chip">{r.label}</span>
          <div className="w-reveal-text">
            <h1 className="w-title-l">{b.label}</h1>
            <p className="t-body-s c-2">Background for Mylo, your chats and your room window.</p>
          </div>
        </div>
      </div>
      <p className="w-reveal-title">New background!</p>
      <div className="spacer" />
      <button type="button" className="w-light-btn" onClick={() => { setLook(l => ({ ...l, backdrop: b.id })); router.push('/style'); }}>Use it now</button>
      <button type="button" className="w-ghost-btn" onClick={() => router.push('/style/collection')}>Add to collection</button>
    </>
  );
}
