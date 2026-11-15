'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated } from '@/lib/local';
import { profileUrl, useProfile } from '@/lib/profile';
import { go, leave, readDraft, writeDraft } from '@/lib/system';
import Room, { frame, selectionBox, type RoomLayers } from './Room';
import { BareSheet, copyText, useToast } from './bits';
import { useRoom } from './ProfileView';
import { CATEGORIES, EDIT_F, decorBox, type Category, type Decor, type DecorKind, type Option, type RoomState } from './room-data';

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
    if (!p.username) { go(router, '/profile/edit'); return; }
    const url = profileUrl(p.username);
    try { if (navigator.share) { await navigator.share({ title, url }); return; } } catch { return; }
    toast.show((await copyText(url)) ? 'Link copied' : url);
  }
  /* The editor is this screen with ?edit=1, so a reload keeps it open (and
     the draft, below). Closing swaps the address back without a new entry. */
  function close() { writeDraft(ROOM_DRAFT, null); router.replace('/profile/room', { scroll: false }); }

  return (
    <main className="pf-room screen on-desk">
      <div className="pf-room-scene">
        <Room room={room} H={RH} F={RF} mylo="room" fit="slice" className="pf-room-svg" label={title} />
        <div className="pf-room-top">
          <button type="button" className="back-btn" aria-label="Back" onClick={() => leave(router, '/profile')}>
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

const ROOM_DRAFT = 'mylo.profile.room-draft.v1';

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
  return { id: kind, kind, dx: 196.5 - (b.x + b.w / 2), dy: (F - 10 - (b.y + b.h / 2)) * EDIT_F / F, s: Math.min(2.4, 280 / b.w, (F * 0.9) / b.h) };
}
const KEY: Record<Exclude<Category, 'decor'>, keyof RoomState> = { walls: 'wall', windows: 'window', floors: 'floor', rugs: 'rug', lighting: 'light' };

const SMIN = 0.5, SMAX = 2.2;
let seq = 0;
const newId = (kind: string) => `${kind}-${Date.now().toString(36)}${(seq++).toString(36)}`;
const deg = (a: number) => (a * 180) / Math.PI;
/* Turning settles on the straight angles when it comes within 4°. */
function snapAngle(r: number) {
  const n = ((r % 360) + 540) % 360 - 180;
  const near = Math.round(n / 45) * 45;
  return Math.abs(n - near) < 4 ? near : n;
}
type Pt = { x: number; y: number };
type Gesture = {
  id: string; mode: 'move' | 'pinch' | 'size' | 'turn';
  start: Decor; p0: Pt; d0: number; a0: number; c: Pt;
};

