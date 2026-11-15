'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { haptic, useFlash } from '@/lib/system';

/* The settings building blocks every ST screen is made of.

   <Toggle on onChange label size?="s">       46 × 28 switch (44 × 26 with size="s", DT8)
   <SectionLabel>Account</SectionLabel>        13/600 grey label above a group
   <Group>…rows…</Group>                       grey rounded group, 20 corners
   <Row icon="system/mail" label="Email" sub? value? href? external? onClick?
        toggle?={{ on, onChange }} danger? chevron? />
       One row: icon box, words, then a value, a chevron or a toggle. With
       `href` it is a link (`external` opens a new tab), with `onClick` a
       button, with `toggle` the whole row flips the switch.
   <Segmented options value onChange label />  ST2's pill tabs; the highlight slides
   const toast = useToast(); toast.show('Saved'); {toast.node}
       The dark pill that says something happened; it also says what a
       screen that sent the person here left with flash().
   <Hero tone="amber" mylo="mylo-happy" badge="system/bell" size?="s" />
       Tinted disc with Mylo and a corner badge (primers, status, ST10). */

export function Toggle({ on, onChange, label, size }: { on: boolean; onChange: (v: boolean) => void; label: string; size?: 's' }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
            className={`sys-toggle${size === 's' ? ' is-s' : ''}`}
            onClick={e => { e.stopPropagation(); e.preventDefault(); haptic(); onChange(!on); }} />
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="sys-label">{children}</h2>;
}

export function Group({ children, label }: { children: React.ReactNode; label?: string }) {
  return <div className="sys-group" role="group" aria-label={label}>{children}</div>;
}

type RowProps = {
  icon?: string; label: string; sub?: string; value?: string;
  href?: string; external?: boolean; onClick?: () => void;
  toggle?: { on: boolean; onChange: (v: boolean) => void };
  danger?: boolean; chevron?: boolean; children?: React.ReactNode;
};
export function Row({ icon, label, sub, value, href, external, onClick, toggle, danger, chevron, children }: RowProps) {
  const showChev = chevron ?? (!value && !toggle && !danger && !children && (!!href || !!onClick));
  const cls = `sys-row${sub ? ' has-sub' : ''}${danger ? ' is-danger' : ''}`;
  const inner = (
    <>
      {icon && <span className="sys-row-icon"><Icon name={icon} size={24} /></span>}
      <span className="sys-row-text">
        <span className="sys-row-label">{label}</span>
        {sub && <span className="sys-row-sub">{sub}</span>}
      </span>
      {value && <span className="sys-row-value">{value}</span>}
      {toggle && <Toggle on={toggle.on} onChange={toggle.onChange} label={label} />}
      {showChev && <Icon name="system/chevron" size={22} className="sys-row-chev" />}
      {children}
    </>
  );
  if (href && external) return <a className={cls} href={href} target="_blank" rel="noreferrer">{inner}</a>;
  if (href) return <Link className={cls} href={href}>{inner}</Link>;
  if (onClick) return <button type="button" className={cls} onClick={onClick}>{inner}</button>;
  if (toggle) return <div className={cls} onClick={() => { haptic(); toggle.onChange(!toggle.on); }} style={{ cursor: 'pointer' }}>{inner}</div>;
  return <div className={cls}>{inner}</div>;
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string }) {
  const i = Math.max(0, options.indexOf(value));
  /* Arrow keys move the choice, as a radio group does. */
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + options.length) % options.length;
    onChange(options[next]);
    ((e.currentTarget as HTMLElement).children[next + 1] as HTMLElement | undefined)?.focus();
  };
  return (
    <div className="sys-seg" role="radiogroup" aria-label={label} onKeyDown={onKey}
         style={{ '--i': i, '--n': options.length } as React.CSSProperties}>
      <span className="sys-seg-pill" aria-hidden />
      {options.map(o => (
        <button key={o} type="button" role="radio" aria-checked={o === value} tabIndex={o === value ? 0 : -1}
                onClick={() => { if (o !== value) { haptic(); onChange(o); } }}>{o}</button>
      ))}
    </div>
  );
}

export function useToast() {
  const [msg, setMsg] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((m: string) => {
    setMsg(m); setOn(true);
    if (t.current) clearTimeout(t.current);
    t.current = setTimeout(() => setOn(false), 2400);
  }, []);
  useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
  useFlash(show);
  const node = (
    <div className={`sys-toast${on ? ' is-on' : ''}`} role="status" aria-live="polite">
      {msg && <><Icon name="system/check" size={20} />{msg}</>}
    </div>
  );
  return { show, node };
}

export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'grey';
export function Hero({ tone = 'grey', mylo, badge, size }: { tone?: Tone; mylo: string; badge?: string; size?: 's' }) {
  return (
    <div className={`sys-hero tone-${tone}${size === 's' ? ' is-s' : ''}`} aria-hidden>
      <img className="sys-hero-mylo" src={`/figma/system/${mylo}.svg`} alt="" />
      {badge && <span className="sys-hero-badge"><Icon name={badge} size={32} /></span>}
    </div>
  );
}
