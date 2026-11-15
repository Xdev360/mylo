'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { initial, solidFor, tintFor } from '@/lib/social';

/* An icon from this area's set, a mask that follows the text colour. */
export function SIcon({ name, size = 22, className = '' }: { name: string; size?: number; className?: string }) {
  return <Icon name={`social/${name}`} size={size} className={className} />;
}

/* The letter avatar the feed draws: a soft tint and the ink letter (VF1), or
   the room's solid colour and a white letter (RP1). `me` is the dark one. */
export function Avatar({ name, size = 36, me = false, solid = false, className = '' }: {
  name: string; size?: number; me?: boolean; solid?: boolean; className?: string;
}) {
  const style: React.CSSProperties = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  if (me && solid) { style.background = '#2B3150'; style.color = '#fff'; } // RP1: you, in the room's navy
  else if (me) { style.background = 'var(--primary)'; style.color = 'var(--on-primary)'; }
  else if (solid) { style.background = solidFor(name); style.color = '#fff'; }
  else { style.background = tintFor(name); style.color = 'var(--ink)'; }
  return <span className={`sx-avatar ${className}`} style={style} aria-hidden>{initial(name)}</span>;
}

/* VF10b's dark pill: a line, and an optional action. */
export function useToast() {
  const [t, setT] = useState<{ text: string; href?: string; action?: string; key: number } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((text: string, opts?: { href?: string; action?: string }) => {
    if (timer.current) clearTimeout(timer.current);
    setT({ text, ...opts, key: Date.now() });
    timer.current = setTimeout(() => setT(null), 3200);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const node = (
    <div className="sx-toast-wrap" aria-live="polite">
      {t && (
        <div key={t.key} className="sx-toast" role="status">
          <SIcon name="dl-icon" size={18} />
          <span>{t.text}</span>
          {t.href && <Link href={t.href} className="sx-toast-act">{t.action ?? 'View'}</Link>}
        </div>
      )}
    </div>
  );
  return [node, show] as const;
}

/* A bottom sheet with no title (VF13): the same layer, grabber and motion as
   the shared Sheet, for a plain list of actions. */
export function MenuSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={`sheet-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sheet sx-menu-sheet">
        <div className="sheet-head"><span className="grabber" /></div>
        <div className="sx-menu">{children}</div>
      </div>
    </div>
  );
}

/* One row of an action list: a 40 icon tile, the words, an optional line. */
export function ActionRow({ icon, label, sub, danger = false, chevron = false, onClick, href }: {
  icon: string; label: string; sub?: string; danger?: boolean; chevron?: boolean; onClick?: () => void; href?: string;
}) {
  const inner = (
    <>
      <span className="sx-row-tile"><SIcon name={icon} size={24} /></span>
      <span className="sx-row-main">
        <span className="sx-row-text">
          <span className={`sx-row-label${danger ? ' is-danger' : ''}`}>{label}</span>
          {sub && <span className="t-body-s c-2">{sub}</span>}
        </span>
        {chevron && <SIcon name="chevron" size={22} className="c-3" />}
      </span>
    </>
  );
  return href
    ? <Link href={href} className="sx-row" onClick={onClick}>{inner}</Link>
    : <button type="button" className="sx-row" onClick={onClick}>{inner}</button>;
}

/* The segmented control the feed and room screens share. */
export function Segment<T extends string>({ value, options, onChange, label, className = '' }: {
  value: T; options: readonly T[]; onChange: (v: T) => void; label: string; className?: string;
}) {
  return (
    <div className={`sx-seg ${className}`} role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o} type="button" role="tab" aria-selected={o === value} className="sx-seg-btn" onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}