function Editor({ initial, onCancel, onSave }: { initial: RoomState; onCancel: () => void; onSave: (r: RoomState) => void }) {
  const [draft, setDraftState] = useState<RoomState>(() => readDraft<RoomState>(ROOM_DRAFT) ?? initial);
  const [cat, setCat] = useState<Category>('walls');
  const [sel, setSel] = useState<string | null>(null);
  const [locked, setLocked] = useState<Option | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [active, setActive] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const scene = useRef<HTMLDivElement>(null);
  const pts = useRef(new Map<number, Pt>());
  const gesture = useRef<Gesture | null>(null);
  const draftRef = useRef(draft);
  const C = CATEGORIES.find(c => c.id === cat)!;

  /* Every change is kept for this tab, so a reload mid-edit loses nothing. */
  const setDraft = (f: RoomState | ((r: RoomState) => RoomState)) => setDraftState(prev => {
    const next = typeof f === 'function' ? f(prev) : f;
    draftRef.current = next;
    writeDraft(ROOM_DRAFT, next);
    return next;
  });
  /* It slides away before it goes. */
  const finish = (then: () => void) => { if (leaving) return; setLeaving(true); setTimeout(then, 220); };
  const cancel = () => finish(onCancel);
  const save = () => finish(() => onSave(draftRef.current));

  const unit = () => 393 / (svg.current?.getBoundingClientRect().width || 393);
  const patch = (id: string, f: (d: Decor) => Decor) => setDraft(r => ({ ...r, decor: r.decor.map(x => x.id === id ? fit(f(x)) : x) }));
  function remove(id: string) { setDraft(r => ({ ...r, decor: r.decor.filter(x => x.id !== id) })); setSel(null); }
  function duplicate(d: Decor) {
    const id = newId(d.kind);
    setDraft(r => ({ ...r, decor: [...r.decor, fit({ ...d, id, dx: d.dx + 24, dy: d.dy + 12 })] })); setSel(id);
  }
  /* A piece stays in the room: its middle never leaves the picture, and its
     size stays between half and a bit over double. */
  function fit(d: Decor): Decor {
    const b = decorBox(d.kind, EF);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return {
      ...d,
      s: Math.min(SMAX, Math.max(SMIN, d.s)),
      dx: Math.min(393 - 8 - cx, Math.max(8 - cx, d.dx)),
      dy: Math.min(EH - 8 - cy, Math.max(8 - cy, d.dy))
    };
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { if (locked) return; if (sel) setSel(null); else cancel(); return; }
      if (!sel) return;
      const step = e.shiftKey ? 10 : 1;
      const moves: Record<string, (d: Decor) => Decor> = {
        ArrowLeft: d => ({ ...d, dx: d.dx - step }), ArrowRight: d => ({ ...d, dx: d.dx + step }),
        ArrowUp: d => ({ ...d, dy: d.dy - step }), ArrowDown: d => ({ ...d, dy: d.dy + step }),
        '[': d => ({ ...d, r: snapAngle((d.r ?? 0) - 15) }), ']': d => ({ ...d, r: snapAngle((d.r ?? 0) + 15) }),
        '+': d => ({ ...d, s: d.s * 1.05 }), '=': d => ({ ...d, s: d.s * 1.05 }), '-': d => ({ ...d, s: d.s / 1.05 })
      };
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel); return; }
      const f = moves[e.key]; if (!f) return;
      e.preventDefault(); patch(sel, f);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /* ── Gestures ──────────────────────────────────────────────────────────
     One finger on a piece moves it. A second finger anywhere turns that into
     a pinch: the distance sizes it, the twist turns it and the midpoint
     carries it. A corner handle sizes from the middle; the knob turns it.
     Lifting one finger of two carries on as a move from where it is, so
     nothing jumps. Every value starts from a snapshot taken when the
     fingers change, never from the last frame, so nothing drifts. */
  function centre(d: Decor): Pt {
    const r = svg.current!.getBoundingClientRect(), k = unit();
    const f = frame(d, EF);
    return { x: r.left + f.cx / k, y: r.top + f.cy / k };
  }
  function rebase(mode?: Gesture['mode']) {
    const g = gesture.current; if (!g) return;
    const d = draftRef.current.decor.find(x => x.id === g.id); if (!d) { gesture.current = null; return; }
    const v = [...pts.current.values()];
    const m = mode ?? (v.length >= 2 ? 'pinch' : g.mode === 'pinch' ? 'move' : g.mode);
    const c = centre(d);
    const p0 = v.length >= 2 ? { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 } : v[0] ?? c;
    const d0 = v.length >= 2 ? Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y) : Math.hypot(p0.x - c.x, p0.y - c.y);
    const a0 = v.length >= 2 ? Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x) : Math.atan2(p0.y - c.y, p0.x - c.x);
    gesture.current = { id: g.id, mode: m, start: { ...d }, p0, d0: d0 || 1, a0, c };
  }
  function grab(e: React.PointerEvent, d: Decor | null, mode: Gesture['mode']) {
    // Cancel, Save and the toolbar are buttons, not the room.
    if (!d && (e.target as Element).closest('button, a')) return;
    e.stopPropagation();
    const had = pts.current.size;
    if (!d && !(had && gesture.current)) { setSel(null); return; }
    try { scene.current?.setPointerCapture?.(e.pointerId); } catch { /* a pointer the browser no longer has */ }
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (had && gesture.current) { rebase('pinch'); return; }   // a second finger: pinch the piece in hand
    if (!d) return;
    setSel(d.id); setActive(true);
    gesture.current = { id: d.id, mode, start: d, p0: { x: 0, y: 0 }, d0: 1, a0: 0, c: { x: 0, y: 0 } };
    rebase(mode);
  }
  function onMove(e: React.PointerEvent) {
    const g = gesture.current; if (!g || !pts.current.has(e.pointerId)) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const v = [...pts.current.values()], k = unit(), s0 = g.start;
    let next: Decor;
    if (g.mode === 'pinch' && v.length >= 2) {
      const mid = { x: (v[0].x + v[1].x) / 2, y: (v[0].y + v[1].y) / 2 };
      const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y);
      const a = Math.atan2(v[1].y - v[0].y, v[1].x - v[0].x);
      next = { ...s0, s: s0.s * d / g.d0, r: snapAngle((s0.r ?? 0) + deg(a - g.a0)), dx: s0.dx + (mid.x - g.p0.x) * k, dy: s0.dy + (mid.y - g.p0.y) * k };
    } else if (g.mode === 'size') {
      next = { ...s0, s: s0.s * Math.hypot(e.clientX - g.c.x, e.clientY - g.c.y) / g.d0 };
    } else if (g.mode === 'turn') {
      next = { ...s0, r: snapAngle((s0.r ?? 0) + deg(Math.atan2(e.clientY - g.c.y, e.clientX - g.c.x) - g.a0)) };
    } else {
      next = { ...s0, dx: s0.dx + (e.clientX - g.p0.x) * k, dy: s0.dy + (e.clientY - g.p0.y) * k };
    }
    patch(g.id, () => next);
  }
  function onUp(e: React.PointerEvent) {
    if (!pts.current.delete(e.pointerId)) return;
    if (pts.current.size && gesture.current) { rebase(gesture.current.mode === 'pinch' ? 'move' : undefined); return; }
    gesture.current = null; setActive(false);
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
        const id = newId(kind);
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
  /* The toolbar sits above the piece, or below it when the piece is near the top. */
  const below = box ? box.top < 64 : false;

  return (
    <div className={`pf-editor${leaving ? ' is-out' : ''}`} role="dialog" aria-modal="true" aria-label="Room editor">
      <div className="pf-editor-col">
        <div ref={scene} className={`pf-editor-scene${active ? ' is-active' : ''}`} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
             onPointerDown={e => grab(e, null, 'move')}
             onWheel={e => { if (sel) patch(sel, x => e.shiftKey ? { ...x, r: snapAngle((x.r ?? 0) + (e.deltaY < 0 ? -5 : 5)) } : { ...x, s: x.s * (e.deltaY < 0 ? 1.06 : 1 / 1.06) }); }}>
          <Room ref={svg} room={draft} H={EH} F={EF} mylo="room" fit="meet" className="pf-editor-svg" label="Your room"
                selected={sel} onDecorDown={(e, d) => grab(e, d, 'move')} onHandleDown={(e, d) => grab(e, d, 'size')} onRotateDown={(e, d) => grab(e, d, 'turn')} />
          <div className="pf-editor-top">
            <button type="button" className="pf-chip pf-cancel" onClick={cancel}>Cancel</button>
            <button type="button" className="pf-chip pf-save" onClick={save}>Save</button>
          </div>
          {selected && box && (
            <div className={`pf-toolbar${below ? ' is-below' : ''}${active ? ' is-dim' : ''}`}
                 style={{ left: `${Math.min(84, Math.max(16, (box.cx / 393) * 100))}%`, top: `${((below ? box.top + box.h + 40 : box.top) / EH) * 100}%` }}
                 onPointerDown={e => e.stopPropagation()}>
              <button type="button" aria-label="Turn" onClick={() => patch(selected.id, x => ({ ...x, r: snapAngle((x.r ?? 0) + 45) }))}><Icon name="profile/refresh" size={24} /></button>
              <button type="button" aria-label="Duplicate" onClick={() => duplicate(selected)}><Icon name="profile/copy" size={24} /></button>
              <button type="button" aria-label="Remove" onClick={() => remove(selected.id)}><Icon name="profile/trash" size={24} /></button>
            </div>
          )}
          <p className={`pf-hint t-body-s${selected ? ' is-on' : ''}`} aria-hidden={!selected}>Drag to move. Pinch to resize.</p>
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
          <div className="pf-cat-body" key={cat}>
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
                    <span className="pf-opt-check" aria-hidden><Icon name="check" size={14} /></span>
                  </span>
                  <span className={o.locked ? 'pf-opt-from' : 'pf-opt-label'}>{o.locked ? o.locked.from : o.label}</span>
                </button>
              );
            })}
          </div>
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
