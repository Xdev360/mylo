'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated } from '@/lib/local';
import { profileUrl, useProfile } from '@/lib/profile';
import Room, { selectionBox, type RoomLayers } from './Room';
import { BareSheet, copyText, useToast } from './bits';
import { useRoom } from './ProfileView';
import { CATEGORIES, decorBox, type Category, type Decor, type DecorKind, type Option, type RoomState } from './room-data';
import { goBack } from '@/components/NavMotion';

/* P9 · My room (877:121055), P19 · Room saved (879:180632), and the editor
   P10-P15 (879:178538 ...) with P17 · Locked item (879:180073) and P18 ·
   Placing an item (879:180392). The room is the profile cover. */

const RH = 620, RF = 409;     // P9
const EH = 440, EF = 290;     // P10
const TH = 275, TF = 181;     // the option previews, 100 x 70

export default function RoomView() {
  const hydrated = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { profile: p } = useProfile();
  const [room, setRoom] = useRoom();
  const editing = params.get('edit') === '1';
  const toast = useToast();
  if (!hydrated) return <main className="screen" aria-busy="true" />;

  const title = p.name ? `${p.name.split(' ')[0]}'s room` : 'Your room';
  const inRoom = ['Mylo'];

  async function share() {
    if (!p.username) { router.push('/profile/edit'); return; }
    const url = profileUrl(p.username);
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch { return; }
    toast.show((await copyText(url)) ? 'Link copied' : url);
  }
  function close() { router.replace('/profile/room', { scroll: false }); }

  return (
    <main className="pf-room screen on-desk">
      <div className="pf-room-scene">
        <Room room={room} H={RH} F={RF} mylo="room" fit="slice" className="pf-room-svg" label={title} />
        <div className="pf-room-top">
          <button type="button" className="back-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? goBack(router) : router.push('/profile'))}>
            <Icon name="chevron-right" size={20} className="flip" />
          </button>
          <span className="pf-chip pf-room-name">{title}</span>
          <button type="button" className="pf-round" aria-label="Share" onClick={share}><Icon name="profile/share" size={24} /></button>
        </div>
      </div>
      <section className="pf-room-panel">
        <span className="pf-grabber-line" aria-hidden />
        <h1 className="t-title-s pf-room-h">Your room is your profile cover</h1>
        <p className="t-body-s c-2">Friends see it when they open your profile.</p>
        <div className="pf-actions">
          <button type="button" className="pf-btn is-dark" onClick={() => router.replace('/profile/room?edit=1', { scroll: false })}>
            <Icon name="profile/pencil" size={22} />Edit room
          </button>
          <Link href="/visits" className="pf-btn"><Icon name="profile/room" size={22} />Invite over</Link>
        </div>
        <Link href="/pets" className="pf-inroom"><span className="t-body">In your room: {inRoom.join(', ')}</span><span className="t-body c-2">Change</span></Link>
      </section>
      {editing && <Editor initial={room} onCancel={close} onSave={next => { setRoom(next); close(); toast.show('Room saved. Your profile cover is updated.'); }} />}
      {toast.node}
    </main>
  );
}

function layersFor(cat: Category, kind?: DecorKind): RoomLayers {
  switch (cat) {
    case 'walls': case 'floors': return { window: false, rug: false, decor: 'none', light: false };
    case 'windows': return { rug: false, decor: 'none', light: false };
    case 'rugs': return { window: false, decor: 'none', light: false };
    case 'decor': return { window: false, rug: false, decor: kind, light: false };
    case 'lighting': return { rug: false, decor: 'none' };
  }
}
/* Decor previews show the piece itself, centred and larger, as P14 does. */
function solo(kind: DecorKind, F: number): Decor {
  const b = decorBox(kind, F);
  return { id: kind, kind, dx: 196.5 - (b.x + b.w / 2), dy: F - 10 - (b.y + b.h / 2), s: Math.min(2.4, 280 / b.w, (F * 0.9) / b.h) };
}
const KEY: Record<Exclude<Category, 'decor'>, keyof RoomState> = { walls: 'wall', windows: 'window', floors: 'floor', rugs: 'rug', lighting: 'light' };

