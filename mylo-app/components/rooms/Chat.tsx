'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../Icon';
import Bubble, { type Player } from './Bubble';
import Composer from './Composer';
import { CheerSheet, DeleteSheet, ImageViewer, MessageMenu, OnceViewer, PhotoDraft, PollSheet, PopMenu, ReactionSheet, StickerSheet, type MenuAction } from './ChatSheets';
import { RIcon, RoomBadge, RoomTile, useToast } from './ui';
import { ME, dayLabel, msgs, people, shrinkPhoto, useRoom, useRooms, voiceClips, wallpaper, type Message } from '@/lib/rooms';
import { goBack } from '@/components/NavMotion';

/* CT1 · Room chat, with everything that happens in it (CT2 to CT17, CT21,
   CT23, CT24). On a phone it is the whole screen; in DT5 it is the middle
   column, same messages and the same controls, drawn the desktop way. */

export default function Chat({ id, desk = false }: { id: string; desk?: boolean }) {
  const router = useRouter();
  const { ready, room, messages, all } = useRoom(id);
  const { recent } = useRooms();
  const [toast, say] = useToast();
  const [reply, setReply] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [menu, setMenu] = useState<{ m: Message; el: HTMLElement } | null>(null);
  const [sheet, setSheet] = useState<null | 'cheer' | 'sticker' | 'poll' | 'delete' | 'react'>(null);
  const [target, setTarget] = useState<Message | null>(null);
  const [add, setAdd] = useState<HTMLElement | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [viewer, setViewer] = useState<Message | null>(null);
  const [once, setOnce] = useState<Message | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [player, setPlayer] = useState<Player>({ id: null, t: 0, speed: 1, playing: false });
  const audio = useRef<HTMLAudioElement | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const count = messages.length;

  useEffect(() => { if (ready && !room) router.replace('/chats'); }, [ready, room, router]);
  useEffect(() => {
    const el = scroller.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: count > 1 ? 'smooth' : 'auto' });
  }, [count, id]);
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
  if (!ready || !room) return <main className={desk ? 'r-chat is-desk' : 'r-chat'} aria-busy="true" />;

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
    else if (a === 'pin') msgs.togglePin(room!.id, m.id);
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
  const sendWithReply = (m: Parameters<typeof msgs.send>[1]) => { msgs.send(room.id, { ...m, replyTo: reply ?? undefined }); setReply(null); };

  const header = desk ? (
    <header className="r-chat-head is-desk">
      <RoomTile room={room} className="r-desk-cover" />
      <Link href={`/rooms/${room.id}`} className="r-chat-title"><span className="r-chat-name">{room.name}</span><span className="r-chat-sub">{deskSub}</span></Link>
      <button type="button" className="r-head-icon" aria-label="Call" aria-disabled="true" title="Calls come later"><RIcon name="phone" size={20} /></button>
      <Link href={`/chats/${room.id}/settings`} className="r-head-icon" aria-label="Chat settings"><RIcon name="more" size={20} /></Link>
    </header>
  ) : (
    <header className="r-chat-head">
      <button type="button" className="back-btn" aria-label="Back" onClick={() => (window.history.length > 1 ? goBack(router) : router.push('/chats'))}>
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
    <main className={`r-chat${desk ? ' is-desk' : ''}`}>
      {header}
      {playingMsg && (
        <div className="r-nowplaying">
          <button type="button" aria-label={player.playing ? 'Pause' : 'Play'} onClick={() => play(playingMsg)}><RIcon name={player.playing ? 'pause' : 'play'} size={24} /></button>
          <span className="r-nowplaying-who">{playingMsg.authorId === ME ? 'You' : playingMsg.authorName}  ·  voice note</span>
          <button type="button" className="r-nowplaying-speed" onClick={speed}>{player.speed}x</button>
          <button type="button" className="round-btn r-close-btn" aria-label="Stop" onClick={stopPlayer}><RIcon name="close-np" size={20} /></button>
        </div>
      )}
      <div ref={scroller} className={`r-thread${wp ? ' has-wall' : ''}`} style={wp ? { backgroundImage: `url(/figma/rooms/wall-${wp.id}.svg)` } : undefined}>
        <div className="r-thread-in">
          {messages.map((m, i) => {
            const chip = i === 0 || days[i] !== days[i - 1] ? <div key={`d-${m.id}`} className="r-day"><span>{days[i]}</span></div> : null;
            return [chip, (
              <Bubble key={m.id} m={m} room={room} desk={desk} flash={flash === m.id}
                      quoted={m.replyTo ? byId.get(m.replyTo) : undefined}
                      player={player} onPlay={play} onSpeed={speed}
                      onHold={(msg, el) => setMenu({ m: msg, el })}
                      onPhoto={msg => (msg.photo!.once ? setOnce(msg) : setViewer(msg))}
                      onVote={(msg, i) => msgs.vote(room.id, msg.id, i)}
                      onReact={(msg, k) => msgs.react(room.id, msg.id, k)}
                      onQuote={qid => { document.getElementById(`m-${qid}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); setFlash(qid); setTimeout(() => setFlash(null), 1500); }} />
            )];
          })}
        </div>
      </div>
      <Composer room={room} desk={desk} reply={replying} editing={editMsg}
                onCancel={() => { setReply(null); setEditing(null); }}
                onSend={text => sendWithReply({ kind: 'text', text })}
                onSave={text => { msgs.edit(room.id, editing!, text); setEditing(null); }}
                onAdd={el => setAdd(el)} onSticker={() => setSheet('sticker')} onHint={say}
                onVoice={(blob, seconds, bars) => {
                  const step = Math.max(1, Math.floor(bars.length / 48));
                  sendWithReply({ kind: 'voice', voice: { clip: voiceClips.put(blob), seconds: Math.round(seconds * 10) / 10, bars: bars.filter((_, i) => i % step === 0).map(b => Math.round(b * 100) / 100) } });
                }} />

      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={pickPhoto} />
      <input ref={gallery} type="file" accept="image/*" hidden onChange={pickPhoto} />
      {add && <PopMenu anchor={add} onClose={() => setAdd(null)} items={[
        { label: 'Take a photo', icon: 'camera', onClick: () => camera.current?.click() },
        { label: 'Choose a photo', icon: 'photo', onClick: () => gallery.current?.click() },
        { label: 'Cheer', icon: 'party', onClick: () => { setTarget(null); setSheet('cheer'); } },
        { label: 'Poll', icon: 'icon-vote', onClick: () => setSheet('poll') }
      ]} />}
      {menu && <MessageMenu m={menu.m} el={menu.el} room={room} onClose={() => setMenu(null)}
                            onReact={k => { msgs.react(room.id, menu.m.id, k); setMenu(null); }} onAction={act} />}
      <CheerSheet open={sheet === 'cheer'} onClose={() => setSheet(null)}
                  onSend={c => { msgs.send(room.id, { kind: 'cheer', cheer: c, replyTo: target?.id ?? reply ?? undefined }); setReply(null); setTarget(null); setSheet(null); }} />
      <StickerSheet open={sheet === 'sticker'} onClose={() => setSheet(null)} recent={recent}
                    onSticker={s => { sendWithReply({ kind: 'sticker', sticker: s }); setSheet(null); }}
                    onCheer={c => { sendWithReply({ kind: 'cheer', cheer: c }); setSheet(null); }} />
      <ReactionSheet open={sheet === 'react'} onClose={() => setSheet(null)}
                     onPick={s => { if (target) msgs.react(room.id, target.id, `sticker:${s}`); setSheet(null); setTarget(null); }} />
      <PollSheet open={sheet === 'poll'} onClose={() => setSheet(null)}
                 onSend={(q, a, b, closes) => { sendWithReply({ kind: 'poll', poll: { question: q, options: [{ label: a, votes: [] }, { label: b, votes: [] }], closesAt: closes.toISOString() } }); setSheet(null); }} />
      <DeleteSheet open={sheet === 'delete'} mine={target?.authorId === ME} onClose={() => setSheet(null)}
                   onEveryone={() => { msgs.removeForEveryone(room.id, target!.id); setSheet(null); }}
                   onMe={() => { msgs.removeForMe(room.id, target!.id); setSheet(null); }} />
      {draft && <PhotoDraft src={draft} onClose={() => setDraft(null)}
                            onSend={(o, caption) => { sendWithReply({ kind: 'photo', photo: { src: draft, once: o, caption: caption || undefined, openedBy: [] } }); setDraft(null); }} />}
      {viewer && <ImageViewer m={viewer} onClose={() => setViewer(null)}
                              onCheer={() => { setTarget(viewer); setViewer(null); setSheet('cheer'); }}
                              onReply={() => { setReply(viewer.id); setViewer(null); }} />}
      {once && <OnceViewer m={once} onClose={() => { msgs.opened(room.id, once.id); setOnce(null); }} />}
      {toast}
    </main>
  );
}
