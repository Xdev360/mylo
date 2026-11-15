'use client';

import { useRef, useState } from 'react';
import { ArtIcon, Avatar, RIcon, StickerArt } from './ui';
import { ME, NAME_TONES, REACTIONS, cheer, stamp, sticker, tone, voiceClips, type Message, type ReactionKey, type Room } from '@/lib/rooms';

/* One message, every kind CT1 to CT15 draws: a text bubble (theirs on the
   left in grey, mine on the right in the chat colour), a sticker on its own,
   a cheer card, a poll card, a voice note, a photo or a view once photo, and
   the soft dashed pill a deleted message leaves. Reactions sit under it. */

export type Player = { id: string | null; t: number; speed: number; playing: boolean };
type Props = {
  m: Message; room: Room; quoted?: Message; desk?: boolean; still?: boolean; flash?: boolean;
  /* Just arrived: mine rises out of the composer, theirs slides in from the side. */
  enter?: 'mine' | 'theirs'; seen?: boolean;
  player?: Player; onPlay?: (m: Message) => void; onSpeed?: () => void;
  onHold?: (m: Message, el: HTMLElement, at?: { x: number; y: number }) => void; onPhoto?: (m: Message, img?: HTMLImageElement | null) => void;
  onVote?: (m: Message, i: number) => void; onReact?: (m: Message, k: ReactionKey) => void; onQuote?: (id: string) => void;
};

export const nameTone = (name: string) => tone(name, NAME_TONES);
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function Waveform({ bars, done = 0, count = 24, className = '' }: { bars: number[]; done?: number; count?: number; className?: string }) {
  const pick = Array.from({ length: count }, (_, i) => bars.length ? bars[Math.floor(i * bars.length / count)] ?? 0 : 0);
  return (
    <span className={`r-wave ${className}`} aria-hidden>
      {pick.map((v, i) => <span key={i} className={i / count < done ? 'is-done' : ''} style={{ height: `${Math.max(7, Math.round(6 + v * 22))}px` }} />)}
    </span>
  );
}

