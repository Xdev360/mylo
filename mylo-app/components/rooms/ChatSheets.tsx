'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import Bubble from './Bubble';
import { ArtIcon, Avatar, BareSheet, RIcon, StickerArt } from './ui';
import { CHEERS, ME, REACTIONS, STICKERS, caps, stamp, type CheerId, type Message, type ReactionKey, type Room, type StickerId } from '@/lib/rooms';

/* The layers over a chat: the long-press menu (CT12, CT13), the add menu,
   cheer cards (CT10), stickers (CT21), a new poll (CT23), delete (CT14),
   a photo before it goes (CT6), view once open (CT8) and the viewer (CT24). */

export type MenuAction = 'reply' | 'edit' | 'copy' | 'pin' | 'info' | 'delete' | 'cheer' | 'report' | 'more';

const EASE = 'cubic-bezier(.22,1,.36,1)';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Closing a layer: play its leaving motion, then hand over. Once only. */
function useLeave(parts: () => { el: Element | null; to: Keyframe[] }[], ms = 150) {
  const gone = useRef(false);
  return (then: () => void) => {
    if (gone.current) return;
    gone.current = true;
    if (reduced()) { then(); return; }
    const runs = parts().filter(p => p.el).map(p => p.el!.animate(p.to, { duration: ms, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' }).finished);
    Promise.all(runs).then(then, then);
  };
}

export function MessageMenu({ m, el, at, room, onClose, onReact, onAction }: {
  m: Message; el: HTMLElement; at?: { x: number; y: number }; room: Room; onClose: () => void;
  onReact: (k: ReactionKey) => void; onAction: (a: MenuAction) => void;
}) {
  const mine = m.authorId === ME;
  const stack = useRef<HTMLDivElement>(null);
  const veil = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; w: number; lift: number } | null>(null);
  useLayoutEffect(() => {
    const r = el.getBoundingClientRect();
    const h = stack.current?.offsetHeight ?? 400;
    const vh = window.innerHeight, vw = window.innerWidth;
    const want = r.top - (caps.react ? 66 : 0);
    const top = Math.max(16, Math.min(want, vh - h - 16));
    const lift = want - top;
    setPos(mine ? { top, right: Math.max(16, vw - r.right), w: r.width, lift } : { top, left: Math.max(16, r.left), w: r.width, lift });
  }, [el, mine]);
  /* The bubble lifts from where it sat (and moves up if the menu needs the
     room); the menu unfolds from the point you pressed. */
  useLayoutEffect(() => {
    const s = stack.current;
    if (!pos || !s || reduced()) return;
    s.getAnimations({ subtree: true }).forEach(a => a.cancel());
    const copy = s.querySelector<HTMLElement>('.r-menu-copy');
    const menu = s.querySelector<HTMLElement>('.r-menu');
    copy?.animate([{ transform: `translateY(${pos.lift}px)` }, { transform: `translateY(${pos.lift * 0.1}px) scale(1.03)`, offset: 0.55 }, { transform: 'none' }], { duration: 340, easing: EASE });
    if (menu) {
      const mr = menu.getBoundingClientRect();
      const ox = at ? at.x - mr.left : mine ? mr.width : 0;
      const oy = at ? at.y - mr.top + pos.lift : -12;
      menu.style.transformOrigin = `${Math.round(ox)}px ${Math.round(oy)}px`;
      menu.animate([{ opacity: 0, transform: 'scale(.3)' }, { opacity: 1, transform: 'none' }], { duration: 300, easing: 'cubic-bezier(.34,1.25,.64,1)' });
    }
    s.querySelector<HTMLElement>('.r-reactbar')?.animate([{ opacity: 0, transform: 'translateY(10px) scale(.9)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
  }, [pos, at, mine]);
  const leave = useLeave(() => [
    { el: veil.current, to: [{ opacity: 0 }] },
    { el: stack.current?.querySelector('.r-menu') ?? null, to: [{ opacity: 0, transform: 'scale(.6)' }] },
    { el: stack.current?.querySelector('.r-reactbar') ?? null, to: [{ opacity: 0, transform: 'translateY(8px)' }] },
    { el: stack.current?.querySelector('.r-menu-copy') ?? null, to: [{ transform: `translateY(${pos?.lift ?? 0}px)` }] }
  ]);
  const close = () => leave(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const items: { a: MenuAction; label: string; icon: string; danger?: boolean; art?: boolean }[] = mine ? [
    { a: 'reply', label: 'Reply', icon: 'reply' },
    ...(m.kind === 'text' ? [...(caps.edit ? [{ a: 'edit' as const, label: 'Edit', icon: 'pencil' }] : []), { a: 'copy' as const, label: 'Copy', icon: 'copy' }] : []),
    { a: 'pin', label: room.pinned.includes(m.id) ? 'Unpin' : 'Pin', icon: 'pin' },
    { a: 'info', label: 'Info', icon: 'eye' },
    { a: 'delete', label: 'Delete', icon: 'trash', danger: true, art: true }
  ] : [
    { a: 'reply', label: 'Reply', icon: 'reply' },
    { a: 'cheer', label: 'Cheer this', icon: 'party' },
    ...(m.kind === 'text' ? [{ a: 'copy' as const, label: 'Copy', icon: 'copy' }] : []),
    { a: 'pin', label: room.pinned.includes(m.id) ? 'Unpin' : 'Pin', icon: 'pin' },
    { a: 'report', label: 'Report', icon: 'flag', danger: true, art: true }
  ];

  return (
    <div className="r-menu-layer" role="dialog" aria-modal="true" aria-label="Message actions">
      <button ref={veil} type="button" className="r-menu-veil" aria-label="Close" onClick={close} />
      <div ref={stack} className={`r-menu-stack${mine ? ' is-mine' : ''}`}
           style={pos ? { top: pos.top, left: pos.left, right: pos.right } : { visibility: 'hidden' }}>
        {caps.react && (
          <div className="r-reactbar" role="group" aria-label="React">
            {REACTIONS.map(r => (
              <button key={r.key} type="button" aria-label={r.key} className={m.reactions?.[r.key]?.includes(ME) ? 'is-on' : ''} onClick={() => leave(() => onReact(r.key))}>
                {r.tint ? <RIcon name={r.icon} size={28} /> : <ArtIcon name={r.icon} size={28} />}
              </button>
            ))}
            <button type="button" aria-label="More reactions" onClick={() => leave(() => onAction('more'))}><RIcon name="plus-24" size={28} className="c-3" /></button>
          </div>
        )}
        <div className="r-menu-copy" style={{ width: pos?.w }}><Bubble m={m} room={room} still /></div>
        <div className="r-menu" role="menu">
          {items.map(i => (
            <button key={i.a} type="button" role="menuitem" className={i.danger ? 'is-danger' : ''}
                    onClick={() => (i.a === 'copy' ? (onAction(i.a)) : leave(() => onAction(i.a)))}>
              <span>{i.label}</span>
              {i.art ? <ArtIcon name={i.icon} size={22} /> : <RIcon name={i.icon} size={22} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* A small menu that opens from a button: the composer's +, a member's dots.
   It grows out of that button and folds back into it. */
export function PopMenu({ anchor, items, onClose, up = true }: {
  anchor: HTMLElement; up?: boolean; onClose: () => void;
  items: { label: string; icon?: string; danger?: boolean; onClick: () => void }[];
}) {
  const box = useRef<HTMLDivElement>(null);
  const [r] = useState(() => anchor.getBoundingClientRect());
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const left = Math.max(12, Math.min(r.left, vw - 252));
  const spot = up ? { left, bottom: window.innerHeight - r.top + 8 } : { left: Math.max(12, Math.min(left, r.right - 240)), top: r.bottom + 8 };
  useLayoutEffect(() => {
    const el = box.current; if (!el || reduced()) return;
    el.getAnimations().forEach(a => a.cancel());
    const b = el.getBoundingClientRect();
    el.style.transformOrigin = `${Math.round(r.left + r.width / 2 - b.left)}px ${up ? Math.round(b.height + 8 + r.height / 2) : -Math.round(8 + r.height / 2)}px`;
    el.animate([{ opacity: 0, transform: 'scale(.4)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: 'cubic-bezier(.34,1.2,.64,1)' });
  }, [r, up]);
  const leave = useLeave(() => [{ el: box.current, to: [{ opacity: 0, transform: 'scale(.5)' }] }], 140);
  const close = () => leave(onClose);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <div className="r-pop-layer">
      <button type="button" className="r-pop-veil" aria-label="Close" onClick={close} />
      <div ref={box} className="r-menu r-pop" role="menu" style={spot}>
        {items.map(i => (
          // The action runs at once (a photo picker needs the tap itself); the menu folds away after.
          <button key={i.label} type="button" role="menuitem" className={i.danger ? 'is-danger' : ''} onClick={() => { i.onClick(); close(); }}>
            <span>{i.label}</span>{i.icon && <RIcon name={i.icon} size={22} />}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheerSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (id: CheerId) => void }) {
  const [pick, setPick] = useState<CheerId>('proud');
  const c = CHEERS.find(x => x.id === pick)!;
  return (
    <BareSheet open={open} onClose={onClose} label="Send a cheer" className="r-cheersheet">
      <div className="r-bare-head">
        <h2 className="r-bare-title">Send a cheer</h2>
        <button type="button" className="round-btn r-close-btn" aria-label="Close" onClick={onClose}><RIcon name="close-np" size={20} /></button>
      </div>
      <p className="r-bare-sub">Pick a card. It lands big in the chat.</p>
      <div className="r-cheer-grid" role="radiogroup" aria-label="Cheer cards">
        {CHEERS.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={pick === x.id} className={`r-cheer-card${pick === x.id ? ' is-on' : ''}`}
                  style={{ '--from': x.from, '--to': x.to } as React.CSSProperties} onClick={() => setPick(x.id)}>
            <StickerArt id={x.sticker} cell={62} />
            <span>{x.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="r-btn-dark" onClick={() => onSend(pick)}>Send {c.label.replace(/!$/, '')}</button>
    </BareSheet>
  );
}

export function StickerSheet({ open, onClose, recent, onSticker, onCheer }: {
  open: boolean; onClose: () => void; recent: StickerId[]; onSticker: (id: StickerId) => void; onCheer: (id: CheerId) => void;
}) {
  const [tab, setTab] = useState<'Mylo' | 'Recent' | 'Cheers'>('Mylo');
  const list = tab === 'Recent' ? STICKERS.filter(s => recent.includes(s.id)).sort((a, b) => recent.indexOf(a.id) - recent.indexOf(b.id)) : STICKERS;
  return (
    <BareSheet open={open} onClose={onClose} label="Stickers" className="r-stickersheet">
      <div className="r-packs" role="tablist">
        {(['Mylo', 'Recent', 'Cheers'] as const).map(t => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className={`r-pack${tab === t ? ' is-on' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === 'Cheers' ? (
        <div className="r-cheer-grid is-small">
          {CHEERS.map(x => (
            <button key={x.id} type="button" className="r-cheer-card" style={{ '--from': x.from, '--to': x.to } as React.CSSProperties} onClick={() => onCheer(x.id)}>
              <StickerArt id={x.sticker} cell={62} /><span>{x.label}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="r-sticker-grid">
          {list.map(s => <button key={s.id} type="button" aria-label={s.label} onClick={() => onSticker(s.id)}><StickerArt id={s.id} cell={84} /></button>)}
        </div>
      )}
    </BareSheet>
  );
}

/* Pick a reaction from the full set of Mylo faces, the + in the bar. */
export function ReactionSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: StickerId) => void }) {
  return (
    <BareSheet open={open} onClose={onClose} label="Mylo stickers" className="r-stickersheet">
      <div className="r-sticker-grid">
        {STICKERS.map(s => <button key={s.id} type="button" aria-label={s.label} onClick={() => onPick(s.id)}><StickerArt id={s.id} cell={84} /></button>)}
      </div>
    </BareSheet>
  );
}

function closingTimes() {
  const now = new Date();
  const tonight = new Date(now); tonight.setHours(22, 0, 0, 0);
  const tomorrow = new Date(tonight); tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    ...(tonight > now ? [{ label: 'Tonight 22:00', at: tonight }] : []),
    { label: 'Tomorrow 22:00', at: tomorrow }
  ];
}

export function PollSheet({ open, onClose, onSend }: { open: boolean; onClose: () => void; onSend: (q: string, a: string, b: string, closes: Date) => void }) {
  const [q, setQ] = useState(''); const [a, setA] = useState(''); const [b, setB] = useState('');
  const [when, setWhen] = useState(0);
  const times = closingTimes();
  const t = times[Math.min(when, times.length - 1)];
  const ok = q.trim() && a.trim() && b.trim();
  function send() { if (!ok) return; onSend(q.trim(), a.trim(), b.trim(), t.at); setQ(''); setA(''); setB(''); setWhen(0); }
  return (
    <Sheet open={open} onClose={onClose} title="New poll" sub="Two options. Everyone votes." labelId="r-poll-title">
      <label className="r-field"><span className="r-field-label">Question</span>
        <input className="r-field-input" value={q} onChange={e => setQ(e.target.value)} placeholder="Saturday plan?" maxLength={120} /></label>
      <label className="r-field"><span className="r-field-label">Option A</span>
        <input className="r-field-input" value={a} onChange={e => setA(e.target.value)} placeholder="Long run, 7am" maxLength={60} /></label>
      <label className="r-field"><span className="r-field-label">Option B</span>
        <input className="r-field-input" value={b} onChange={e => setB(e.target.value)} placeholder="Rest + brunch" maxLength={60} /></label>
      <button type="button" className="r-listrow" onClick={() => setWhen(w => (w + 1) % times.length)}>
        <span className="r-icon-tile"><img src="/figma/rooms/poll-clock.svg" alt="" width={18} height={18} /></span>
        <span className="r-listrow-label">Closes</span>
        <span className="r-listrow-value">{t.label}</span>
      </button>
      <div className="r-two">
        <button type="button" className="r-btn-soft" onClick={onClose}>Cancel</button>
        <button type="button" className="btn-primary" onClick={send} aria-disabled={!ok}>Send poll</button>
      </div>
    </Sheet>
  );
}

export function DeleteSheet({ open, mine, onClose, onEveryone, onMe }: { open: boolean; mine: boolean; onClose: () => void; onEveryone: () => void; onMe: () => void }) {
  return (
    <BareSheet open={open} onClose={onClose} label="Delete message?">
      <div className="r-bare-body">
        <h2 className="r-bare-title">Delete message?</h2>
        <p className="r-bare-sub is-long">Delete for everyone removes it from the chat. People may have seen it already.</p>
        {mine && <button type="button" className="r-btn-red" onClick={onEveryone}>Delete for everyone</button>}
        <button type="button" className="r-btn-soft is-wide" onClick={onMe}>Delete for me</button>
        <button type="button" className="r-btn-text" onClick={onClose}>Cancel</button>
      </div>
    </BareSheet>
  );
}

/* CT6: the photo, full screen, before it goes. View once is on by default. */
export function PhotoDraft({ src, onClose, onSend }: { src: string; onClose: () => void; onSend: (once: boolean, caption: string) => void }) {
  const [once, setOnce] = useState(true);
  const [cap, setCap] = useState('');
  return (
    <div className="r-full r-draft" role="dialog" aria-modal="true" aria-label="Send a photo">
      <button type="button" className="r-full-close" aria-label="Close" onClick={onClose}><RIcon name="close-np" size={20} /></button>
      <img className="r-draft-img" src={src} alt="" />
      {once && <span className="r-chip-light r-draft-chip">View once is on. They can open it one time.</span>}
      <div className="r-draft-bar">
        <input value={cap} onChange={e => setCap(e.target.value)} placeholder="Add a caption..." aria-label="Add a caption"
               onKeyDown={e => { if (e.key === 'Enter') onSend(once, cap.trim()); }} />
        <button type="button" className={`r-draft-once${once ? ' is-on' : ''}`} aria-pressed={once} aria-label="View once" onClick={() => setOnce(o => !o)}><span>1</span></button>
        <button type="button" className="r-draft-send" aria-label="Send" onClick={() => onSend(once, cap.trim())}><RIcon name="send" size={22} /></button>
      </div>
    </div>
  );
}

/* CT8: a view once photo, open. It goes when you close it. */
export function OnceViewer({ m, onClose }: { m: Message; onClose: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const leave = useLeave(() => [{ el: root.current, to: [{ opacity: 0 }] }], 180);
  return (
    <div ref={root} className="r-full r-once-view" role="dialog" aria-modal="true" aria-label="View once photo">
      <header className="r-viewer-top">
        <Avatar name={m.authorName} size={40} ring />
        <span className="r-viewer-who"><span className="r-viewer-name">{m.authorName}</span><span className="r-viewer-sub">View once  ·  just now</span></span>
        <button type="button" className="r-viewer-btn" aria-label="Close" onClick={() => leave(onClose)}><RIcon name="close-np" size={20} /></button>
      </header>
      <img className="r-viewer-img r-once-img" src={m.photo!.src} alt="" />
    </div>
  );
}

/* Where a photo sits in its bubble, as a move from the full-screen picture:
   scaled and cropped to the thumbnail's box, with its rounded corners. */
function thumbFrames(img: HTMLImageElement, thumb: Element | null): [Keyframe, Keyframe] | null {
  if (!thumb || !(thumb as HTMLElement).isConnected) return null;
  const t = thumb.getBoundingClientRect(), e = img.getBoundingClientRect();
  if (!t.width || !e.width || t.bottom < 0 || t.top > window.innerHeight) return null;
  const nw = img.naturalWidth || t.width, nh = img.naturalHeight || t.height;
  const k = Math.min(e.width / nw, e.height / nh);
  const dw = nw * k, dh = nh * k;
  const s = Math.max(t.width / dw, t.height / dh);
  const dx = t.left + t.width / 2 - (e.left + e.width / 2), dy = t.top + t.height / 2 - (e.top + e.height / 2);
  const ix = Math.max(0, (e.width - t.width / s) / 2), iy = Math.max(0, (e.height - t.height / s) / 2);
  return [
    { transform: `translate(${dx}px, ${dy}px) scale(${s})`, clipPath: `inset(${iy}px ${ix}px round ${16 / s}px)` },
    { transform: 'none', clipPath: `inset(${(e.height - dh) / 2}px ${(e.width - dw) / 2}px round 0px)` }
  ];
}

/* CT24: a photo from the chat, with cheer and reply under it. It zooms out
   of its bubble and back into it; drag it down to close. */
export function ImageViewer({ m, from, onClose, onCheer, onReply }: { m: Message; from?: HTMLImageElement | null; onClose: () => void; onCheer: () => void; onReply: () => void }) {
  const d = new Date(m.at);
  const when = `${d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${stamp(m.at)}`;
  const img = useRef<HTMLImageElement>(null);
  const bg = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ y0: number; dy: number } | null>(null);
  const shut = useRef(false);
  const origin = useRef(from);
  const thumb = () => origin.current?.isConnected ? origin.current : document.querySelector(`#m-${CSS.escape(m.id)} .r-photo img`);

  useLayoutEffect(() => {
    const el = img.current, t = origin.current;
    if (!el || reduced()) return;
    if (t) t.style.visibility = 'hidden';
    const chrome = root.current ? [...root.current.querySelectorAll<HTMLElement>('.r-viewer-top, .r-viewer-actions')] : [];
    const run = () => {
      // Measured at rest (a second run in development must not measure the first one mid-flight).
      [el, bg.current, ...chrome].forEach(x => x?.getAnimations().forEach(a => a.cancel()));
      const f = thumbFrames(el, t ?? null);
      if (f) el.animate(f, { duration: 360, easing: EASE });
      else el.animate([{ opacity: 0, transform: 'scale(.92)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      bg.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: 'ease-out' });
      chrome.forEach(c => c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 240, delay: 120, easing: 'ease-out', fill: 'backwards' }));
    };
    if (el.complete && el.naturalWidth) run(); else el.addEventListener('load', run, { once: true });
    return () => { if (t) t.style.visibility = ''; };
  }, []);

  function close() {
    if (shut.current) return;
    shut.current = true;
    const el = img.current;
    const t = thumb();
    const done = () => { if (t instanceof HTMLElement) t.style.visibility = ''; onClose(); };
    if (!el || reduced()) { done(); return; }
    if (t instanceof HTMLElement) t.style.visibility = 'hidden';
    // Measured where it rests, not where the finger dragged it.
    const lift = el.style.transform || 'none';
    el.style.transform = '';
    const f = thumbFrames(el, t);
    const anim = f
      ? el.animate([{ ...f[1], transform: lift }, f[0]], { duration: 280, easing: EASE, fill: 'forwards' })
      : el.animate([{ opacity: 1, transform: lift }, { opacity: 0, transform: `${lift === 'none' ? '' : lift} scale(.9)` }], { duration: 200, easing: 'ease-in', fill: 'forwards' });
    bg.current?.animate([{ opacity: drag ? Number(getComputedStyle(bg.current).opacity) : 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out', fill: 'forwards' });
    root.current?.querySelectorAll<HTMLElement>('.r-viewer-top, .r-viewer-actions').forEach(c => c.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 140, fill: 'forwards' }));
    anim.finished.then(done, done);
  }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const dy = drag?.dy ?? 0;
  return (
    <div ref={root} className="r-full r-viewer" role="dialog" aria-modal="true" aria-label="Photo">
      <div ref={bg} className="r-viewer-bg" style={dy ? { opacity: Math.max(0.2, 1 - dy / 400) } : undefined} />
      <header className="r-viewer-top">
        <button type="button" className="r-viewer-btn" aria-label="Close" onClick={close}><img src="/figma/rooms/v-close.svg" alt="" width={19} height={19} /></button>
        <Avatar name={m.authorName} size={36} me={m.authorId === ME} ring />
        <span className="r-viewer-who"><span className="r-viewer-name">{m.authorId === ME ? 'You' : m.authorName}</span><span className="r-viewer-sub">{[when, m.photo?.caption].filter(Boolean).join(' · ')}</span></span>
        <a className="r-viewer-btn" aria-label="Download" href={m.photo!.src} download={`mylo-${m.id}.jpg`}><img src="/figma/rooms/v-download.svg" alt="" width={19} height={19} /></a>
      </header>
      <img ref={img} className="r-viewer-img" src={m.photo!.src} alt={m.photo?.caption || 'Photo'} draggable={false}
           style={dy ? { transform: `translateY(${dy}px) scale(${1 - Math.min(0.15, dy / 2000)})` } : undefined}
           onPointerDown={e => { if (e.button === 0) { e.currentTarget.setPointerCapture(e.pointerId); setDrag({ y0: e.clientY, dy: 0 }); } }}
           onPointerMove={e => { if (drag) setDrag({ ...drag, dy: Math.max(0, e.clientY - drag.y0) }); }}
           onPointerUp={() => { if (drag && drag.dy > 110) close(); else setDrag(null); }}
           onPointerCancel={() => setDrag(null)} />
      <div className="r-viewer-actions">
        <button type="button" className="r-viewer-action" onClick={onCheer}><img src="/figma/rooms/v-cheer.svg" alt="" width={18} height={18} />Cheer</button>
        <button type="button" className="r-viewer-action" onClick={onReply}><img src="/figma/rooms/v-reply.svg" alt="" width={18} height={18} />Reply</button>
      </div>
    </div>
  );
}
