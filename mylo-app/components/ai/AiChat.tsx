'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Icon from '../Icon';
import { useLocal, useHydrated } from '@/lib/local';
import { onDay, useStore } from '@/lib/store';
import { iso, todayIso } from '@/lib/dates';
import {
  AiError, CHATS_KEY, DAILY, SLIPS_KEY, USAGE_KEY, ago, askMylo, fromGoal, pickMode, readWeek, slipId, useAddDrafts, useNow, usedToday,
  type Chat, type Draft, type Msg, type Slip, type SlipNote, type Usage
} from '@/lib/ai';
import { useVoice, useVoiceSupported, bars, type VoiceFail } from './useVoice';
import { Listening, RecordingBar, VoiceNote, audioFor } from './VoiceBits';
import { DraftReview, PlanCards } from './Drafts';
import { NoticedCard, NoticedSheet } from './Noticed';
import Limit from './Limit';
import { useAnnounce } from '../goals/Tick';
import { canGoBack, goBack } from '@/components/NavMotion';

/* Mylo AI. On a phone, the chat from AI2 to AI6 with the review (AI1), the
   edit sheet (AI7) and the daily limit (AI8); from 1024 wide, DT6: the chat in
   the middle and Recent at the right. Chats stay on this device. */

type MeMsg = Extract<Msg, { role: 'me' }>;
type MyloMsg = Extract<Msg, { role: 'mylo' }>;
type View = 'chat' | 'limit' | { review: string };

const deskQuery = '(min-width:1024px)';
const subDesk = (cb: () => void) => { const m = window.matchMedia(deskQuery); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb); };
const useDesk = () => useSyncExternalStore(subDesk, () => window.matchMedia(deskQuery).matches, () => false);

const VOICE_HINT: Record<VoiceFail, string> = {
  blocked: 'Allow the mic to talk to Mylo.',
  nomic: 'No mic found.',
  network: 'Voice needs a connection.',
  empty: 'Mylo didn’t catch that.'
};

const STARTERS = ['Plan my evening', 'Help me start running', 'Make tomorrow lighter'];

/* The server's fallback reply lists the drafts as bullets; the cards show them. */
const tidy = (reply: string) => reply.split('\n').filter(l => !/^\s*[•\-*]\s/.test(l)).join('\n').replace(/\n{2,}/g, '\n').trim();
const planText = (d: Draft) => `${d.title}${d.time ? ` at ${d.time}` : ''}${d.minutes ? ` for ${d.minutes} min` : ''}`;

