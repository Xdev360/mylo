'use client';

import { useEffect, useRef, useState } from 'react';
import Sheet from '@/components/Sheet';
import { SheetRow } from './bits';

/* P25 · Change photo (877:116768) and P26 · Crop photo (877:116926). A real
   file input (the camera on a phone for "Take a photo"), then a circle you
   drag and pinch, cut to a 640 square JPEG on a canvas. */
export default function PhotoFlow({ open, onClose, hasPhoto, onPhoto, onMylo, onRemove }: {
  open: boolean; onClose: () => void; hasPhoto: boolean;
  onPhoto: (blob: Blob) => Promise<void> | void; onMylo: () => void; onRemove: () => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState<string | null>(null);

  function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    onClose();
    setSrc(URL.createObjectURL(f));
  }
  function closeCrop() { if (src) URL.revokeObjectURL(src); setSrc(null); }

  return (
    <>
      <Sheet open={open} onClose={onClose} title="Profile photo" labelId="pf-photo-title">
        <div className="pf-rows">
          <SheetRow icon="profile/camera" label="Take a photo" onClick={() => camera.current?.click()} />
          <SheetRow icon="profile/photo" label="Choose from library" onClick={() => library.current?.click()} />
          <SheetRow icon="profile/mylo-look" label="Use my Mylo look" onClick={() => { onMylo(); onClose(); }} />
          {hasPhoto && <SheetRow icon="profile/trash" label="Remove photo" danger chevron={false} onClick={() => { onRemove(); onClose(); }} />}
        </div>
      </Sheet>
      <input ref={camera} type="file" accept="image/*" capture="user" hidden onChange={pick} />
      <input ref={library} type="file" accept="image/*" hidden onChange={pick} />
      {src && <Crop src={src} onCancel={closeCrop} onDone={async blob => { await onPhoto(blob); closeCrop(); }} />}
    </>
  );
}

function Crop({ src, onCancel, onDone }: { src: string; onCancel: () => void; onDone: (b: Blob) => Promise<void> }) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null);
  const [size, setSize] = useState(360);
  const [z, setZ] = useState(1);
  const [o, setO] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; z: number } | null>(null);

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
  const dw = nat ? nat.w * base * z : size, dh = nat ? nat.h * base * z : size;
  const clamp = (p: { x: number; y: number }, zz = z) => {
    const w = nat ? nat.w * base * zz : size, h = nat ? nat.h * base * zz : size;
    const mx = Math.max(0, (w - size) / 2), my = Math.max(0, (h - size) / 2);
    return { x: Math.min(mx, Math.max(-mx, p.x)), y: Math.min(my, Math.max(-my, p.y)) };
  };
  const zoomTo = (nz: number) => { const zz = Math.min(4, Math.max(1, nz)); setZ(zz); setO(p => clamp(p, zz)); };

  function down(e: React.PointerEvent) {
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2) {
      const [a, b] = [...pts.current.values()];
      pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), z };
    }
  }
  function move(e: React.PointerEvent) {
    const prev = pts.current.get(e.pointerId); if (!prev) return;
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.current.size === 2 && pinch.current) {
      const [a, b] = [...pts.current.values()];
      zoomTo(pinch.current.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.d);
    } else if (pts.current.size === 1) {
      setO(p => clamp({ x: p.x + e.clientX - prev.x, y: p.y + e.clientY - prev.y }));
    }
  }
  function up(e: React.PointerEvent) { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = null; }

  async function done() {
    if (!nat || !img.current) return;
    setBusy(true); setErr('');
    try {
      const OUT = 640, k = OUT / size;
      const c = document.createElement('canvas'); c.width = OUT; c.height = OUT;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img.current, (size / 2 + o.x - dw / 2) * k, (size / 2 + o.y - dh / 2) * k, dw * k, dh * k);
      const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.88));
      if (!blob) throw new Error('Could not read that photo');
      await onDone(blob);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save that photo'); setBusy(false); }
  }

  return (
    <div className="pf-crop" role="dialog" aria-modal="true" aria-labelledby="pf-crop-title">
      <header className="pf-crop-head">
        <button type="button" className="pf-crop-btn" onClick={onCancel}>Cancel</button>
        <h2 id="pf-crop-title" className="pf-crop-title">Move and scale</h2>
        <button type="button" className="pf-crop-btn is-done" onClick={done} disabled={!nat || busy}>{busy ? '…' : 'Done'}</button>
      </header>
      <div className="pf-crop-stage" ref={box}
           onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
           onWheel={e => zoomTo(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08))}>
        <img ref={img} src={src} alt="Your photo" draggable={false} onLoad={e => setNat({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
             style={{ width: dw, height: dh, transform: `translate(calc(-50% + ${o.x}px), calc(-50% + ${o.y}px))` }} />
        <span className="pf-crop-ring" aria-hidden />
      </div>
      <p className="t-body-s pf-crop-hint">{err || 'Pinch to zoom. Drag to move.'}</p>
      <label className="pf-crop-zoom">
        <span className="sr-only">Zoom</span>
        <input type="range" min={1} max={4} step={0.01} value={z} onChange={e => zoomTo(Number(e.target.value))} />
      </label>
    </div>
  );
}
