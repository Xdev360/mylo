'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { usePresence } from '@/lib/system';
import { SheetRow } from './bits';

/* P25 · Change photo (877:116768) and P26 · Crop photo (877:116926). A real
   file input (the camera on a phone for "Take a photo"), then a circle you
   drag and pinch, cut to a 640 square JPEG on a canvas. */
export default function PhotoFlow({ open, onClose, hasPhoto, onPhoto, onMylo, onRemove }: {
  open: boolean; onClose: () => void; hasPhoto: boolean;
  onPhoto: (blob: Blob) => Promise<void> | void; onMylo: () => Promise<void> | void; onRemove: () => Promise<void> | void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const { mounted, shown } = usePresence(cropOpen, 260);
  const [err, setErr] = useState('');

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!f.type.startsWith('image/')) { setErr('That file is not a photo'); return; }
    onClose();
    if (src) URL.revokeObjectURL(src);
    setSrc(URL.createObjectURL(f));
    setCropOpen(true);
  }
  /* The crop screen fades away first, then lets go of the picture. */
  const closeCrop = useCallback(() => setCropOpen(false), []);
  useEffect(() => {
    if (mounted || !src) return;
    URL.revokeObjectURL(src);
    const t = setTimeout(() => setSrc(null), 0);
    return () => clearTimeout(t);
  }, [mounted, src]);

  return (
    <>
      <Sheet open={open} onClose={() => { setErr(''); onClose(); }} title="Profile photo" labelId="pf-photo-title">
        <div className="pf-rows">
          <SheetRow icon="profile/camera" label="Take a photo" onClick={() => camera.current?.click()} />
          <SheetRow icon="profile/photo" label="Choose from library" onClick={() => library.current?.click()} />
          <SheetRow icon="profile/mylo-look" label="Use my Mylo look" onClick={() => { onClose(); void onMylo(); }} />
          {hasPhoto && <SheetRow icon="profile/trash" label="Remove photo" danger chevron={false} onClick={() => { onClose(); void onRemove(); }} />}
        </div>
        {err && <p className="t-body-s pf-danger pf-photo-err" role="alert">{err}</p>}
      </Sheet>
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={pick} />
      <input ref={library} type="file" accept="image/*" hidden onChange={pick} />
      {mounted && src && <Crop src={src} shown={shown} onCancel={closeCrop} onDone={async blob => { await onPhoto(blob); closeCrop(); }} />}
    </>
  );
}

type View = { z: number; x: number; y: number };
const MAX = 5;

