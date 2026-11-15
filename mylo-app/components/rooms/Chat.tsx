'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import Bubble, { type Player } from './Bubble';
import Composer from './Composer';
import { CheerSheet, DeleteSheet, ImageViewer, MessageMenu, OnceViewer, PhotoDraft, PollSheet, PopMenu, ReactionSheet, StickerSheet, type MenuAction } from './ChatSheets';
import { Gate, RIcon, RoomBadge, RoomTile, StickerArt, morphBack, useToast } from './ui';
import Skeleton from '../system/Skeleton';
import StatusScreen from '../system/StatusScreen';
import { ME, canDeleteForAll, dayLabel, errText, msgs, people, shrinkPhoto, useRoom, useRooms, voiceClips, wallpaper, type Message } from '@/lib/rooms';
import { canGoBack, goBack } from '@/components/NavMotion';

/* CT1 · Room chat, with everything that happens in it (CT2 to CT17, CT21,
   CT23, CT24). On a phone it is the whole screen; in DT5 it is the middle
   column, same messages and the same controls, drawn the desktop way.

   It should feel continuous: what you send rises out of the composer and
   what arrives slides in from the side; the thread stays on the newest
   message unless you scrolled up to read, and then a pill counts what came
   in meanwhile. The screen is as tall as what the keyboard leaves. */

type Entry = { id: string; key: string; pending?: boolean; mine: boolean; kind: string; text?: string };
type Track = { room: string; ready: boolean; sig: string; list: Entry[]; born: Record<string, 'mine' | 'theirs'> };

/* A key per message that survives the server answering: what I send shows at
   once under a temporary id and is swapped for the real row a moment later,
   and that swap must not redraw (or re-animate) the bubble. It also notes
   which messages landed at the bottom while the room was open, and whose
   they are, so those bubbles come in moving. */
function step(prev: Track | null, messages: Message[], room: string, ready: boolean): Track {
  const p = prev?.room === room ? prev : null;
  const byId = new Map(p?.list.map(x => [x.id, x.key]));
  const gone = p?.list.filter(x => x.pending && x.mine && !messages.some(m => m.id === x.id)) ?? [];
  const used = new Set<string>();
  const list = messages.map(m => {
    let key = byId.get(m.id);
    if (!key && m.authorId === ME && !m.pending) {
      const g = gone.find(x => !used.has(x.key) && x.kind === m.kind && (m.kind !== 'text' || x.text === m.text));
      if (g) key = g.key;
    }
    key ??= m.id;
    used.add(key);
    return { id: m.id, key, pending: m.pending, mine: m.authorId === ME, kind: m.kind, text: m.text };
  });
  const born = { ...(p?.born ?? {}) };
  if (p?.ready) {
    const had = new Set(p.list.map(x => x.key));
    const last = p.list.length ? list.findIndex(x => x.key === p.list[p.list.length - 1].key) : -1;
    // Only what lands after the newest one I had: older pages load on top quietly.
    if (!p.list.length || last >= 0) list.forEach((x, i) => { if (i > last && !had.has(x.key)) born[x.key] = x.mine ? 'mine' : 'theirs'; });
  }
  return { room, ready, sig: sigOf(messages), list, born };
}
const sigOf = (list: Message[]) => list.map(m => m.pending ? `${m.id}*` : m.id).join(',');
function useThread(messages: Message[], room: string, ready: boolean) {
  const [track, setTrack] = useState<Track>(() => step(null, messages, room, ready));
  let now = track;
  if (track.sig !== sigOf(messages) || track.room !== room || track.ready !== ready) {
    now = step(track, messages, room, ready);
    setTrack(now);
  }
  return { keys: now.list.map(x => x.key), born: now.born };
}

