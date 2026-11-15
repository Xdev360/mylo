'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/Icon';
import { useFlash } from '@/lib/system';

/* Small pieces the profile screens share. */

/* The profile photo. With no photo: the person icon, as P3 draws it, or the
   initial on navy where the desktop and badge frames draw that. */
export function Avatar({ photo, name, size, mode = 'icon', mylo = false, className = '' }: {
  photo: string | null; name: string; size: number; mode?: 'icon' | 'initial'; mylo?: boolean; className?: string;
}) {
  const initial = (name.trim()[0] ?? '').toUpperCase();
  return (
    <span className={`pf-avatar ${photo ? 'has-photo' : mylo ? 'is-mylo' : mode === 'initial' && initial ? 'is-initial' : 'is-empty'} ${className}`}
          style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}>
      {photo
        ? <img src={photo} alt="" />
        : mylo ? <img src="/figma/profile/mylo-plain.svg" alt="" className="pf-avatar-mylo" />
        : mode === 'initial' && initial ? initial : <Icon name="profile/user" size={Math.round(size * 0.42)} />}
    </span>
  );
}

/* The verified seal, in any of the badge colours. */
export function Seal({ size = 22, colour = '#3E7BFA', label }: { size?: number; colour?: string; label?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 22 22" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: 'none' }}>
      <path d="M11 0l2.888 2.108 3.575-.009 1.1 3.401 2.896 2.099L20.35 11l1.109 3.401-2.896 2.099-1.1 3.4-3.575-.008L11 22l-2.888-2.108-3.575.009-1.1-3.401L.541 14.401 1.65 11 .541 7.599 3.437 5.5l1.1-3.401 3.575.009L11 0z"
            fill={colour} stroke={colour} strokeWidth={1.47} strokeLinejoin="round" />
      <path d="M6.967 11.275l2.75 2.658 5.316-5.5" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* The dark pill that says something happened (P19). The words stay while
   it slides away. It also says what a screen that sent the person here left
   with flash() ("Profile saved" after Edit profile). */
export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m); setOn(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setOn(false), 2600);
  }, []);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  useFlash(show);
  const node = (
    <div className={`pf-toast${on ? ' is-on' : ''}`} role="status" aria-live="polite">
      {msg && <><Icon name="check" size={20} />{msg}</>}
    </div>
  );
  return { show, node };
}

/* Tabs whose highlight slides to the picked one (P1, P4, P22), and the
   panel under them that slides in from the side of the tab picked. */
export function Tabs<T extends string>({ tabs, value, onChange, label, className = '' }: {
  tabs: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void; label: string; className?: string;
}) {
  const i = Math.max(0, tabs.findIndex(t => t.id === value));
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const n = (i + d + tabs.length) % tabs.length;
    onChange(tabs[n].id);
    ((e.currentTarget as HTMLElement).children[n + 1] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className={`pf-tabs ${className}`} role="tablist" aria-label={label} onKeyDown={onKey}
         style={{ '--i': i, '--n': tabs.length } as React.CSSProperties}>
      <span className="pf-tabs-pill" aria-hidden />
      {tabs.map(t => (
        <button key={t.id} type="button" role="tab" aria-selected={t.id === value} tabIndex={t.id === value ? 0 : -1} className="pf-tab"
                onClick={() => onChange(t.id)}>{t.label}</button>
      ))}
    </div>
  );
}
/* Which way the panel should come in: from the right going to a later tab. */
export function useTabMotion<T extends string>(order: readonly T[], initial: T) {
  const [state, setState] = useState<{ tab: T; dir: 'fwd' | 'back' | null }>({ tab: initial, dir: null });
  const set = useCallback((next: T) => setState(s => (s.tab === next ? s
    : { tab: next, dir: order.indexOf(next) > order.indexOf(s.tab) ? 'fwd' : 'back' })), [order]);
  return [state.tab, set, state.dir ? `pf-pane is-${state.dir}` : 'pf-pane'] as const;
}

/* A bottom sheet without the title row, for P27's centred layout. Same
   motion and dismissal as components/Sheet. */
export function BareSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div className={`sheet-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="scrim" aria-label="Close" onClick={onClose} tabIndex={-1} />
      <div role="dialog" aria-modal="true" aria-label={label} className="sheet">
        <div className="sheet-head"><span className="grabber pf-grabber" /></div>
        {children}
      </div>
    </div>
  );
}

/* A row in a sheet list: icon tile, words, chevron (P25, P6). */
export function SheetRow({ icon, label, sub, danger, chevron = true, onClick, href }: {
  icon: string; label: string; sub?: string; danger?: boolean; chevron?: boolean; onClick?: () => void; href?: string;
}) {
  const inner = <>
    <span className="pf-row-icon"><Icon name={icon} size={20} /></span>
    <span className="pf-row-text"><span className={`t-body${danger ? ' pf-danger' : ''}`}>{label}</span>{sub && <span className="t-caption c-2">{sub}</span>}</span>
    {chevron && <Icon name="chevron-right" size={20} className="c-3" />}
  </>;
  return href
    ? <Link className="pf-row" href={href}>{inner}</Link>
    : <button type="button" className="pf-row" onClick={onClick}>{inner}</button>;
}

/* Copy text, with a fallback for browsers without the async clipboard. */
export async function copyText(s: string) {
  try { await navigator.clipboard.writeText(s); return true; } catch {
    try {
      const ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
    } catch { return false; }
  }
}
