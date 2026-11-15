'use client';

import { useEffect, useRef, useState } from 'react';
import Icon from './Icon';

/* Every bottom sheet, from the "SheetHeader" component (139:643): grabber,
   title, one-line purpose, close. Rises from the bottom over a dim layer on a
   phone, opens in the middle on a wide screen. Swipe down on the grabber, tap
   the dim layer, the close button or press Escape to close. */
export default function Sheet({ open, onClose, title, sub, children, labelId }: {
  open: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode; labelId?: string;
}) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  const id = labelId ?? `sheet-${title.replace(/\W+/g, '-').toLowerCase()}`;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={`sheet-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-labelledby={id} className="sheet"
           style={drag ? { translate: `0 ${drag}px`, transition: 'none' } : undefined}>
        <div className="sheet-head"
             onPointerDown={e => { start.current = e.clientY; (e.target as Element).setPointerCapture?.(e.pointerId); }}
             onPointerMove={e => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); }}
             onPointerUp={() => { if (drag > 110) onClose(); start.current = null; setDrag(0); }}>
          <span className="grabber" />
          <div className="sheet-row">
            <div className="sheet-text">
              <h2 id={id} className="sheet-title">{title}</h2>
              {sub && <p className="t-body-s c-2">{sub}</p>}
            </div>
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><Icon name="close" size={19} /></button>
          </div>
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </div>
  );
}
