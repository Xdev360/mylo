'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Sheet from '../Sheet';
import Bubble from './Bubble';
import { ArtIcon, Avatar, BareSheet, RIcon, StickerArt } from './ui';
import { CHEERS, ME, REACTIONS, STICKERS, stamp, type CheerId, type Message, type ReactionKey, type Room, type StickerId } from '@/lib/rooms';

/* The layers over a chat: the long-press menu (CT12, CT13), the add menu,
   cheer cards (CT10), stickers (CT21), a new poll (CT23), delete (CT14),
   a photo before it goes (CT6), view once open (CT8) and the viewer (CT24). */

export type MenuAction = 'reply' | 'edit' | 'copy' | 'pin' | 'info' | 'delete' | 'cheer' | 'report' | 'more';

export function MessageMenu({ m, el, room, onClose, onReact, onAction }: {
  m: Message; el: HTMLElement; room: Room; onClose: () => void;
  onReact: (k: ReactionKey) => void; onAction: (a: MenuAction) => void;
}) {
  const mine = m.authorId === ME;
  const stack = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left?: number; right?: number; w: number } | null>(null);
  useLayoutEffect(() => {
    const r = el.getBoundingClientRect();
    const h = stack.current?.offsetHeight ?? 400;
    const vh = window.innerHeight, vw = window.innerWidth;
    const top = Math.max(16, Math.min(r.top - 66, vh - h - 16));
    setPos(mine ? { top, right: Math.max(16, vw - r.right), w: r.width } : { top, left: Math.max(16, r.left), w: r.width });
  }, [el, mine]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items: { a: MenuAction; label: string; icon: string; danger?: boolean; art?: boolean }[] = mine ? [
    { a: 'reply', label: 'Reply', icon: 'reply' },
    ...(m.kind === 'text' ? [{ a: 'edit' as const, label: 'Edit', icon: 'pencil' }, { a: 'copy' as const, label: 'Copy', icon: 'copy' }] : []),
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
      <button type="button" className="r-menu-veil" aria-label="Close" onClick={onClose} />
      <div ref={stack} className={`r-menu-stack${mine ? ' is-mine' : ''}`}
           style={pos ? { top: pos.top, left: pos.left, right: pos.right } : { visibility: 'hidden' }}>
        <div className="r-reactbar" role="group" aria-label="React">
          {REACTIONS.map(r => (
            <button key={r.key} type="button" aria-label={r.key} className={m.reactions?.[r.key]?.includes(ME) ? 'is-on' : ''} onClick={() => onReact(r.key)}>
              {r.tint ? <RIcon name={r.icon} size={28} /> : <ArtIcon name={r.icon} size={28} />}
            </button>
          ))}
          <button type="button" aria-label="More reactions" onClick={() => onAction('more')}><RIcon name="plus-24" size={28} className="c-3" /></button>
        </div>
        <div className="r-menu-copy" style={{ width: pos?.w }}><Bubble m={m} room={room} still /></div>
        <div className="r-menu" role="menu">
          {items.map(i => (
            <button key={i.a} type="button" role="menuitem" className={i.danger ? 'is-danger' : ''} onClick={() => onAction(i.a)}>
              <span>{i.label}</span>
              {i.art ? <ArtIcon name={i.icon} size={22} /> : <RIcon name={i.icon} size={22} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* A small menu that opens from a button: the composer's +, a member's dots. */
export function PopMenu({ anchor, items, onClose, up = true }: {
  anchor: HTMLElement; up?: boolean; onClose: () => void;
  items: { label: string; icon?: string; danger?: boolean; onClick: () => void }[];
}) {
  const r = anchor.getBoundingClientRect();
  const vw = typeof window === 'undefined' ? 0 : window.innerWidth;
  const left = Math.max(12, Math.min(r.left, vw - 252));
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="r-pop-layer">
      <button type="button" className="r-pop-veil" aria-label="Close" onClick={onClose} />
      <div className="r-menu r-pop" role="menu"
           style={up ? { left, bottom: window.innerHeight - r.top + 8 } : { left: Math.min(left, r.right - 240), top: r.bottom + 8 }}>
        {items.map(i => (
          <button key={i.label} type="button" role="menuitem" className={i.danger ? 'is-danger' : ''} onClick={() => { onClose(); i.onClick(); }}>
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
  return (
    <div className="r-full r-once-view" role="dialog" aria-modal="true" aria-label="View once photo">
      <header className="r-viewer-top">
        <Avatar name={m.authorName} size={40} ring />
        <span className="r-viewer-who"><span className="r-viewer-name">{m.authorName}</span><span className="r-viewer-sub">View once  ·  just now</span></span>
        <button type="button" className="r-viewer-btn" aria-label="Close" onClick={onClose}><RIcon name="close-np" size={20} /></button>
      </header>
      <img className="r-viewer-img" src={m.photo!.src} alt="" />
    </div>
  );
}

/* CT24: a photo from the chat, with cheer and reply under it. */
export function ImageViewer({ m, onClose, onCheer, onReply }: { m: Message; onClose: () => void; onCheer: () => void; onReply: () => void }) {
  const d = new Date(m.at);
  const when = `${d.toDateString() === new Date().toDateString() ? 'Today' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${stamp(m.at)}`;
  return (
    <div className="r-full r-viewer" role="dialog" aria-modal="true" aria-label="Photo">
      <header className="r-viewer-top">
        <button type="button" className="r-viewer-btn" aria-label="Close" onClick={onClose}><img src="/figma/rooms/v-close.svg" alt="" width={19} height={19} /></button>
        <Avatar name={m.authorName} size={36} me={m.authorId === ME} ring />
        <span className="r-viewer-who"><span className="r-viewer-name">{m.authorId === ME ? 'You' : m.authorName}</span><span className="r-viewer-sub">{[when, m.photo?.caption].filter(Boolean).join(' · ')}</span></span>
        <a className="r-viewer-btn" aria-label="Download" href={m.photo!.src} download={`mylo-${m.id}.jpg`}><img src="/figma/rooms/v-download.svg" alt="" width={19} height={19} /></a>
      </header>
      <img className="r-viewer-img" src={m.photo!.src} alt={m.photo?.caption || 'Photo'} />
      <div className="r-viewer-actions">
        <button type="button" className="r-viewer-action" onClick={onCheer}><img src="/figma/rooms/v-cheer.svg" alt="" width={18} height={18} />Cheer</button>
        <button type="button" className="r-viewer-action" onClick={onReply}><img src="/figma/rooms/v-reply.svg" alt="" width={18} height={18} />Reply</button>
      </div>
    </div>
  );
}
