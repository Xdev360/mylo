'use client';

import '@/styles/system.css';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { Hero, type Tone } from './ui';

/* PermissionPrimer, S3 and S5–S9: a whole screen that says why Mylo wants
   something before the browser's own prompt (S4 is that real prompt), and
   S9 when the person said no before.

   <PermissionPrimer
     kind="notifications" | "camera" | "microphone" | "photos" | "contacts"
     open={bool}
     onClose={() => …}                       "Not now", "Maybe later", back
     onResult?={r => …}                      { state: 'granted' | 'denied' | 'dismissed' | 'unsupported',
                                               files?: File[]  (photos), contacts?: Contact[] (contacts) }
   />

   What the main button really does: notifications → Notification.requestPermission;
   camera / microphone → getUserMedia (the stream is stopped at once);
   photos → the system photo picker (only the photos picked come back);
   contacts → the Contact Picker where the browser has it, else 'unsupported'
   (send people to /friends/add then). If the browser already says denied,
   S9 shows straight away. A web app cannot open the phone's Settings, so
   S9's "Open Settings" asks once more and keeps the steps on screen.

   `permissionState(kind)` resolves 'granted' | 'denied' | 'prompt' | 'unsupported'
   so a screen can skip the primer when it is already granted. */
export type PermissionKind = 'notifications' | 'camera' | 'microphone' | 'photos' | 'contacts';
export type Contact = { name?: string[]; tel?: string[] };
export type PermissionResult = { state: 'granted' | 'denied' | 'dismissed' | 'unsupported'; files?: File[]; contacts?: Contact[] };

type Copy = { tone: Tone; badge: string; title: string; body: string; points: [string, string][]; cta: string; thing: string; denied: string };
const COPY: Record<PermissionKind, Copy> = {
  notifications: {
    tone: 'amber', badge: 'system/bell', title: 'Let Mylo nudge you', body: 'Small reminders at the times you pick. Never more than you ask for.',
    points: [['system/time', 'Your goals, at your times'], ['system/chat', 'When friends cheer or reply'], ['system/swords', 'When it is your move']],
    cta: 'Turn on notifications', thing: 'Notifications', denied: 'You said no earlier. Turn it on in Settings.'
  },
  camera: {
    tone: 'green', badge: 'system/camera', title: 'Show the proof', body: 'Snap a photo when you finish a dare or a goal. Only your room sees it.',
    points: [['system/eye', 'You choose who sees each photo'], ['system/lock', 'View once photos disappear after opening']],
    cta: 'Allow camera', thing: 'Camera', denied: 'You said no earlier. Turn it on in Settings to post proof photos.'
  },
  microphone: {
    tone: 'red', badge: 'system/mic', title: 'Talk to Mylo', body: 'Send voice notes to friends, or tell Mylo your plan out loud.',
    points: [['system/headphones', 'Only records while you hold the button'], ['system/trash', 'Delete any voice note, any time']],
    cta: 'Allow microphone', thing: 'Microphone', denied: 'You said no earlier. Turn it on in Settings.'
  },
  photos: {
    tone: 'amber', badge: 'system/photo', title: 'Pick from your photos', body: 'Share a photo to Vibe or chat. Mylo only sees the ones you pick.',
    points: [['system/check', 'You pick, we never scan your library'], ['system/layers', 'Select a few, or allow all']],
    cta: 'Choose photos', thing: 'Photos', denied: 'You said no earlier. Turn it on in Settings.'
  },
  contacts: {
    tone: 'green', badge: 'system/user-plus', title: 'Find your people', body: 'See which friends are already on Mylo. We never message anyone for you.',
    points: [['system/lock', 'Numbers are matched privately'], ['system/ban', 'We never text your contacts']],
    cta: 'Find friends', thing: 'Contacts', denied: 'You said no earlier. Turn it on in Settings.'
  }
};

export async function permissionState(kind: PermissionKind): Promise<'granted' | 'denied' | 'prompt' | 'unsupported'> {
  if (typeof window === 'undefined') return 'unsupported';
  if (kind === 'notifications') {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission === 'default' ? 'prompt' : Notification.permission;
  }
  if (kind === 'photos') return 'prompt';
  if (kind === 'contacts') return 'contacts' in navigator ? 'prompt' : 'unsupported';
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  try {
    const s = await navigator.permissions.query({ name: kind as PermissionName });
    return s.state;
  } catch { return 'prompt'; }
}

