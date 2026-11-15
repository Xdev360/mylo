'use client';

import '@/styles/system.css';
import { useEffect, useId, useRef } from 'react';

/* Confirm, the centred dialog of S23–S26 and ST9: title, one line, a main
   button and a way out, over a dim layer.

   <Confirm
     open={bool}
     title="Delete this goal?"
     body="Read 20 pages and its 12 day history will be gone. This cannot be undone."
     confirmLabel="Delete goal"          main button
     cancelLabel="Keep it"               second button (default "Cancel")
     tone="danger" | "primary"           red main button, or ink (default "danger")
     busy={bool}                         main button shows it is working
     onConfirm={() => …}                 may return a promise
     onCancel={() => …}                  also on Escape and a tap on the dim
   />

   Or spread a preset: <Confirm open {...CONFIRMS.leaveRoom('Tuff Gang')} onConfirm onCancel />. */

export const CONFIRMS = {
  /* S23 */
  deleteGoal: (goal: string, days?: number) => ({
    title: 'Delete this goal?',
    body: `${goal}${days ? ` and its ${days} day history` : ''} will be gone. This cannot be undone.`,
    confirmLabel: 'Delete goal', cancelLabel: 'Keep it', tone: 'danger' as const
  }),
  /* S24 */
  leaveRoom: (room: string) => ({
    title: `Leave ${room}?`,
    body: 'You will lose access to the chat and shared goals. Friends can invite you back.',
    confirmLabel: 'Leave room', cancelLabel: 'Stay', tone: 'danger' as const
  }),
  /* S25 */
  discardPost: () => ({
    title: 'Discard this post?', body: 'Your words will not be saved.',
    confirmLabel: 'Discard', cancelLabel: 'Keep editing', tone: 'danger' as const
  }),
  /* S26, ST9 */
  logOut: () => ({
    title: 'Log out of Mylo?', body: 'Your goals and rooms stay safe. Log in again any time.',
    confirmLabel: 'Log out', cancelLabel: 'Cancel', tone: 'primary' as const
  })
};

export default function Confirm({ open, title, body, confirmLabel, cancelLabel = 'Cancel', tone = 'danger', busy = false, onConfirm, onCancel }: {
  open: boolean; title: string; body?: string; confirmLabel: string; cancelLabel?: string;
  tone?: 'danger' | 'primary'; busy?: boolean; onConfirm: () => void | Promise<void>; onCancel: () => void;
}) {
  const id = useId();
  const cancel = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  useEffect(() => { onCancelRef.current = onCancel; }, [onCancel]);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancelRef.current(); };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); before?.focus?.(); };
  }, [open]);
  return (
    <div className={`sys-dialog-root${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      <button type="button" className="sys-dim" aria-label={cancelLabel} tabIndex={-1} onClick={onCancel} />
      <div className="sys-dialog" role="alertdialog" aria-modal="true" aria-labelledby={`${id}-t`} aria-describedby={body ? `${id}-b` : undefined}>
        <h2 id={`${id}-t`}>{title}</h2>
        {body && <p id={`${id}-b`}>{body}</p>}
        <div className="sys-dialog-actions">
          <button type="button" className={`sys-btn${tone === 'danger' ? ' is-danger' : ''}`} disabled={busy} aria-busy={busy}
                  onClick={() => { void onConfirm(); }}>{confirmLabel}</button>
          <button ref={cancel} type="button" className="sys-btn is-soft" onClick={onCancel}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  );
}