function Editor({ initial, onCancel, onSave }: { initial: RoomState; onCancel: () => void; onSave: (r: RoomState) => void }) {
  const [draft, setDraft] = useState<RoomState>(initial);
  const [cat, setCat] = useState<Category>('walls');
  const [sel, setSel] = useState<string | null>(null);
  const [locked, setLocked] = useState<Option | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; mode: 'move' | 'size'; x: number; y: number; dx: number; dy: number; s: number; d0?: number } | null>(null);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const C = CATEGORIES.find(c => c.id === cat)!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (sel) setSel(null); else onCancel(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel && !(e.target instanceof HTMLInputElement)) remove(sel);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const unit = () => 393 / (svg.current?.clientWidth || 393);
  const patch = (id: string, f: (d: Decor) => Decor) => setDraft(r => ({ ...r, decor: r.decor.map(x => x.id === id ? f(x) : x) }));
  function remove(id: string) { setDraft(r => ({ ...r, decor: r.decor.filter(x => x.id !== id) })); setSel(null); }

  function onDecorDown(e: React.PointerEvent, d: Decor) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setSel(d.id);
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      drag.current = { id: d.id, mode: 'size', x: 0, y: 0, dx: d.dx, dy: d.dy, s: d.s, d0: Math.hypot(a.x - b.x, a.y - b.y) };
    } else drag.current = { id: d.id, mode: 'move', x: e.clientX, y: e.clientY, dx: d.dx, dy: d.dy, s: d.s };
  }
  function onHandleDown(e: React.PointerEvent, d: Decor) {
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const r = svg.current!.getBoundingClientRect();
    const b = selectionBox(d, EF);
    const cx = r.left + (b.left + b.w / 2) / unit(), cy = r.top + (b.top + b.h / 2) / unit();
    drag.current = { id: d.id, mode: 'size', x: cx, y: cy, dx: d.dx, dy: d.dy, s: d.s, d0: Math.hypot(e.clientX - cx, e.clientY - cy) };
    pts.current.clear(); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }
  function onMove(e: React.PointerEvent) {
    const g = drag.current; if (!g || !pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (g.mode === 'move') {
      const k = unit();
      patch(g.id, x => ({ ...x, dx: g.dx + (e.clientX - g.x) * k, dy: g.dy + (e.clientY - g.y) * k }));
    } else {
      const v = [...pts.current.values()];
      const dist = v.length >= 2 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : Math.hypot(e.clientX - g.x, e.clientY - g.y);
      patch(g.id, x => ({ ...x, s: Math.min(2.2, Math.max(0.5, g.s * dist / (g.d0 || 1))) }));
    }
  }
  function onUp(e: React.PointerEvent) {
    pts.current.delete(e.pointerId);
    if (pts.current.size === 0) drag.current = null;
  }

  function choose(o: Option) {
    if (o.locked) { setLocked(o); return; }
    if (cat === 'decor') {
      const kind = o.id as DecorKind;
      /* A new piece arrives selected, ready to place (P18). */
      if (draft.decor.some(x => x.kind === kind)) {
        setDraft(r => ({ ...r, decor: r.decor.filter(x => x.kind !== kind) }));
        setSel(null);
      } else {
        const id = `${kind}-${Date.now().toString(36)}`;
        setDraft(r => ({ ...r, decor: [...r.decor, { id, kind, dx: 0, dy: 0, s: 1 }] }));
        setSel(id);
      }
    } else setDraft(r => ({ ...r, [KEY[cat]]: o.id }));
  }
  const isOn = (o: Option) => cat === 'decor' ? draft.decor.some(x => x.kind === o.id) : draft[KEY[cat]] === o.id;
  const preview = (o: Option): RoomState => cat === 'decor'
    ? { ...draft, decor: [solo(o.id as DecorKind, TF)] }
    : { ...draft, [KEY[cat]]: o.id };

  const selected = draft.decor.find(x => x.id === sel);
  const box = selected ? selectionBox(selected, EF) : null;

  return (
    <div className="pf-editor" role="dialog" aria-modal="true" aria-label="Room editor">
      <div className="pf-editor-col">
        <div className="pf-editor-scene" onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
             onPointerDown={() => setSel(null)}
             onWheel={e => { if (sel) patch(sel, x => ({ ...x, s: Math.min(2.2, Math.max(0.5, x.s * (e.deltaY < 0 ? 1.06 : 1 / 1.06))) })); }}>
          <Room ref={svg} room={draft} H={EH} F={EF} mylo="room" fit="meet" className="pf-editor-svg" label="Your room"
                selected={sel} onDecorDown={onDecorDown} onHandleDown={onHandleDown} />
          <div className="pf-editor-top">
            <button type="button" className="pf-chip pf-cancel" onClick={onCancel}>Cancel</button>
            <button type="button" className="pf-chip pf-save" onClick={() => onSave(draft)}>Save</button>
          </div>
          {selected && box && (
            <div className="pf-toolbar" style={{ left: `${((box.left + box.w / 2) / 393) * 100}%`, top: `${(box.top / EH) * 100}%` }}
                 onPointerDown={e => e.stopPropagation()}>
              <button type="button" aria-label="Flip" onClick={() => patch(selected.id, x => ({ ...x, flip: !x.flip }))}><Icon name="profile/refresh" size={24} /></button>
              <button type="button" aria-label="Duplicate" onClick={() => {
                const id = `${selected.kind}-${Date.now().toString(36)}`;
                setDraft(r => ({ ...r, decor: [...r.decor, { ...selected, id, dx: selected.dx + 24, dy: selected.dy + 12 }] })); setSel(id);
              }}><Icon name="profile/copy" size={24} /></button>
              <button type="button" aria-label="Remove" onClick={() => remove(selected.id)}><Icon name="profile/trash" size={24} /></button>
            </div>
          )}
          {selected && <p className="pf-hint t-body-s">Drag to move. Pinch to resize.</p>}
        </div>

        <section className="pf-editor-panel">
          <span className="pf-grabber-line" aria-hidden />
          <div className="pf-cats" role="tablist" aria-label="Room parts">
            {CATEGORIES.map(c => (
              <button key={c.id} type="button" role="tab" aria-selected={c.id === cat} className="pf-cat" onClick={() => { setCat(c.id); setSel(null); }}>
                <Icon name={c.icon} size={24} /><span>{c.label}</span>
              </button>
            ))}
          </div>
          <h2 className="pf-sec-title">{C.title}</h2>
          <p className="t-caption c-3 pf-editor-sub">{C.sub}</p>
          <div className="pf-opts">
            {C.options.map(o => {
              const on = isOn(o);
              return (
                <button key={o.id} type="button" className={`pf-opt${on ? ' is-on' : ''}${o.locked ? ' is-locked' : ''}`} aria-pressed={o.locked ? undefined : on} onClick={() => choose(o)}>
                  <span className="pf-opt-thumb">
                    <Room room={preview(o)} H={TH} F={TF} layers={layersFor(cat, o.id as DecorKind)} />
                    {o.locked && <><span className="pf-veil" /><span className="pf-lock"><Icon name="profile/lock" size={14} /></span></>}
                    {on && <span className="pf-opt-check"><Icon name="check" size={14} /></span>}
                  </span>
                  <span className={o.locked ? 'pf-opt-from' : 'pf-opt-label'}>{o.locked ? o.locked.from : o.label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <BareSheet open={Boolean(locked)} onClose={() => setLocked(null)} label={locked?.locked?.title ?? 'Locked'}>
        {locked?.locked && (
          <div className="pf-locked">
            <span className="pf-locked-art">
              <Room room={{ ...draft, ...(cat === 'decor' ? { decor: [solo(locked.id as DecorKind, 150 / 345 * 393 * 0.63)] } : { [KEY[cat as Exclude<Category, 'decor'>]]: locked.id }) }}
                    H={150 / 345 * 393} F={150 / 345 * 393 * 0.63} layers={layersFor(cat, locked.id as DecorKind)} />
            </span>
            <span className="pf-rarity t-caption">{locked.locked.rarity}</span>
            <h2 className="t-title-m">{locked.locked.title}</h2>
            <p className="t-body c-2">{locked.locked.body}</p>
            <Link href="/chest" className="btn-primary pf-wide">See how chests work</Link>
          </div>
        )}
      </BareSheet>
    </div>
  );
}