export default function AiChat() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { items } = useStore();
  const addDrafts = useAddDrafts();
  const announce = useAnnounce();
  const [chats, setChats] = useLocal<Chat[]>(CHATS_KEY, []);
  const [currentId, setCurrentId] = useLocal<string | null>('mylo.ai.current.v1', null);
  const [usage, setUsage] = useLocal<Usage>(USAGE_KEY, { day: '', n: 0 });
  const [notes, setNotes] = useLocal<Record<string, SlipNote>>(SLIPS_KEY, {});
  const now = useNow();
  const desk = useDesk();
  const used = now ? usedToday(usage, iso(new Date(now))) : 0;
  const left = Math.max(0, DAILY - used);

  const chat = chats.find(c => c.id === currentId) ?? null;
  const msgs = useMemo(() => chat?.msgs ?? [], [chat]);
  const [pending, setPending] = useState<string | null>(null);
  const [text, setText] = useState('');
  // /ai?limit opens on AI8, for screens elsewhere that run out of messages.
  const [view, setView] = useState<View>(() => (typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('limit') ? 'limit' : 'chat'));
  const [menu, setMenu] = useState(false);
  const [hint, setHint] = useState('');
  const [locked, setLocked] = useState(false);
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const [noticed, setNoticed] = useState<Slip | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const voiceOk = useVoiceSupported();

  const week = useMemo(() => (now ? readWeek(items, new Date(now)) : null), [items, now]);
  const topSlip = week?.slips.find(s => s.missed >= 2) ?? null;

  const voice = useVoice({
    onDone: r => {
      const id = crypto.randomUUID();
      if (r.audio) audioFor.set(id, r.audio);
      void send(r.text, { secs: r.secs, bars: r.bars }, undefined, id);
    },
    onFail: f => setHint(VOICE_HINT[f])
  });
  const recording = voice.state === 'recording';
  const cancelVoice = voice.cancel;

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [msgs.length, pending, voice.state, view]);

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(''), 4000);
    return () => clearTimeout(t);
  }, [hint]);

  useEffect(() => {
    if (!recording) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cancelVoice(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [recording, cancelVoice]);

  const patchChat = (id: string, fn: (c: Chat) => Chat) => setChats(all => all.map(c => (c.id === id ? fn(c) : c)));

  async function send(raw: string, vn?: MeMsg['voice'], retryId?: string, newId?: string) {
    const body = raw.trim();
    if (!body || pending) return;
    if (left <= 0) { setView('limit'); return; }
    const at = new Date().toISOString();
    const prev = (chat?.msgs ?? []).filter(m => m.id !== retryId);
    let cid = chat?.id ?? null;
    if (!cid) {
      cid = crypto.randomUUID();
      const fresh: Chat = { id: cid, title: body.slice(0, 60), at, msgs: [] };
      setChats(all => [fresh, ...all]);
      setCurrentId(cid);
    }
    const id = cid;
    const meId = retryId ?? newId ?? crypto.randomUUID();
    if (retryId) patchChat(id, c => ({ ...c, msgs: c.msgs.map(m => (m.id === retryId ? { ...m, status: 'sending', why: undefined } as MeMsg : m)) }));
    else patchChat(id, c => ({ ...c, at, msgs: [...c.msgs, { id: meId, role: 'me', text: body, at, voice: vn, status: 'sending' }] }));
    setPending(meId);
    if (!retryId) setText('');

    const lastPlan = [...prev].reverse().find((m): m is MyloMsg => m.role === 'mylo' && !!m.drafts?.length && !m.added);
    const mode = pickMode(body);
    const ask = lastPlan && mode === 'goals' ? `${body}\n\nThe plan so far: ${lastPlan.drafts!.map(planText).join(', ')}.` : body;
    const history = prev.filter(m => !(m.role === 'me' && m.status === 'failed')).slice(-10)
      .map(m => ({ role: m.role === 'me' ? 'user' : 'mylo', text: m.text }));
    const context = {
      today: onDay(items, todayIso()).map(i => ({ title: i.title, time: i.time ?? null, done: i.done })),
      plan: lastPlan?.drafts?.map(d => ({ title: d.title, time: d.time ?? null, minutes: d.minutes ?? null })) ?? []
    };
    try {
      const r = await askMylo({ mode, text: ask, history, context });
      const drafts = r.goals.map(fromGoal);
      const reply: MyloMsg = {
        id: crypto.randomUUID(), role: 'mylo', at: new Date().toISOString(),
        text: drafts.length ? tidy(r.reply) : r.reply,
        drafts: drafts.length ? drafts : undefined,
        chips: r.chips.length ? r.chips : undefined
      };
      patchChat(id, c => ({ ...c, at: reply.at, msgs: [...c.msgs.map(m => (m.id === meId ? { ...m, status: 'sent', why: undefined } as MeMsg : m)), reply] }));
      setUsage(u => { const d = todayIso(); return { day: d, n: (u.day === d ? u.n : 0) + 1 }; });
    } catch (e) {
      const why = e instanceof AiError ? e.why : 'failed';
      patchChat(id, c => ({ ...c, msgs: c.msgs.map(m => (m.id === meId ? { ...m, status: 'failed', why } as MeMsg : m)) }));
    } finally {
      setPending(null);
    }
  }

  function typeInstead(m: MeMsg) {
    if (chat) patchChat(chat.id, c => ({ ...c, msgs: c.msgs.filter(x => x.id !== m.id) }));
    setText(m.text);
    setTimeout(() => input.current?.focus(), 50);
  }
  function setDrafts(msgId: string, drafts: Draft[]) {
    if (chat) patchChat(chat.id, c => ({ ...c, msgs: c.msgs.map(m => (m.id === msgId && m.role === 'mylo' ? { ...m, drafts } : m)) }));
  }
  function addPlan(msgId: string) {
    const m = msgs.find((x): x is MyloMsg => x.id === msgId && x.role === 'mylo');
    if (!m?.drafts || m.added || !chat) return;
    const kept = m.drafts.filter(d => d.on);
    const { today, later } = addDrafts(kept);
    // Say where they went: Today when something is for today, Goals otherwise.
    announce(today
      ? { line: `Added ${kept.length} to ${later ? 'your plan' : 'Today'}`, sub: later ? `${today} today, ${later} in Goals` : undefined, href: '/today' }
      : { line: `Added ${kept.length} to Goals`, href: '/goals' });
    patchChat(chat.id, c => ({ ...c, msgs: c.msgs.map(x => (x.id === msgId && x.role === 'mylo' ? { ...x, added: true } : x)) }));
  }
  function newChat() { setCurrentId(null); setView('chat'); setMenu(false); setText(''); }
  function openChat(id: string) { setCurrentId(id); setView('chat'); setMenu(false); }
  function back() { if (canGoBack()) goBack(router); else router.push('/today'); }
  function spend() { setUsage(u => { const d = todayIso(); return { day: d, n: (u.day === d ? u.n : 0) + 1 }; }); }

  /* Hold to talk, slide left to cancel, slide up to lock; a tap records
     hands-free. The finger can leave the button, so the window listens. */
  function micDown(e: React.PointerEvent) {
    if (e.button !== 0 || pending) return;
    if (left <= 0) { setView('limit'); return; }
    e.preventDefault();
    const x0 = e.clientX, y0 = e.clientY, t0 = Date.now();
    let done = false;
    setLocked(false); setDrag({ x: 0, y: 0 }); setHint('');
    voice.start();
    const end = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      setDrag({ x: 0, y: 0 });
    };
    const move = (ev: PointerEvent) => {
      if (done) return;
      const dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (dx < -110) { done = true; end(); voice.cancel(); return; }
      if (dy < -80) { done = true; end(); setLocked(true); return; }
      setDrag({ x: dx, y: dy });
    };
    const up = () => {
      end();
      if (done) return;
      done = true;
      if (Date.now() - t0 < 300) setLocked(true);
      else void voice.stop();
    };
    const cancel = () => { end(); if (!done) { done = true; voice.cancel(); } };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }
  function micKey(e: React.MouseEvent) {
    // Enter or Space on the mic: hands-free from the start.
    if (e.detail !== 0 || pending) return;
    if (left <= 0) { setView('limit'); return; }
    setLocked(true); voice.start();
  }

  if (!hydrated) return <div className="ai-page" aria-busy="true" />;

  const last = msgs[msgs.length - 1];
  const status = recording ? 'Listening' : pending ? 'Thinking'
    : last?.role === 'me' && last.status === 'failed' && last.why === 'offline' ? 'Offline' : 'Plans your day';
  const lastMylo = [...msgs].reverse().find((m): m is MyloMsg => m.role === 'mylo');
  const chips = !pending && last?.role === 'mylo' ? last.chips ?? [] : [];
  const sorted = [...chats].filter(c => c.msgs.length).sort((a, b) => b.at.localeCompare(a.at));
  const reviewing = typeof view === 'object' ? msgs.find((m): m is MyloMsg => m.id === view.review && m.role === 'mylo') : undefined;

  const rail = (
    <aside className="ai-rail" aria-label="Recent">
      <h2 className="ai-rail-title">Recent</h2>
      <div className="ai-rail-list">
        {sorted.map(c => (
          <button key={c.id} type="button" className={`ai-rail-item${c.id === currentId ? ' is-on' : ''}`} aria-current={c.id === currentId ? 'true' : undefined} onClick={() => openChat(c.id)}>
            <span className="ai-rail-name">{c.title}</span>
            <span className="ai-rail-when">{now ? ago(c.at, now) : ''}</span>
          </button>
        ))}
      </div>
      <span className="spacer" />
      <Link href="/ai/week" className="ai-rail-item ai-rail-week"><span className="ai-rail-name">Your week</span><span className="ai-rail-when">Read by Mylo</span></Link>
    </aside>
  );

  if (view === 'limit') {
    return <div className="ai-page"><section className="ai-col is-plain"><Limit used={used} onBack={() => setView('chat')} /></section>{rail}</div>;
  }
  if (reviewing?.drafts) {
    const i = msgs.indexOf(reviewing);
    const asked = [...msgs.slice(0, i)].reverse().find((m): m is MeMsg => m.role === 'me');
    return (
      <div className="ai-page">
        <section className="ai-col is-plain">
          <DraftReview drafts={reviewing.drafts} heard={asked ? `${asked.voice ? 'voice:' : ''}${asked.text}` : undefined}
                       onBack={() => setView('chat')} onChange={d => setDrafts(reviewing.id, d)}
                       onAdd={() => { addPlan(reviewing.id); setView('chat'); }} />
        </section>
        {rail}
      </div>
    );
  }

  const lastFailed = last?.role === 'me' && last.status === 'failed' && !pending ? last : null;

  return (
    <div className="ai-page">
      <section className="ai-col">
        {/* Phone header, AI2 to AI6 */}
        <header className="ai-head">
          <button type="button" className="back-btn" aria-label="Back" onClick={back}><Icon name="chevron-right" size={20} className="flip" /></button>
          <span className="ai-avatar"><img src="/figma/ai/mylo-plain.svg" alt="" width={27} height={32} /></span>
          <span className="ai-head-text">
            <span className="ai-head-name">Mylo</span>
            <span className={`ai-head-status${status === 'Offline' ? ' is-off' : ''}`} aria-live="polite">{status}</span>
          </span>
          <button type="button" className="ai-more" aria-label="More" aria-expanded={menu} onClick={() => setMenu(m => !m)}><Icon name="ai/more" size={24} /></button>
          {menu && <>
            <button type="button" className="ai-menu-scrim" aria-label="Close menu" tabIndex={-1} onClick={() => setMenu(false)} />
            <div className="ai-menu" role="menu">
              <button type="button" role="menuitem" className="ai-menu-item" onClick={newChat}><Icon name="ai/new-chat" size={18} />New chat</button>
              <Link href="/ai/week" role="menuitem" className="ai-menu-item" onClick={() => setMenu(false)}><Icon name="ai/sparkle" size={18} />Your week</Link>
              {sorted.length > 0 && <p className="t-label c-3 ai-menu-label">Recent</p>}
              {sorted.slice(0, 6).map(c => (
                <button key={c.id} type="button" role="menuitem" className={`ai-menu-item ai-menu-chat${c.id === currentId ? ' is-on' : ''}`} onClick={() => openChat(c.id)}>
                  <span className="ai-rail-name">{c.title}</span><span className="ai-rail-when">{now ? ago(c.at, now) : ''}</span>
                </button>
              ))}
            </div>
          </>}
        </header>

        {/* Desktop header, DT6 */}
        <header className="ai-desk-head">
          <div>
            <p className="t-body-s c-2">{left} of {DAILY} messages left today</p>
            <h1 className="ai-desk-title">Mylo AI</h1>
          </div>
          <button type="button" className="ai-new" onClick={newChat}><Icon name="ai/new-chat" size={18} />New chat</button>
        </header>

        <div className="ai-scroll" ref={scroller}>
          <div className="ai-msgs" aria-live="polite">
            {!msgs.length && !recording && voice.state === 'idle' && topSlip && (
              <NoticedCard slip={topSlip} onOpen={() => setNoticed(topSlip)} />
            )}
            {/* A new chat opens with Mylo's own first line, as AI4 draws the
                exchange, and three ways in; nothing is sent until you pick. */}
            {!msgs.length && !recording && voice.state === 'idle' && !pending && (
              <div className="ai-mylo ai-intro">
                <div className="ai-say">
                  <span className="ai-mini"><img src="/figma/ai/mylo-plain.svg" alt="" width={20} height={24} /></span>
                  <img className="ai-mylo-desk" src="/figma/ai/mylo-desk.svg" alt="" width={33} height={40} />
                  <p className="ai-bubble">Hi. What should we plan? Talk or type, and I&rsquo;ll draft it for you to keep or change.</p>
                </div>
                <div className="ai-chips ai-chips-inline">
                  {STARTERS.map(c => <button key={c} type="button" className="ai-chip" onClick={() => void send(c)}>{c}</button>)}
                </div>
              </div>
            )}
            {msgs.map(m => m.role === 'me' ? (
              <div key={m.id} className="ai-me">
                {m.voice
                  ? <>
                      <VoiceNote id={m.id} secs={m.voice.secs} bars={m.voice.bars} dim={m.status === 'failed'} />
                      {m.status === 'sending' && <p className="ai-heard-line">&ldquo;{m.text}&rdquo;</p>}
                    </>
                  : <p className={`ai-bubble-me${m.status === 'failed' ? ' is-dim' : ''}`}>{m.text}</p>}
                {m.status === 'failed' && (
                  <button type="button" className="ai-not-sent" onClick={() => void send(m.text, m.voice, m.id)} disabled={!!pending}>
                    <Icon name="ai/alert" size={18} />Not sent. Tap to retry
                  </button>
                )}
                {m.status === 'sending' && pending !== m.id && !pending && (
                  <button type="button" className="ai-not-sent" onClick={() => void send(m.text, m.voice, m.id)}>
                    <Icon name="ai/alert" size={18} />Not sent. Tap to retry
                  </button>
                )}
              </div>
            ) : (
              <div key={m.id} className="ai-mylo">
                <div className="ai-say">
                  <span className="ai-mini"><img src="/figma/ai/mylo-plain.svg" alt="" width={20} height={24} /></span>
                  <img className="ai-mylo-desk" src="/figma/ai/mylo-desk.svg" alt="" width={33} height={40} />
                  <p className="ai-bubble">{m.text || '\u2026'}</p>
                </div>
                {m.drafts && (
                  <div className="ai-indent">
                    <PlanCards drafts={m.drafts} added={m.added} onAdd={() => addPlan(m.id)} onEdit={() => setView({ review: m.id })} />
                  </div>
                )}
                {m.id === lastMylo?.id && chips.length > 0 && (
                  <div className="ai-chips ai-chips-inline">
                    {chips.map(c => <button key={c.label} type="button" className="ai-chip" onClick={() => void send(c.send)}>{c.label}</button>)}
                  </div>
                )}
              </div>
            ))}

            {lastFailed && (lastFailed.why === 'signin'
              ? (
                <div className="ai-error-card">
                  <span className="ai-error-mylo"><img src="/figma/ai/mylo-error.svg" alt="" width={30} height={36} /></span>
                  <div className="ai-error-text">
                    <p className="ai-error-title">Sign in to talk to Mylo</p>
                    <div className="ai-error-actions"><Link href="/signin" className="ai-btn-s is-dark">Sign in</Link></div>
                  </div>
                </div>
              ) : (
                <div className="ai-error-card" role="alert">
                  <span className="ai-error-mylo"><img src="/figma/ai/mylo-error.svg" alt="" width={30} height={36} /></span>
                  <div className="ai-error-text">
                    <p className="ai-error-title">Mylo lost the connection</p>
                    <p className="ai-error-body">
                      Your {lastFailed.voice ? 'voice note' : 'message'} is saved. {lastFailed.why === 'offline' ? 'Try again when you are back online.' : 'Try again in a moment.'}
                    </p>
                    <div className="ai-error-actions">
                      <button type="button" className="ai-btn-s is-dark" onClick={() => void send(lastFailed.text, lastFailed.voice, lastFailed.id)}>Try again</button>
                      <button type="button" className="ai-btn-s is-light" onClick={() => typeInstead(lastFailed)}>Type instead</button>
                    </div>
                  </div>
                </div>
              ))}

            {pending && (
              <div className="ai-thinking">
                <div className="ai-say">
                  <span className="ai-mini"><img src="/figma/ai/mylo-plain.svg" alt="" width={20} height={24} /></span>
                  <img className="ai-mylo-desk" src="/figma/ai/mylo-desk.svg" alt="" width={33} height={40} />
                  <span className="ai-dots-bubble" aria-label="Mylo is thinking"><span className="ai-dots"><i /><i /><i /></span></span>
                </div>
                <p className="ai-thinking-note">Mylo is building your plan</p>
              </div>
            )}

            {voice.state === 'transcribing' && (
              <div className="ai-me">
                <VoiceNote id="live" secs={voice.secs} bars={bars(voice.live)} />
                <div className="ai-transcribing" aria-label="Transcribing">
                  <p>Transcribing</p><span /><span /><span />
                </div>
              </div>
            )}

            {recording && <Listening />}
          </div>
        </div>

        {chips.length > 0 && (
          <div className="ai-chips ai-chips-desk">
            {chips.map(c => <button key={c.label} type="button" className="ai-chip" onClick={() => void send(c.send)}>{c.label}</button>)}
          </div>
        )}

        {hint && <p className="ai-hint" role="status">{hint}</p>}

        {recording
          ? <RecordingBar secs={voice.secs} live={voice.live} locked={locked} drag={drag} onSend={() => void voice.stop()} onCancel={voice.cancel} />
          : (
            <form className="ai-composer" onSubmit={e => { e.preventDefault(); void send(text); }}>
              <div className="ai-field-pill">
                <Icon name="ai/sparkle" size={22} className="c-3" />
                <input ref={input} className="ai-text" aria-label="Message Mylo" value={text} onChange={e => setText(e.target.value)} enterKeyHint="send" autoComplete="off"
                       placeholder={desk ? 'Ask Mylo to plan, draft a goal or talk it through' : 'Ask Mylo to plan something'} />
                {voiceOk && (
                  <button type="button" className="ai-mic-desk" aria-label="Talk to Mylo" disabled={!!pending || voice.state !== 'idle'}
                          onPointerDown={micDown} onClick={micKey} onContextMenu={e => e.preventDefault()}>
                    <Icon name="ai/mic-s" size={20} />
                  </button>
                )}
                <button type="submit" className="ai-send-desk" aria-label="Send" disabled={!!pending || !text.trim()} aria-busy={!!pending}>
                  <Icon name="ai/send" size={20} />
                </button>
              </div>
              {voiceOk && !text.trim()
                ? <button type="button" className="ai-mic" aria-label="Hold to talk to Mylo" disabled={!!pending || voice.state !== 'idle'}
                          onPointerDown={micDown} onClick={micKey} onContextMenu={e => e.preventDefault()}>
                    <Icon name="ai/mic" size={24} />
                  </button>
                : <button type="submit" className="ai-mic" aria-label="Send" disabled={!!pending || !text.trim()} aria-busy={!!pending}>
                    <Icon name="ai/send" size={22} />
                  </button>}
            </form>
          )}
      </section>
      {rail}

      <NoticedSheet slip={noticed} note={noticed && week ? notes[slipId(week.start, noticed.key)] : undefined}
                    onNote={n => { if (noticed && week) { const k = slipId(week.start, noticed.key); setNotes(all => ({ ...all, [k]: n })); } }}
                    left={left} onSpend={spend} onLimit={() => { setNoticed(null); setView('limit'); }} onClose={() => setNoticed(null)} />
    </div>
  );
}
