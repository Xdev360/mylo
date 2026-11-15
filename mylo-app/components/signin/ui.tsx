'use client';

import '@/styles/signin.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { canGoBack, goBack } from '@/components/NavMotion';

/* The pieces every sign-in and onboarding screen is made of.

   <Screen className?>…</Screen>           the phone column; hides the tab bar
                                           and sidebar while it is on screen
   <Art name w h className? style? />      Mylo and other art from Figma
   <BackButton fallback? close? />         40 round button, back or close
   <Foot note? onNote? noteHref?>CTA</Foot> CTA pinned low, the small grey line
   <Cta …>Continue</Cta>                   the 56 high black pill            */

export function Screen({ children, className = '', label }: { children?: React.ReactNode; className?: string; label?: string }) {
  return <main className={`si-root si ${className}`} aria-label={label}>{children}</main>;
}

export function Art({ name, w, h, className = '', style }: { name: string; w: number; h: number; className?: string; style?: React.CSSProperties }) {
  return <img className={`si-art ${className}`} src={`/figma/signin/${name}.svg`} alt="" width={w} height={h} style={style} draggable={false} />;
}

export function BackButton({ fallback = '/welcome', close = false, onClick }: { fallback?: string; close?: boolean; onClick?: () => void }) {
  const router = useRouter();
  const go = onClick ?? (() => (canGoBack() ? goBack(router) : router.push(fallback)));
  return (
    <button type="button" className="si-back" aria-label={close ? 'Close' : 'Back'} onClick={go}>
      {close ? <Icon name="close" size={20} /> : <Icon name="chevron-right" size={20} className="flip" />}
    </button>
  );
}

export function Cta({ children, onClick, disabled, busy, type = 'button', className = '', form }: {
  children: React.ReactNode; onClick?: () => void; disabled?: boolean; busy?: boolean; type?: 'button' | 'submit'; className?: string; form?: string;
}) {
  return (
    <button type={type} form={form} className={`btn-primary si-cta ${className}`} onClick={onClick}
            disabled={disabled || busy} aria-busy={busy || undefined}>
      {children}
    </button>
  );
}

export function Foot({ children, note, onNote, noteHref }: { children: React.ReactNode; note?: React.ReactNode; onNote?: () => void; noteHref?: string }) {
  return (
    <footer className={`si-foot${note ? '' : ' no-note'}`}>
      {children}
      {note && (noteHref
        ? <Link className="si-note" href={noteHref}>{note}</Link>
        : onNote ? <button type="button" className="si-note" onClick={onNote}>{note}</button>
          : <p className="si-note">{note}</p>)}
    </footer>
  );
}

/* A line under a form that says what went wrong, or what happened. */
export function Notice({ text, tone = 'error' }: { text: string; tone?: 'error' | 'info' }) {
  if (!text) return null;
  return <p className={`si-notice is-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{text}</p>;
}