function Crop({ src, shown, onCancel, onDone }: { src: string; shown: boolean; onCancel: () => void; onDone: (b: Blob) => Promise<void> }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState(360);
  /* What is drawn. While a finger is down it may go a little past the edges
     (and below full size), with resistance; letting go springs it back. */
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ z0: number; x0: number; y0: number; d0: number; mx: number; my: number; px: number; py: number } | null>(null);
  const raw = useRef<View>({ z: 1, x: 0, y: 0 });
  const lastTap = useRef(0);
  const wheelEnd = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize(el.clientWidth));
    ro.observe(el); setSize(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const base = nat ? Math.max(size / nat.w, size / nat.h) : 1;
  const bw = nat ? nat.w * base : size, bh = nat ? nat.h * base : size;
  const limits = useCallback((z: number) => ({ mx: Math.max(0, (bw * z - size) / 2), my: Math.max(0, (bh * z - size) / 2) }), [bw, bh, size]);
  /* The resting place: the circle always full of photo. */
  const settle = useCallback((v: View): View => {
    const z = Math.min(MAX, Math.max(1, v.z));
    const { mx, my } = limits(z);
    return { z, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }, [limits]);
  /* Past the edge it moves a third as far, so it feels held, not stopped. */
  const resist = useCallback((v: View): View => {
    const s = settle(v);
    const z = v.z < 1 ? 1 - (1 - v.z) * 0.35 : v.z > MAX ? MAX + (v.z - MAX) * 0.2 : v.z;
    return { z, x: s.x + (v.x - s.x) * 0.35, y: s.y + (v.y - s.y) * 0.35 };
  }, [settle]);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left - r.width / 2, y: e.clientY - r.top - r.height / 2 };
  };
  /* Zoom to z keeping the photo point under (px, py) where it is. */
  const zoomAt = (v: View, z: number, px: number, py: number): View => {
    const k = z / v.z;
    return { z, x: px - (px - v.x) * k, y: py - (py - v.y) * k };
  };

  function begin() {
    const ps = [...pts.current.values()];
    const v = raw.current;
    if (ps.length >= 2) {
      const [a, b] = ps;
      const m = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      gesture.current = { z0: v.z, x0: v.x, y0: v.y, d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, mx: m.x, my: m.y, px: 0, py: 0 };
    } else if (ps.length === 1) {
      gesture.current = { z0: v.z, x0: v.x, y0: v.y, d0: 1, mx: 0, my: 0, px: ps[0].x, py: ps[0].y };
    } else gesture.current = null;
  }
  function down(e: React.PointerEvent) {
    if (!nat) return;
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* a pointer the browser no longer has */ }
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    raw.current = view;
    setLive(true);
    begin();
  }
  function move(e: React.PointerEvent) {
    if (!pts.current.has(e.pointerId) || !gesture.current) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;
    const ps = [...pts.current.values()];
    let v: View;
    if (ps.length >= 2) {
      const [a, b] = ps;
      const m = local({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 });
      const z = g.z0 * Math.hypot(a.x - b.x, a.y - b.y) / g.d0;
      // The photo point under the fingers' first midpoint follows the midpoint.
      const k = z / g.z0;
      v = { z, x: m.x - (g.mx - g.x0) * k, y: m.y - (g.my - g.y0) * k };
    } else {
      v = { z: g.z0, x: g.x0 + ps[0].x - g.px, y: g.y0 + ps[0].y - g.py };
    }
    raw.current = v;
    setView(resist(v));
  }
  function up(e: React.PointerEvent) {
    if (!pts.current.delete(e.pointerId)) return;
    if (pts.current.size) { raw.current = resist(raw.current); begin(); return; }
    gesture.current = null;
    // A quick second tap zooms in on that spot, or back out.
    const now = Date.now();
    const tap = now - lastTap.current < 280;
    lastTap.current = tap ? 0 : now;
    setLive(false);
    if (tap) {
      const p = local(e);
      const target = view.z > 1.6 ? 1 : 2.5;
      setView(v => settle(zoomAt(v, target, p.x, p.y)));
    } else setView(v => settle(v));
  }
  function wheel(e: React.WheelEvent) {
    if (!nat) return;
    const p = local(e);
    // A trackpad pinch arrives as a wheel with ctrl held, in smaller steps.
    const z = Math.min(MAX, Math.max(1, view.z * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022))));
    setLive(true);
    setView(v => settle(zoomAt(v, z, p.x, p.y)));
    if (wheelEnd.current) clearTimeout(wheelEnd.current);
    wheelEnd.current = setTimeout(() => setLive(false), 120);
  }
  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 40 : 10;
    const map: Record<string, (v: View) => View> = {
      ArrowLeft: v => ({ ...v, x: v.x + step }), ArrowRight: v => ({ ...v, x: v.x - step }),
      ArrowUp: v => ({ ...v, y: v.y + step }), ArrowDown: v => ({ ...v, y: v.y - step }),
      '+': v => zoomAt(v, Math.min(MAX, v.z * 1.15), 0, 0), '=': v => zoomAt(v, Math.min(MAX, v.z * 1.15), 0, 0),
      '-': v => zoomAt(v, Math.max(1, v.z / 1.15), 0, 0)
    };
    const f = map[e.key]; if (!f) return;
    e.preventDefault();
    setView(v => settle(f(v)));
  }

  async function done() {
    if (!nat || !img.current || busy) return;
    setBusy(true); setErr('');
    try {
      const v = settle(view);
      const OUT = 640, k = OUT / size;
      const dw = bw * v.z, dh = bh * v.z;
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img.current, (size / 2 + v.x - dw / 2) * k, (size / 2 + v.y - dh / 2) * k, dw * k, dh * k);
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.88));
      if (!blob) throw new Error('Could not read that photo');
      await onDone(blob);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save that photo'); setBusy(false); }
  }

  return (
    <div className={`pf-crop${shown ? ' is-in' : ''}`} role="dialog" aria-modal="true" aria-labelledby="pf-crop-title">
      <header className="pf-crop-head">
        <button type="button" className="pf-crop-btn" onClick={onCancel} disabled={busy}>Cancel</button>
        <h2 id="pf-crop-title" className="pf-crop-title">Move and scale</h2>
        <button type="button" className="pf-crop-btn is-done" onClick={done} disabled={!nat || busy} aria-busy={busy}>
          {busy ? <span className="pf-crop-spin" aria-label="Saving" /> : 'Done'}
        </button>
      </header>
      <div className={`pf-crop-stage${live ? ' is-live' : ''}`} ref={box} tabIndex={0} aria-label="Photo. Drag to move, pinch or scroll to zoom."
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} onKeyDown={key}>
        <img ref={img} src={src} alt="Your photo" draggable={false}
             onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
             onError={() => setErr('Could not read that photo')}
             style={{ width: bw, height: bh, transform: `translate(-50%, -50%) translate3d(${view.x}px, ${view.y}px, 0) scale(${view.z})`, opacity: nat ? 1 : 0 }} />
        <span className="pf-crop-ring" aria-hidden />
      </div>
      <p className={`t-body-s pf-crop-hint${err ? ' is-err' : ''}`} role={err ? 'alert' : undefined}>{err || 'Pinch to zoom. Drag to move.'}</p>
      <label className="pf-crop-zoom">
        <span className="sr-only">Zoom</span>
        <input type="range" min={1} max={MAX} step={0.01} value={Math.min(MAX, Math.max(1, view.z))}
               onChange={e => setView(v => settle(zoomAt(v, Number(e.target.value), 0, 0)))} />
      </label>
    </div>
  );
}