export default function PermissionPrimer({ kind, open, onClose, onResult }: {
  kind: PermissionKind; open: boolean; onClose: () => void; onResult?: (r: PermissionResult) => void;
}) {
  const c = COPY[kind];
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    permissionState(kind).then(s => { if (live) setDenied(s === 'denied'); });
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { live = false; window.removeEventListener('keydown', onKey); };
  }, [open, kind, onClose]);

  const done = (r: PermissionResult) => { onResult?.(r); if (r.state !== 'denied') onClose(); };

  const ask = async () => {
    if (kind === 'photos') { file.current?.click(); return; }
    setBusy(true);
    try {
      if (kind === 'notifications') {
        if (!('Notification' in window)) return done({ state: 'unsupported' });
        const r = await Notification.requestPermission();
        if (r === 'granted') return done({ state: 'granted' });
        if (r === 'denied') { setDenied(true); return onResult?.({ state: 'denied' }); }
        return done({ state: 'dismissed' });
      }
      if (kind === 'contacts') {
        const picker = (navigator as unknown as { contacts?: { select: (p: string[], o: { multiple: boolean }) => Promise<Contact[]> } }).contacts;
        if (!picker) return done({ state: 'unsupported' });
        const contacts = await picker.select(['name', 'tel'], { multiple: true });
        return done({ state: contacts.length ? 'granted' : 'dismissed', contacts });
      }
      if (!navigator.mediaDevices?.getUserMedia) return done({ state: 'unsupported' });
      try {
        const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true });
        stream.getTracks().forEach(t => t.stop());
        done({ state: 'granted' });
      } catch (e) {
        if ((e as DOMException)?.name === 'NotAllowedError' || (e as DOMException)?.name === 'SecurityError') { setDenied(true); onResult?.({ state: 'denied' }); }
        else done({ state: 'unsupported' });
      }
    } catch { done({ state: 'dismissed' }); }
    finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="sys-cover" role="dialog" aria-modal="true" aria-label={denied ? `${c.thing} is off for Mylo` : c.title}>
      {denied ? (
        <div className="sys-cover-inner has-head">
          <header className="screen-header">
            <button type="button" className="back-btn" aria-label="Back" onClick={onClose}><Icon name="chevron-right" size={20} className="flip" /></button>
          </header>
          <div className="sys-state">
            <span className="sys-denied-icon" aria-hidden><Icon name={c.badge} size={44} /></span>
            <h1 className="sys-state-title is-tight">{c.thing} is off for Mylo</h1>
            <p className="sys-state-body">{c.denied}</p>
            <ol className="sys-steps">
              {['Open Settings', 'Scroll to Mylo', `Turn on ${c.thing}`].map((s, i) => (
                <li key={s} className="sys-step"><span className="sys-step-n">{i + 1}</span>{s}</li>
              ))}
            </ol>
          </div>
          <div className="sys-actions">
            <button type="button" className="sys-btn" onClick={ask} disabled={busy}><Icon name="system/settings" size={22} />Open Settings</button>
            <button type="button" className="sys-btn is-soft" onClick={() => { onResult?.({ state: 'dismissed' }); onClose(); }}>Maybe later</button>
          </div>
        </div>
      ) : (
        <div className="sys-cover-inner">
          <div className="sys-state">
            <Hero tone={c.tone} mylo="mylo-happy" badge={c.badge} />
            <h1 className="sys-state-title">{c.title}</h1>
            <p className="sys-state-body">{c.body}</p>
            <ul className="sys-points">
              {c.points.map(([icon, text]) => <li key={text} className="sys-point"><Icon name={icon} size={24} />{text}</li>)}
            </ul>
          </div>
          <div className="sys-actions">
            <button type="button" className="sys-btn" onClick={ask} disabled={busy} aria-busy={busy}>{c.cta}</button>
            <button type="button" className="sys-btn is-soft" onClick={() => done({ state: 'dismissed' })}>Not now</button>
          </div>
          {kind === 'photos' && (
            <input ref={file} type="file" accept="image/*" multiple hidden
                   onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; if (files.length) done({ state: 'granted', files }); }} />
          )}
        </div>
      )}
    </div>
  );
}
