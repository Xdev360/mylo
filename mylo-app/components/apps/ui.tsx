'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { initial, tintFor } from '@/lib/apps';
import { goBack } from '@/components/NavMotion';

/* Small pieces the Apps screens share, drawn from the components page:
   avatars, the toggle, the pill tabs, the centred "moment" sheet (LX2, LX4,
   LX6), confetti, and the close/back header buttons. */

export function Avatar({ name, size = 40, me = false, tint }: { name: string; size?: number; me?: boolean; tint?: string }) {
  return (
    <span className={`ax-avatar${me ? ' is-me' : ''}`} aria-hidden
          style={{ width: size, height: size, fontSize: Math.round(size * 0.42), background: me ? undefined : tint ?? tintFor(name) }}>
      {me ? 'Y' : initial(name)}
    </span>
  );
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`ax-toggle${on ? ' is-on' : ''}`}
            onClick={() => onChange(!on)}><span /></button>
  );
}

export function Seg<T extends string>({ options, value, onChange, label }: { options: { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ax-seg" role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={value === o.id ? 'is-on' : ''}
                onClick={() => onChange(o.id)}>{o.label}</button>
      ))}
    </div>
  );
}

/* A sheet whose content sits in the middle: grabber, art, title, words,
   buttons. Same rise, dim layer, swipe and Escape as Sheet.tsx. */
export function MomentSheet({ open, onClose, labelId, children }: { open: boolean; onClose: () => void; labelId: string; children: React.ReactNode }) {
  const [drag, setDrag] = useState(0);
  const start = useRef<number | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={`sheet-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim ax-scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-labelledby={labelId} className="sheet ax-moment"
           style={drag ? { translate: `0 ${drag}px`, transition: 'none' } : undefined}
           onPointerDown={e => { if ((e.target as Element).closest('button,a,input')) return; start.current = e.clientY; }}
           onPointerMove={e => { if (start.current !== null) setDrag(Math.max(0, e.clientY - start.current)); }}
           onPointerUp={() => { if (drag > 110) onClose(); start.current = null; setDrag(0); }}
           onPointerCancel={() => { start.current = null; setDrag(0); }}>
        <span className="ax-grabber" />
        {children}
      </div>
    </div>
  );
}

/* Confetti as drawn on LX3 and G3: small rounded bars, scattered. */
export function Confetti({ pieces, className = '' }: { pieces: [number, number, string, number][]; className?: string }) {
  return (
    <div className={`ax-confetti ${className}`} aria-hidden>
      {pieces.map(([x, y, c, r], i) => (
        <span key={i} style={{ left: x, top: y, background: c, rotate: `${r}deg`, animationDelay: `${(i % 7) * 40}ms` }} />
      ))}
    </div>
  );
}

export function CloseBtn({ onClick, href, label = 'Close' }: { onClick?: () => void; href?: string; label?: string }) {
  const router = useRouter();
  return (
    <button type="button" className="back-btn" aria-label={label}
            onClick={onClick ?? (() => (window.history.length > 1 ? goBack(router) : router.push(href ?? '/apps')))}>
      <Icon name="close" size={18} />
    </button>
  );
}

export function BackBtn({ fallback = '/apps' }: { fallback?: string }) {
  const router = useRouter();
  return (
    <button type="button" className="back-btn" aria-label="Back"
            onClick={() => (window.history.length > 1 ? goBack(router) : router.push(fallback))}>
      <Icon name="chevron-right" size={20} className="flip" />
    </button>
  );
}

/* A pushed header with a title and an optional right action. */
export function Head({ title, right, fallback = '/apps', close = false }: { title?: string; right?: React.ReactNode; fallback?: string; close?: boolean }) {
  return (
    <header className="screen-header">
      {close ? <CloseBtn href={fallback} /> : <BackBtn fallback={fallback} />}
      {title && <h1 className="screen-header-title">{title}</h1>}
      <div className="screen-header-actions">{right}</div>
    </header>
  );
}

/* A tiny toast for "saved", "sent" and the like. */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (m: string) => { setMsg(m); if (t.current) clearTimeout(t.current); t.current = setTimeout(() => setMsg(null), 2200); };
  const node = <div className={`ax-toast${msg ? ' is-on' : ''}`} role="status" aria-live="polite">{msg}</div>;
  return [node, show] as const;
}
