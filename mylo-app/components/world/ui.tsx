'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Mylo from './Mylo';
import { useHydrated } from '@/lib/local';
import { useStampedTheme, type Look } from '@/lib/world';
import { goBack } from '@/components/NavMotion';

/* Pieces the world screens share: the pushed-screen header with a back or
   close button, a room scene with the person's own Mylo standing in it,
   the keys chip and the on/off switch. */

export const wi = (name: string) => `world/i/${name}`;

/* Waits for the device to be read before drawing anything saved, and keeps
   the stored app theme stamped. */
export function WorldPage({ className = '', children, label, tabs = false }: { className?: string; children: React.ReactNode; label?: string; tabs?: boolean }) {
  const ready = useHydrated();
  useStampedTheme();
  /* Most world screens are drawn without the tab bar; `tabs` keeps it. */
  return <main className={`screen on-desk w-screen${tabs ? '' : ' w-no-tabs no-tabs'} ${className}`} aria-label={label}>{ready ? children : null}</main>;
}

export function useBack(fallback: string) {
  const router = useRouter();
  return () => (window.history.length > 1 ? goBack(router) : router.push(fallback));
}

export function NavButton({ kind = 'back', onClick, href, label, className = '' }: { kind?: 'back' | 'close'; onClick?: () => void; href?: string; label?: string; className?: string }) {
  const router = useRouter();
  return (
    <button type="button" className={`back-btn w-nav ${className}`} aria-label={label ?? (kind === 'close' ? 'Close' : 'Back')}
            onClick={onClick ?? (() => href && router.push(href))}>
      <Icon name={wi(kind)} size={20} />
    </button>
  );
}

/* 56 high, the round button at the left, the title in the middle at 16/600. */
export function WorldHeader({ title, kind = 'back', fallback = '/apps', onNav, actions }: {
  title?: string; kind?: 'back' | 'close'; fallback?: string; onNav?: () => void; actions?: React.ReactNode;
}) {
  const back = useBack(fallback);
  return (
    <header className="screen-header w-header">
      <NavButton kind={kind} onClick={onNav ?? back} />
      {title && <h1 className="screen-header-title w-header-title">{title}</h1>}
      <div className="screen-header-actions">{actions}</div>
    </header>
  );
}

export function KeysChip({ keys, onClick }: { keys: number; onClick?: () => void }) {
  return (
    <button type="button" className="w-chip" onClick={onClick} aria-label={`${keys} ${keys === 1 ? 'key' : 'keys'}`}>
      <Icon name={wi('key')} size={20} /><span>{keys} {keys === 1 ? 'key' : 'keys'}</span>
    </button>
  );
}

/* A room drawn from Figma with its own Mylo taken out, and the person's Mylo
   put back where the frame had it: `at` is left/top/width as fractions of
   the scene. */
export function Scene({ art, look, at, flip = false, className = '', children, mirror = false, label }: {
  art: string; look?: Look; at?: [number, number, number]; flip?: boolean; mirror?: boolean; className?: string; children?: React.ReactNode; label?: string;
}) {
  return (
    <div className={`w-scene ${className}`} role={label ? 'img' : undefined} aria-label={label}>
      <img className={`w-scene-art${mirror ? ' is-mirror' : ''}`} src={`/figma/world/room/${art}.svg`} alt="" />
      {look && at && (
        <span className="w-scene-mylo" style={{ left: `${at[0] * 100}%`, top: `${at[1] * 100}%`, width: `${at[2] * 100}%` }}>
          <Mylo look={look} flip={flip} />
        </span>
      )}
      {children}
    </div>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`w-switch${on ? ' is-on' : ''}`} onClick={() => onChange(!on)}>
      <span />
    </button>
  );
}

/* The dark pill that confirms a save (MS5), gone after a moment. */
export function Toast({ text, show, onDone }: { text: string; show: boolean; onDone: () => void }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [show, onDone]);
  return (
    <div className={`w-toast${show ? ' is-on' : ''}`} role="status" aria-live="polite">
      {show && <><Icon name={wi('check')} size={20} />{text}</>}
    </div>
  );
}

/* A drop-down of choices under a chip, closed by a tap outside or Escape. */
export function Menu({ open, onClose, children, className = '' }: { open: boolean; onClose: () => void; children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('pointerdown', down);
    window.addEventListener('keydown', key);
    return () => { window.removeEventListener('pointerdown', down); window.removeEventListener('keydown', key); };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={`w-menu ${className}`} role="menu">{children}</div>;
}

/* A live clock for the widget and lock screen previews. */
export function useNow(every = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), every); return () => clearInterval(t); }, [every]);
  return now;
}
