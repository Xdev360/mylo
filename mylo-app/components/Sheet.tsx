'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/* Every bottom sheet, from the "SheetHeader" component (139:643): grabber,
   title, one-line purpose, close. Rises from the bottom over a dim layer on a
   phone, opens in the middle on a wide screen. Swipe down on the grabber (or
   flick it), tap the dim layer, the close button or press Escape to close.
   While it slides away it keeps showing what it showed, so it never empties
   on the way down, and one sheet handing over to the next keeps the dim. */
export default function Sheet({ open, onClose, title, sub, children, labelId }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; labelId?: string;
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<{ y: number; t: number; v: number } | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = labelId ?? `sheet-${title.replace(/\W+/g, '-').toLowerCase()}`;
  // What it last showed while open, drawn while it closes.
  const [last, setLast] = useState({ title, sub, children });
  if (open && (last.title !== title || last.sub !== sub || last.children !== children)) setLast({ title, sub, children });
  const shown = open ? { title, sub, children } : last;

  useEffect(() => {
    if (!open) return;
    const back = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Focus moves into the sheet unless something inside already took it.
    const t = setTimeout(() => { if (!panel.current?.contains(document.activeElement)) panel.current?.focus({ preventScroll: true }); }, 60);
    return () => { window.removeEventListener('keydown', onKey); clearTimeout(t); if (back?.isConnected && !document.querySelector('.sheet-root.is-open')) back.focus({ preventScroll: true }); };
  }, [open, onClose]);

  // The phone keyboard: the sheet sits on top of it, and the field being
  // typed in scrolls into view inside the sheet.
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!open || !vv) return;
    const fit = () => {
      const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      root.current?.style.setProperty('--kb', `${kb > 60 ? kb : 0}px`);
      const f = document.activeElement as HTMLElement | null;
      if (kb > 60 && f && panel.current?.contains(f) && f.matches('input, textarea, select, [contenteditable]')) f.scrollIntoView({ block: 'nearest' });
    };
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    const onFocus = () => setTimeout(fit, 250);
    panel.current?.addEventListener('focusin', onFocus);
    const el = panel.current, r = root.current;
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); el?.removeEventListener('focusin', onFocus); r?.style.removeProperty('--kb'); };
  }, [open]);

  return (
    <div ref={root} className={`sheet-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={id} className="sheet" tabIndex={-1}
           style={drag ? { translate: `0 ${drag}px`, transition: 'none' } : undefined}>
        <div className="sheet-head"
             onPointerDown={e => { start.current = { y: e.clientY, t: e.timeStamp, v: 0 }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
             onPointerMove={e => {
               const s = start.current; if (!s) return;
               const next = Math.max(0, e.clientY - s.y);
               s.v = (next - drag) / Math.max(1, e.timeStamp - s.t); s.t = e.timeStamp;
               setDrag(next);
             }}
             onPointerUp={() => { const s = start.current; if (drag > 110 || (s && s.v > 0.6 && drag > 30)) onClose(); start.current = null; setDrag(0); }}
             onPointerCancel={() => { start.current = null; setDrag(0); }}>
          <span className="grabber" />
          <div className="sheet-row">
            <div className="sheet-text">
              <h2 id={id} className="sheet-title">{shown.title}</h2>
              {shown.sub && <p className="t-body-s c-2">{shown.sub}</p>}
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={19} /></button>
          </div>
        </div>
        <div className="sheet-body">{shown.children}</div>
      </div>
    </div>
  );
}