const still = () => typeof window !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Chat({ id, desk = false }: { id: string; desk?: boolean }) {
  const router = useRouter();
  const { ready, signedOut, error, retry, room, messages, all, status, retryRoom, more, loadingOlder, loadOlder } = useRoom(id);
  const { recent } = useRooms();
  const [toast, say] = useToast();
  const [reply, setReply] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ m: Message; el: HTMLElement; at?: { x: number; y: number } } | null>(null);
  const [sheet, setSheet] = useState<null | 'cheer' | 'sticker' | 'poll' | 'delete' | 'react'>(null);
  const [target, setTarget] = useState<Message | null>(null);
  const [add, setAdd] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [viewer, setViewer] = useState<{ m: Message; from: HTMLImageElement | null } | null>(null);
  const [once, setOnce] = useState<Message | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player>({ id: null, t: 0, speed: 1, playing: false });
  const audio = useRef<HTMLAudioElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const main = useRef<HTMLElement>(null);
  const shown = ready && !!room && !room.peek;
  const inner = useRef<HTMLDivElement>(null);
  const { keys, born } = useThread(messages, id, ready && status === 'ready');
  const lastKey = keys[keys.length - 1];
  const firstId = messages[0]?.id;
  const keep = useRef<number | null>(null);
  const settled = useRef<string | null>(null);
  /* Where the newest bubble sat at the last draw, to slide the thread up from there. */
  const anchor = useRef<{ key: string; top: number } | null>(null);
  const atBottom = useRef(true);
  const lastTop = useRef(0);
  /* Read further up: where I left the bottom, and whether I am far enough up
     for the way-down pill. What arrived after that point is the count on it. */
  const [left, setLeft] = useState<string | null>(null);
  const [away, setAway] = useState(false);

  useEffect(() => { if (ready && !room) router.replace('/chats'); else if (ready && room?.peek) router.replace(`/rooms/${room.id}/preview`); }, [ready, room, router]);
  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    // The first full page landing under the few the list already had: stay at the bottom.
    el.scrollTop = keep.current === null ? el.scrollHeight : el.scrollHeight - keep.current;
    keep.current = null;
  }, [firstId]);
  /* Something new at the bottom. Mine, or I am already at the bottom: follow
     it, and slide the thread up from where it was so nothing jumps. Theirs
     while I read further up: leave me there and count it on the pill. */
  useLayoutEffect(() => {
    const el = scroller.current, box = inner.current;
    if (!el || !box || !lastKey) return;
    const before = anchor.current;
    const was = el.scrollTop;
    if (settled.current !== id) { settled.current = id; el.scrollTop = el.scrollHeight; return; }
    if (!before || before.key === lastKey) return;
    const last = messages[messages.length - 1];
    if (last?.authorId !== ME && !atBottom.current) return;
    el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    const node = box.querySelector<HTMLElement>(`[data-k="${CSS.escape(before.key)}"]`);
    if (!node || still()) return;
    const shift = (before.top - was) - (node.offsetTop - el.scrollTop);
    if (shift > 0 && shift < el.clientHeight) box.animate([{ transform: `translateY(${shift}px)` }, { transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.22,1,.36,1)' });
  }, [lastKey, id, messages]);
  // Remember where the newest bubble is, for the next arrival.
  useLayoutEffect(() => {
    const node = lastKey ? inner.current?.querySelector<HTMLElement>(`[data-k="${CSS.escape(lastKey)}"]`) : null;
    anchor.current = node && lastKey ? { key: lastKey, top: node.offsetTop } : null;
  });
  /* Pictures loading, the composer growing, the keyboard opening: if I was at
     the bottom, I stay there. */
  useEffect(() => {
    const el = scroller.current, box = inner.current;
    if (!el || !box || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
      const node = anchor.current ? box.querySelector<HTMLElement>(`[data-k="${CSS.escape(anchor.current.key)}"]`) : null;
      if (node && anchor.current) anchor.current.top = node.offsetTop;
    });
    ro.observe(el); ro.observe(box);
    return () => ro.disconnect();
  }, [shown]);
  /* As tall as the screen the keyboard leaves, so the composer always sits
     on top of it (phones only; a pinch-zoom is left alone). */
  useEffect(() => {
    const vv = window.visualViewport, el = main.current;
    if (desk || !vv || !el) return;
    const fit = () => {
      if (Math.abs(vv.scale - 1) > 0.01) return;
      const short = window.innerHeight - vv.height > 80;
      el.style.height = short ? `${Math.round(vv.height)}px` : '';
      if (short && window.scrollY) window.scrollTo(0, 0);
    };
    fit();
    vv.addEventListener('resize', fit); vv.addEventListener('scroll', fit);
    return () => { vv.removeEventListener('resize', fit); vv.removeEventListener('scroll', fit); el.style.height = ''; };
  }, [desk, shown]);
  // How far I have read, for everyone else's "Seen by".
  useEffect(() => { if (lastKey && !document.hidden && room && !room.peek) msgs.markRead(room.id); }, [lastKey, room]);
  // From "Pinned messages" in settings: open on the message and light it up.
  useEffect(() => {
    if (!ready) return;
    const h = window.location.hash.slice(1);
    if (!h.startsWith('m-')) return;
    const t = setTimeout(() => { document.getElementById(h)?.scrollIntoView({ block: 'center' }); setFlash(h.slice(2)); }, 120);
    const u = setTimeout(() => setFlash(null), 1800);
    return () => { clearTimeout(t); clearTimeout(u); };
  }, [ready, id]);
  useEffect(() => () => { audio.current?.pause(); }, []);

  const byId = useMemo(() => new Map(all.map(m => [m.id, m])), [all]);
  if (!ready || !room || room.peek) {
    if (signedOut || error) return <Gate signedOut={signedOut} error={error} retry={retry} className={desk ? 'r-chat is-desk' : 'screen'} />;
    return <main className={desk ? 'r-chat is-desk' : 'r-chat'} aria-busy="true" />;
  }
  const quoteOf = (m: Message): Message | undefined => {
    if (!m.replyTo) return undefined;
    const q = byId.get(m.replyTo);
    if (q) return q;
    return m.quote ? { id: m.quote.id, roomId: room.id, authorId: m.quote.authorId, authorName: room.members.find(x => x.id === m.quote!.authorId)?.name ?? '', at: m.at, kind: 'text', text: m.quote.text } : undefined;
  };
  const oops = (e: unknown) => say(errText(e));
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    /* Only my own scrolling up lets go of the bottom: a picture loading above
       (which moves the bottom away without anyone scrolling) does not. */
    if (gap < 60) atBottom.current = true;
    else if (el.scrollTop < lastTop.current - 1) atBottom.current = false;
    lastTop.current = el.scrollTop;
    if (atBottom.current ? left !== null : left === null) setLeft(atBottom.current ? null : lastKey ?? null);
    if ((gap > el.clientHeight) !== away) setAway(!away);
    if (el.scrollTop < 120 && more && !loadingOlder && status === 'ready') { keep.current = el.scrollHeight; loadOlder(); }
  };
  const toBottom = () => {
    const el = scroller.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: still() ? 'auto' : 'smooth' });
  };
  const from = left ? keys.indexOf(left) : -1;
  const unseen = from < 0 ? 0 : messages.slice(from + 1).filter(m => m.authorId !== ME).length;
  const lastMine = [...messages].reverse().find(m => m.authorId === ME && !m.deleted);
  const seenId = lastMine?.seenBy?.length && room.readReceipts ? lastMine.id : null;

  const replying = reply ? byId.get(reply) : undefined;
  const editMsg = editing ? byId.get(editing) : undefined;
  const wp = wallpaper(room.wallpaper);
  const playingMsg = player.id ? byId.get(player.id) : undefined;
  const others = room.members.filter(m => m.id !== ME).map(m => m.name);
  const deskSub = others.length ? `${others.slice(0, 3).join(', ')}${others.length > 3 ? ` and ${others.length - 3} more` : ''} and you` : 'Only you';

  function play(m: Message) {
    const url = voiceClips.get(m.voice!.clip); if (!url) return;
    if (!audio.current) {
      const a = new Audio();
      a.ontimeupdate = () => setPlayer(p => ({ ...p, t: a.currentTime }));
      a.onplay = () => setPlayer(p => ({ ...p, playing: true }));
      a.onpause = () => setPlayer(p => ({ ...p, playing: false }));
      a.onended = () => setPlayer(p => ({ ...p, id: null, t: 0, playing: false }));
      audio.current = a;
    }
    const a = audio.current;
    if (player.id === m.id) { if (a.paused) a.play(); else a.pause(); return; }
    a.src = url; a.playbackRate = player.speed; a.play();
    setPlayer(p => ({ ...p, id: m.id, t: 0 }));
  }
  function speed() {
    const s = player.speed === 1 ? 1.5 : player.speed === 1.5 ? 2 : 1;
    if (audio.current) audio.current.playbackRate = s;
    setPlayer(p => ({ ...p, speed: s }));
  }
  function stopPlayer() { audio.current?.pause(); setPlayer(p => ({ ...p, id: null, t: 0, playing: false })); }

  function act(a: MenuAction) {
    const m = menu!.m; setMenu(null);
    if (a === 'reply') { setEditing(null); setReply(m.id); }
    else if (a === 'edit') { setReply(null); setEditing(m.id); }
    else if (a === 'copy') { navigator.clipboard?.writeText(m.text ?? '').then(() => say('Copied'), () => {}); }
    else if (a === 'pin') msgs.togglePin(room!.id, m.id, room!.pinned);
    else if (a === 'info') router.push(`/chats/${room!.id}/info/${m.id}`);
    else if (a === 'delete') { setTarget(m); setSheet('delete'); }
    else if (a === 'cheer') { setTarget(m); setSheet('cheer'); }
    else if (a === 'report') router.push('/report-a-bug');
    else if (a === 'more') { setTarget(m); setSheet('react'); }
  }
  async function pickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    try { setDraft(await shrinkPhoto(f)); } catch { say('Could not read that photo'); }
  }
  const sendWithReply = (m: Parameters<typeof msgs.send>[1], blob?: Blob) => { atBottom.current = true; msgs.send(room.id, { ...m, replyTo: reply ?? undefined }, blob).catch(oops); setReply(null); };
  const back = () => {
    if (canGoBack()) { goBack(router); morphBack(room.id, main.current); }
    else router.push('/chats');
  };

  const header = desk ? (
    <header className="r-chat-head is-desk">
      <RoomTile room={room} className="r-desk-cover" />
      <Link href={`/rooms/${room.id}`} className="r-chat-title"><span className="r-chat-name">{room.name}</span><span className="r-chat-sub">{deskSub}</span></Link>
      <button type="button" className="r-head-icon" aria-label="Call" aria-disabled="true" title="Calls come later"><RIcon name="phone" size={20} /></button>
      <Link href={`/chats/${room.id}/settings`} className="r-head-icon" aria-label="Chat settings"><RIcon name="more" size={20} /></Link>
    </header>
  ) : (
    <header className="r-chat-head">
      <button type="button" className="back-btn" aria-label="Back" onClick={back}>
        <Icon name="chevron-right" size={20} className="flip" />
      </button>
      <Link href={`/chats/${room.id}/settings`} className="r-chat-title">
        <RoomBadge room={room} />
        <span className="r-chat-text"><span className="r-chat-name">{room.name}</span><span className="r-chat-sub">{people(room)}</span></span>
      </Link>
      <button type="button" className="r-head-icon" aria-label="Call" aria-disabled="true" title="Calls come later"><RIcon name="phone" size={24} /></button>
      <Link href={`/chats/${room.id}/settings`} className="r-head-icon" aria-label="Chat settings"><RIcon name="more" size={24} /></Link>
    </header>
  );

  const days = messages.map(m => dayLabel(m.at));
  return (
    <main ref={main} className={`r-chat${desk ? ' is-desk' : ''}`}>
      {header}
      {playingMsg && (
        <div className="r-nowplaying">
          <button type="button" aria-label={player.playing ? 'Pause' : 'Play'} onClick={() => play(playingMsg)}><RIcon name={player.playing ? 'pause' : 'play'} size={24} /></button>
          <span className="r-nowplaying-who">{playingMsg.authorId === ME ? 'You' : playingMsg.authorName}  ·  voice note</span>
          <button type="button" className="r-nowplaying-speed" onClick={speed}>{player.speed}x</button>
          <button type="button" className="round-btn r-close-btn" aria-label="Stop" onClick={stopPlayer}><RIcon name="close-np" size={20} /></button>
        </div>
      )}
      <div ref={scroller} onScroll={onScroll} className={`r-thread${wp ? ' has-wall' : ''}`} style={wp ? { backgroundImage: `url(/figma/rooms/wall-${wp.id}.svg)` } : undefined}>
        <div ref={inner} className="r-thread-in">
          {status === 'loading' && messages.length === 0 && <div className="r-thread-state"><Skeleton variant="chats" count={4} /></div>}
          {status === 'error' && messages.length === 0 && <StatusScreen kind="error" onRetry={retryRoom} cover={false} />}
          {loadingOlder && <span className="r-older t-caption c-3" role="status">Loading…</span>}
          {status === 'ready' && messages.length === 0 && (
            <div className="r-thread-empty">
              <StickerArt id="hi" cell={96} />
              <p className="r-h3">The start of {room.name}</p>
              <p className="t-body-s c-2">{room.members.length > 1 ? 'Say hi, send a cheer or start a poll.' : 'Invite a few people, then say hi.'}</p>
              {room.members.length > 1
                ? <button type="button" className="r-pill-dark" onClick={() => sendWithReply({ kind: 'sticker', sticker: 'hi' })}>Wave hello</button>
                : <Link href={`/rooms/${room.id}/members?invite=1`} className="r-pill-dark">Invite someone</Link>}
            </div>
          )}
          {messages.map((m, i) => {
            const k = keys[i];
            const chip = i === 0 || days[i] !== days[i - 1] ? <div key={`d-${k}`} className={`r-day${born[k] ? ' is-in' : ''}`}><span>{days[i]}</span></div> : null;
            return [chip, (
              <div key={k} data-k={k} className="r-slot">
              <Bubble m={m} room={room} desk={desk} flash={flash === m.id} enter={born[k]} seen={m.id === seenId}
                      quoted={quoteOf(m)}
                      player={player} onPlay={play} onSpeed={speed}
                      onHold={(msg, el, at) => { if (!msg.pending) setMenu({ m: msg, el, at }); }}
                      onPhoto={(msg, img) => (msg.photo!.once ? setOnce(msg) : setViewer({ m: msg, from: img ?? null }))}
                      onVote={(msg, i) => { msgs.vote(room.id, msg.id, i).catch(oops); }}
                      onQuote={qid => { document.getElementById(`m-${qid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFlash(qid); setTimeout(() => setFlash(null), 1500); }} />
              </div>
            )];
          })}
        </div>
        <div className="r-jump-dock">
          <button type="button" className={`r-jump${unseen || away ? ' is-on' : ''}`} onClick={toBottom} tabIndex={unseen || away ? 0 : -1} aria-hidden={!(unseen || away)}
                  aria-label={unseen ? `${unseen} new ${unseen === 1 ? 'message' : 'messages'}` : 'Go to the newest message'}>
            {unseen > 0 && <span>{unseen} new</span>}
            <RIcon name="chevron-24" size={20} className="r-jump-arrow" />
          </button>
        </div>
      </div>
      <Composer room={room} desk={desk} reply={replying} editing={editMsg}
                onCancel={() => { setReply(null); setEditing(null); }}
                onSend={text => sendWithReply({ kind: 'text', text })}
                onSave={() => setEditing(null)}
                onAdd={el => setAdd(el)} onSticker={() => setSheet('sticker')} onHint={say}
                onVoice={(blob, seconds, bars) => {
                  const step = Math.max(1, Math.floor(bars.length / 48));
                  sendWithReply({ kind: 'voice', voice: { clip: URL.createObjectURL(blob), seconds: Math.round(seconds * 10) / 10, bars: bars.filter((_, i) => i % step === 0).map(b => Math.round(b * 100) / 100) } }, blob);
                }} />

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={pickPhoto} />
      {add && <PopMenu anchor={add} onClose={() => setAdd(null)} items={[
        { label: 'Take a photo', icon: 'camera', onClick: () => camera.current?.click() },
        { label: 'Choose a photo', icon: 'photo', onClick: () => gallery.current?.click() },
        { label: 'Cheer', icon: 'party', onClick: () => { setTarget(null); setSheet('cheer'); } },
        { label: 'Poll', icon: 'icon-vote', onClick: () => setSheet('poll') }
      ]} />}
      {menu && <MessageMenu m={menu.m} el={menu.el} at={menu.at} room={room} onClose={() => setMenu(null)}
                            onReact={() => setMenu(null)} onAction={act} />}
      <CheerSheet open={sheet === 'cheer'} onClose={() => setSheet(null)}
                  onSend={c => { msgs.send(room.id, { kind: 'cheer', cheer: c, replyTo: target?.id ?? reply ?? undefined }).catch(oops); setReply(null); setTarget(null); setSheet(null); }} />
      <StickerSheet open={sheet === 'sticker'} onClose={() => setSheet(null)} recent={recent}
                    onSticker={s => { sendWithReply({ kind: 'sticker', sticker: s }); setSheet(null); }}
                    onCheer={c => { sendWithReply({ kind: 'cheer', cheer: c }); setSheet(null); }} />
      <ReactionSheet open={sheet === 'react'} onClose={() => setSheet(null)}
                     onPick={() => { setSheet(null); setTarget(null); }} />
      <PollSheet open={sheet === 'poll'} onClose={() => setSheet(null)}
                 onSend={(q, a, b, closes) => { sendWithReply({ kind: 'poll', poll: { question: q, options: [{ label: a, votes: [] }, { label: b, votes: [] }], closesAt: closes.toISOString() } }); setSheet(null); }} />
      <DeleteSheet open={sheet === 'delete'} mine={canDeleteForAll(target)} onClose={() => setSheet(null)}
                   onEveryone={() => { msgs.removeForEveryone(room.id, target!.id).catch(oops); setSheet(null); }}
                   onMe={() => { msgs.removeForMe(room.id, target!.id).catch(oops); setSheet(null); }} />
      {draft && <PhotoDraft src={draft} onClose={() => setDraft(null)}
                            onSend={(o, caption) => { sendWithReply({ kind: 'photo', photo: { src: draft, once: o, caption: caption || undefined, openedBy: [] } }); setDraft(null); }} />}
      {viewer && <ImageViewer m={viewer.m} from={viewer.from} onClose={() => setViewer(null)}
                              onCheer={() => { setTarget(viewer.m); setViewer(null); setSheet('cheer'); }}
                              onReply={() => { setReply(viewer.m.id); setViewer(null); }} />}
      {once && <OnceViewer m={once} onClose={() => { msgs.opened(room.id, once.id).catch(() => {}); setOnce(null); }} />}
      {toast}
    </main>
  );
}