export default function Bubble({ m, room, quoted, desk, still, flash, enter, seen, player, onPlay, onSpeed, onHold, onPhoto, onVote, onReact, onQuote }: Props) {
  const mine = m.authorId === ME;
  const el = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const at = useRef<{ x: number; y: number } | null>(null);
  const pinned = room.pinned.includes(m.id);
  const [now] = useState(() => Date.now());
  // Decided once, when the bubble first draws: later renders never replay it.
  const [born] = useState(enter);

  const hold = still || m.deleted ? {} : {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      at.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => { if (el.current) { navigator.vibrate?.(10); onHold?.(m, el.current, at.current ?? undefined); } }, 450);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (at.current && Math.hypot(e.clientX - at.current.x, e.clientY - at.current.y) > 8 && timer.current) clearTimeout(timer.current);
    },
    onPointerUp: () => { if (timer.current) clearTimeout(timer.current); at.current = null; },
    onPointerCancel: () => { if (timer.current) clearTimeout(timer.current); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); if (timer.current) clearTimeout(timer.current); if (el.current) onHold?.(m, el.current, { x: e.clientX, y: e.clientY }); }
  };

  const meta = (
    <span className="r-meta">
      {pinned && <RIcon name="pin" size={12} />}
      {m.editedAt ? `Edited  ·  ${stamp(m.at)}` : stamp(m.at)}
      {m.pending ? <span className="r-clock" role="img" aria-label="Sending" /> : seen ? '  ·  Seen' : null}
    </span>
  );
  const quote = quoted && (
    <button type="button" className="r-quote" style={{ '--q': quoted.authorId === ME ? 'currentColor' : nameTone(quoted.authorName) } as React.CSSProperties}
            onClick={e => { e.stopPropagation(); onQuote?.(quoted.id); }}>
      <span className="r-quote-name">{quoted.authorId === ME ? 'You' : quoted.authorName}</span>
      <span className="r-quote-text">{quoted.deleted ? 'Deleted message' : quoted.text ?? (quoted.kind === 'sticker' ? `${sticker(quoted.sticker!).label} sticker` : quoted.kind === 'cheer' ? cheer(quoted.cheer!).label : quoted.kind === 'poll' ? quoted.poll!.question : quoted.kind === 'voice' ? 'Voice note' : 'Photo')}</span>
    </button>
  );

  let body: React.ReactNode;
  if (m.deleted) {
    body = (
      <div className="r-deleted">
        <RIcon name="ban" size={22} />
        <span>{mine ? 'You deleted this' : `${m.authorName} deleted this message`}</span>
      </div>
    );
  } else if (m.kind === 'text') {
    body = (
      <div className="r-bubble">
        {!mine && !desk && <span className="r-name" style={{ color: nameTone(m.authorName) }}>{m.authorName}</span>}
        {!mine && desk && <span className="r-name is-desk">{m.authorName}</span>}
        {quote}
        <span className="r-text">{m.text}</span>
        {meta}
      </div>
    );
  } else if (m.kind === 'sticker') {
    body = <div className="r-sticker-msg">{quote}<StickerArt id={m.sticker!} cell={108} /></div>;
  } else if (m.kind === 'cheer') {
    const c = cheer(m.cheer!);
    body = (
      <div className="r-cheer" style={{ '--from': c.from, '--to': c.to } as React.CSSProperties}>
        <StickerArt id={c.sticker} cell={112} />
        <span className="r-cheer-label">{c.label}</span>
        <span className="r-cheer-from">from {mine ? 'you' : m.authorName}</span>
      </div>
    );
  } else if (m.kind === 'poll') {
    const p = m.poll!;
    const total = p.options.reduce((n, o) => n + o.votes.length, 0);
    // Polls from the current app have no closing time: they stay open.
    const timed = Number.isFinite(Date.parse(p.closesAt));
    const closed = timed && Date.parse(p.closesAt) < now;
    const close = new Date(p.closesAt);
    const tonight = close.toDateString() === new Date().toDateString();
    body = (
      <div className="r-poll">
        <span className="r-poll-kind"><img src="/figma/rooms/icon-vote.svg" alt="" width={16} height={16} />Poll</span>
        <span className="r-poll-q">{p.question}</span>
        {p.options.map((o, i) => {
          const pct = total ? Math.round(o.votes.length * 100 / total) : 0;
          const me = o.votes.includes(ME);
          return (
            <button key={i} type="button" className={`r-poll-opt${me ? ' is-mine' : ''}`} disabled={closed || still || m.pending}
                    aria-pressed={me} onClick={() => onVote?.(m, i)}>
              <span className="r-poll-fill" style={{ width: `${pct}%` }} />
              <span className="r-poll-label">{o.label}</span>
              <span className="r-poll-pct">{pct}%</span>
            </button>
          );
        })}
        <span className="r-poll-foot">{total} {total === 1 ? 'vote' : 'votes'}{timed && `  ·  ${closed ? 'closed' : tonight ? 'closes tonight' : `closes ${close.toLocaleDateString('en-GB', { weekday: 'long' })}`}`}</span>
      </div>
    );
  } else if (m.kind === 'voice') {
    const v = m.voice!;
    const on = player?.id === m.id;
    const has = !!voiceClips.get(v.clip);
    const t = on ? player!.t : 0;
    body = (
      <div className={`r-voice${on ? ' is-on' : ''}`}>
        <button type="button" className="r-voice-play" aria-label={on && player!.playing ? 'Pause' : 'Play'} disabled={!has || still}
                onClick={() => onPlay?.(m)}>
          <RIcon name={on && player!.playing ? 'pause' : 'play'} size={20} />
        </button>
        <Waveform bars={v.bars} done={on ? t / v.seconds : 0} />
        <span className="r-voice-time">{fmt(on ? t : v.seconds)}</span>
        {on && <button type="button" className="r-voice-speed" onClick={onSpeed}>{player!.speed}x</button>}
      </div>
    );
  } else {
    const ph = m.photo!;
    if (ph.once) {
      // Mine: opened once anyone has. Theirs: once I have.
      const opened = mine ? ph.openedBy.length > 0 : ph.openedBy.includes(ME);
      body = mine ? (
        <div className={`r-once is-mine${opened ? ' is-opened' : ''}`}>
          <span className="r-once-ring">1</span>
          <span className="r-once-text"><span>{opened ? 'Opened' : 'Delivered'}</span><span className="r-once-sub">View once</span></span>
        </div>
      ) : (
        <button type="button" className={`r-once${opened ? ' is-opened' : ' is-new'}`} disabled={opened || still} onClick={() => onPhoto?.(m, null)}>
          <span className="r-once-ring">1</span>
          <span className="r-once-text"><span>{opened ? 'Opened' : 'Photo'}</span><span className="r-once-sub">{opened ? 'View once' : 'Tap to view once'}</span></span>
        </button>
      );
    } else {
      body = (
        <button type="button" className="r-photo" onClick={e => onPhoto?.(m, e.currentTarget.querySelector('img'))} disabled={still || m.pending}>
          {quote}
          <img src={ph.src} alt={ph.caption || 'Photo'} />
          {ph.caption && <span className="r-photo-cap">{ph.caption}</span>}
          {meta}
        </button>
      );
    }
  }

  const reactions = Object.entries(m.reactions ?? {}).filter(([, who]) => who && who.length) as [ReactionKey, string[]][];
  const bare = m.kind !== 'text' && !m.deleted;
  return (
    <div id={still ? undefined : `m-${m.id}`} className={`r-msg${mine ? ' is-mine' : ''}${desk ? ' is-desk' : ''}${flash ? ' is-flash' : ''}${born ? ` is-in-${born}` : ''}${m.pending ? ' is-pending' : ''}`}
         style={{ '--mine': room.colour, '--mine-ink': room.colour === 'var(--primary)' ? 'var(--on-primary)' : '#fff' } as React.CSSProperties}>
      {desk && !mine && <Avatar name={m.authorName} size={28} />}
      <div className="r-msg-col">
        <div ref={el} className="r-hold" {...hold}>{body}</div>
        {reactions.length > 0 && (
          <div className="r-reacts">
            {reactions.map(([k, who]) => {
              const r = REACTIONS.find(x => x.key === k);
              return (
                <button key={k} type="button" className={`r-react${who.includes(ME) ? ' is-mine' : ''}`} onClick={() => onReact?.(m, k)} disabled={still}
                        aria-label={`${who.length} ${k.startsWith('sticker:') ? sticker(k.slice(8)).label : k}`}>
                  {r ? (r.tint ? <RIcon name={r.icon} size={18} /> : <ArtIcon name={r.icon} size={18} />)
                     : <img src={`/figma/rooms/sticker-${k.slice(8)}.svg`} alt="" width={18} height={18} />}
                  <span>{who.length}</span>
                </button>
              );
            })}
          </div>
        )}
        {bare && !mine && !desk && <span className="r-author">{m.authorName}</span>}
        {bare && m.kind !== 'poll' && m.kind !== 'photo' && mine && pinned && <span className="r-author"><RIcon name="pin" size={12} /></span>}
      </div>
    </div>
  );
}

