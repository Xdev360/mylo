'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Mylo from './Mylo';
import { NavButton, Scene, WorldHeader, WorldPage, useBack, useNow, wi } from './ui';
import { ACTIVITIES, DEFAULT_LOOK, useHouse, useLook, useVisits, type Visit } from '@/lib/world';

/* Visits need a friend on the other side. Friends come from the social
   area and the server; with none yet every screen here shows its own
   empty state: the door stays shut, nobody knocks, nobody is over. */

/* ── K1 · your house, and the knock when there is one (879:187873) ─────── */
export function VisitsHome() {
  return <WorldPage className="w-visits" tabs><HomeBody /></WorldPage>;
}
function HomeBody() {
  const router = useRouter();
  const [look] = useLook();
  const [house] = useHouse();
  const [visits] = useVisits();
  const knock = visits.find(v => v.status === 'knocking');
  const over = visits.find(v => v.status === 'over');
  useEffect(() => { if (over) router.replace('/visits/over'); }, [over, router]);
  const back = useBack('/house');
  return (
    <>
      <Scene art="living-wide" look={look} at={[0.153, 0.464, 0.382]} className="w-k1-scene" label={`${look.name} in the living room`} />
      <div className="w-k1-top">
        <NavButton onClick={back} />
        <Link href="/visits/notifications" className="back-btn" aria-label="Visit notifications"><Icon name={wi('bell')} size={20} /></Link>
      </div>
      {knock && (
        <div className="w-knock" role="alert">
          <span className="w-knock-face" aria-hidden><Mylo look={look} /></span>
          <span className="w-grow">
            <span className="t-title-s w-block">{knock.friend} is at your door</span>
            <span className="t-body-s c-2 w-block">Knock knock. Can I come in?</span>
            <span className="w-knock-btns">
              <Link href="/visits/door" className="w-mini is-dark">Let in</Link>
              <Link href="/visits/talk" className="w-mini">Answer</Link>
            </span>
          </span>
        </div>
      )}
      <div className="w-k1-body">
        <div className="card w-k1-card">
          <span className="t-title-s w-block">Living room</span>
          {house.treats.length > 0 && <span className="t-body-s c-2">{house.treats.length} treats ready to claim.</span>}
        </div>
        <Link href="/visits/invite" className="btn-primary w-wide"><Icon name={wi('send')} size={20} />Invite to your house</Link>
        <p className="t-caption c-3 w-center">Only friends can knock. 3 knocks a day max.</p>
      </div>
    </>
  );
}

/* ── K5 Invite over (879:188377) ────────────────────────────────────────── */
export function InviteOver() {
  return <WorldPage className="w-invite"><InviteBody /></WorldPage>;
}
function InviteBody() {
  const router = useRouter();
  const [, setVisits] = useVisits();
  const [act, setAct] = useState(ACTIVITIES[0].id);
  const [who, setWho] = useState<string[]>([]);
  const [when, setWhen] = useState<'now' | 'tonight' | 'pick'>('tonight');
  const [time, setTime] = useState('21:00');
  /* Friends live with the social area; none are on the device yet. */
  const friends: string[] = [];
  const send = () => {
    if (!who.length) return;
    const a = ACTIVITIES.find(x => x.id === act)!;
    setVisits(v => [...v, ...who.map(f => ({ id: crypto.randomUUID(), friend: f, status: 'invited' as const, activity: a.label, when: when === 'now' ? 'Now' : `Tonight ${time}`, messages: 0 }))]);
    router.push('/visits');
  };
  return (
    <>
      <WorldHeader kind="close" title="Invite to your house" fallback="/visits" />
      <h2 className="t-title-s">What are you doing?</h2>
      <div className="w-act-grid" role="radiogroup" aria-label="What are you doing?">
        {ACTIVITIES.map(a => (
          <button key={a.id} type="button" role="radio" aria-checked={act === a.id} className={`w-room w-act-card${act === a.id ? ' is-on' : ''}`} onClick={() => setAct(a.id)}>
            <span className="w-room-art is-short"><img src={`/figma/world/room/${a.id === 'movie' ? 'tile-living-night' : a.id === 'study' ? 'tile-bedroom' : a.id === 'workout' ? 'tile-gym' : 'tile-garden'}.svg`} alt="" /></span>
            <span className="w-room-label is-tight"><span className="t-body c-ink">{a.label}</span><span className="t-caption c-3">{a.room === 'living' ? 'Living room' : a.room === 'bedroom' ? 'Bedroom' : a.room === 'gym' ? 'Gym' : 'Garden'}</span></span>
          </button>
        ))}
      </div>
      <h2 className="t-title-s">Who</h2>
      <div className="w-who">
        {friends.map(f => (
          <button key={f} type="button" className={`w-who-face${who.includes(f) ? ' is-on' : ''}`} aria-pressed={who.includes(f)}
                  onClick={() => setWho(w => (w.includes(f) ? w.filter(x => x !== f) : [...w, f]))}>{f[0]}</button>
        ))}
        <Link href="/friends/add" className="w-who-face is-add" aria-label="Add friends"><Icon name={wi('plus')} size={22} /></Link>
      </div>
      <h2 className="t-title-s">When</h2>
      <div className="w-chips">
        <button type="button" className={`w-tab${when === 'now' ? ' is-on' : ''}`} aria-pressed={when === 'now'} onClick={() => setWhen('now')}>Now</button>
        <button type="button" className={`w-tab${when === 'tonight' ? ' is-on' : ''}`} aria-pressed={when === 'tonight'} onClick={() => { setWhen('tonight'); setTime('21:00'); }}>Tonight 21:00</button>
        {when === 'pick'
          ? <input type="time" className="w-tab is-on w-time" value={time} onChange={e => setTime(e.target.value)} aria-label="Pick a time" autoFocus />
          : <button type="button" className="w-tab" onClick={() => setWhen('pick')}>Pick a time</button>}
      </div>
      <p className="w-note"><Icon name={wi('done')} size={24} className="w-green" /><span className="t-body-s">Door opens when everyone finishes 3 tasks today</span></p>
      <div className="spacer" />
      <button type="button" className="btn-primary w-wide" onClick={send} disabled={!who.length}><Icon name={wi('send')} size={20} />Send invite</button>
    </>
  );
}

/* ── K2 At the door (879:188041) and K4 Talk at the door (546:112353) ──── */
export function FrontDoor() {
  return <WorldPage className="w-door"><DoorBody /></WorldPage>;
}
function DoorBody() {
  const router = useRouter();
  const [visits, setVisits] = useVisits();
  const knock = visits.find(v => v.status === 'knocking');
  const set = (status: Visit['status'] | null) => setVisits(vs => status ? vs.map(v => v.id === knock!.id ? { ...v, status, startedAt: new Date().toISOString() } : v) : vs.filter(v => v.id !== knock!.id));
  return (
    <>
      <WorldHeader kind="close" title="Front door" fallback="/visits" />
      <div className="w-door-art">
        <img src="/figma/world/room/door.svg" alt={knock ? `${knock.friend} at the door` : 'Your front door'} />
        {/* K2 draws the visitor in the porthole; until friends' looks arrive from the server, a Mylo stands in. */}
        {knock && <span className="w-door-window" aria-hidden><span className="w-door-friend"><Mylo look={DEFAULT_LOOK} shadow={false} /></span></span>}
      </div>
      {knock && (
        <>
          <h1 className="w-title-l w-center">{knock.friend} wants to visit</h1>
          <p className="t-body-s c-2 w-center">He can see your Mylo and the room you open.</p>
          <button type="button" className="btn-primary w-wide" onClick={() => { set('over'); router.push('/visits/over'); }}><Icon name={wi('home')} size={20} />Let {knock.friend} in</button>
          <div className="w-two">
            <Link href="/visits/talk" className="w-grey-btn">Answer</Link>
            <button type="button" className="w-grey-btn" onClick={() => { set(null); router.push('/visits'); }}>Not now</button>
          </div>
        </>
      )}
      <div className="spacer" />
      <p className="t-caption c-3 w-center">Only friends can knock. 3 knocks a day max.</p>
    </>
  );
}

export function DoorTalk() {
  return <WorldPage className="w-door"><TalkBody /></WorldPage>;
}
function TalkBody() {
  const [visits] = useVisits();
  const knock = visits.find(v => v.status === 'knocking');
  const [said, setSaid] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  return (
    <>
      <WorldHeader kind="close" title="At the door" fallback="/visits" />
      <div className="w-talk-art">
        <img src="/figma/world/room/door-talk.svg" alt="" />
        {knock && <span className="w-scene-mylo" style={{ left: '28.3%', top: '46.7%', width: '42.5%' }} aria-hidden><Mylo look={DEFAULT_LOOK} /></span>}
      </div>
      <div className="w-bubbles" aria-live="polite">
        {knock?.note && <p className="w-bubble">{knock.note}</p>}
        {said.map((s, i) => <p key={i} className="w-bubble is-me">{s}</p>)}
      </div>
      <div className="spacer" />
      <p className="t-caption c-3 w-center">Door chat stays private. Nothing is saved after 24 hours.</p>
      <form className="w-say" onSubmit={e => { e.preventDefault(); if (!draft.trim() || !knock) return; setSaid(s => [...s, draft.trim()]); setDraft(''); }}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Reply through the door" aria-label="Reply through the door" disabled={!knock} />
        <button type="submit" className="w-send" aria-label="Send" disabled={!knock || !draft.trim()}><Icon name={wi('send')} size={20} /></button>
      </form>
    </>
  );
}

/* ── K3 a friend is over (879:188158) ───────────────────────────────────── */
export function VisitOver() {
  return <WorldPage className="w-over"><OverBody /></WorldPage>;
}
function OverBody() {
  const router = useRouter();
  const [look] = useLook();
  const [visits, setVisits] = useVisits();
  const v = visits.find(x => x.status === 'over');
  const now = useNow(30000);
  const [draft, setDraft] = useState('');
  const [said, setSaid] = useState<string | null>(null);
  useEffect(() => { if (!v) router.replace('/visits'); }, [v, router]);
  if (!v) return null;
  const mins = v.startedAt ? Math.max(0, Math.round((now.getTime() - new Date(v.startedAt).getTime()) / 60000)) : 0;
  const end = () => { setVisits(vs => vs.map(x => x.id === v.id ? { ...x, status: 'ended', endedAt: new Date().toISOString() } : x)); router.replace('/visits/ended'); };
  return (
    <>
      <Scene art="living-night" look={look} at={[0.102, 0.52, 0.35]} className="w-k3-scene">
        {/* The visitor, where K3 stands them; a plain Mylo until friends' looks come from the server. */}
        <span className="w-scene-mylo" style={{ left: '53.4%', top: '52%', width: '35.1%' }} aria-hidden><Mylo look={DEFAULT_LOOK} /></span>
        {said && <p className="w-bubble is-me w-k3-bubble">{said}</p>}
      </Scene>
      <div className="w-k3-top">
        <span className="w-status"><span className="live-dot" />{v.friend} is here · {mins} min</span>
        <button type="button" className="w-status w-red" onClick={end}>End visit</button>
      </div>
      <div className="w-k3-body">
        <div className="card w-k3-card"><span className="t-title-s w-block">{v.activity}</span></div>
        <div className="w-reacts">
          {['heart', 'party', 'hand', 'sticker'].map(r => (
            <button key={r} type="button" className="w-react" aria-label={r} onClick={() => setVisits(vs => vs.map(x => x.id === v.id ? { ...x, messages: x.messages + 1 } : x))}><Icon name={wi(r)} size={22} /></button>
          ))}
        </div>
        <form className="w-say" onSubmit={e => { e.preventDefault(); if (!draft.trim()) return; setSaid(draft.trim()); setDraft(''); setVisits(vs => vs.map(x => x.id === v.id ? { ...x, messages: x.messages + 1 } : x)); }}>
          <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Say something" aria-label="Say something" />
          <button type="submit" className="w-send" aria-label="Send" disabled={!draft.trim()}><Icon name={wi('send')} size={20} /></button>
        </form>
      </div>
    </>
  );
}

/* ── K6 Invite received (879:188772) ────────────────────────────────────── */
export function InviteReceived() {
  return <WorldPage className="w-invited"><ReceivedBody /></WorldPage>;
}
function ReceivedBody() {
  const router = useRouter();
  const [look] = useLook();
  const [visits, setVisits] = useVisits();
  const v = visits.find(x => x.status === 'invited');
  useEffect(() => { if (!v) router.replace('/visits'); }, [v, router]);
  if (!v) return null;
  const answer = (yes: boolean) => { setVisits(vs => yes ? vs : vs.filter(x => x.id !== v.id)); router.push('/visits'); };
  return (
    <>
      <img className="w-k6-bg" src="/figma/world/room/living-night.svg" alt="" />
      <span className="w-usekey-scrim" />
      <NavButton kind="close" href="/visits" className="w-k6-close" />
      <section className="w-usekey-sheet" aria-labelledby="k6-title">
        <span className="grabber w-grabber" />
        <div className="w-k6-head">
          <span className="w-k6-face"><Mylo look={look} /></span>
          <span><h1 id="k6-title" className="w-title-m">{v.friend} invited you over</h1><span className="t-body-s c-2">{v.activity} · {v.when.toLowerCase()}</span></span>
        </div>
        <button type="button" className="btn-primary w-wide" onClick={() => answer(true)}><Icon name={wi('check')} size={20} />I am in</button>
        <button type="button" className="w-grey-btn w-wide" onClick={() => answer(false)}>Can’t make it</button>
        <p className="t-caption c-3 w-center">{v.friend} will see your Mylo arrive when you join.</p>
      </section>
    </>
  );
}

/* ── K8 Visit ended (879:188974) ────────────────────────────────────────── */
export function VisitEnded() {
  return <WorldPage className="w-ended"><EndedBody /></WorldPage>;
}
function EndedBody() {
  const router = useRouter();
  const [look] = useLook();
  const [visits] = useVisits();
  const v = [...visits].reverse().find(x => x.status === 'ended');
  useEffect(() => { if (!v) router.replace('/visits'); }, [v, router]);
  if (!v) return null;
  const mins = v.startedAt && v.endedAt ? Math.max(1, Math.round((new Date(v.endedAt).getTime() - new Date(v.startedAt).getTime()) / 60000)) : 0;
  return (
    <>
      <WorldHeader kind="close" fallback="/visits" />
      <Scene art="living-night-photo" look={look} at={[0.166, 0.38, 0.38]} className="w-k8-photo">
        <span className="w-scene-mylo" style={{ left: '46.97%', top: '34.67%', width: '38%' }} aria-hidden><Mylo look={DEFAULT_LOOK} /></span>
      </Scene>
      <h1 className="w-title-l w-center">{v.friend} stayed {mins} minutes</h1>
      <p className="t-body c-2 w-center">{v.activity} done.</p>
      <div className="w-stats">
        <span><b>{mins} min</b><span className="t-caption c-2">Together</span></span>
        <span><b>{v.messages}</b><span className="t-caption c-2">Messages</span></span>
      </div>
      <Link href="/photo/new" className="btn-primary w-wide"><Icon name={wi('camera')} size={20} />Save this photo ({v.friend} approves)</Link>
      <Link href="/visits/invite" className="w-grey-btn w-wide">Invite again</Link>
    </>
  );
}

/* ── K7 Visit notifications (546:113022) ────────────────────────────────── */
export function VisitNotifications() {
  return <WorldPage className="w-lock"><NotesBody /></WorldPage>;
}
function NotesBody() {
  const back = useBack('/visits');
  const now = useNow();
  const [visits] = useVisits();
  const [look] = useLook();
  const notes = visits.filter(v => v.status === 'knocking' || v.status === 'invited');
  return (
    <>
      <span className="w-stars" aria-hidden />
      <NavButton onClick={back} className="w-float-nav is-light" />
      <p className="w-lock-date">{now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <p className="w-lock-time">{now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
      <div className="w-notes">
        {notes.map(v => (
          <Link key={v.id} href={v.status === 'knocking' ? '/visits/door' : '/visits/invited'} className="w-notif">
            <span className="w-notif-face"><Mylo look={look} /></span>
            <span className="w-grow">
              <span className="t-body-s c-ink w-block w-strong">{v.status === 'knocking' ? `${v.friend} is knocking` : `${v.activity} · ${v.when}`}</span>
              <span className="t-caption c-2">{v.status === 'knocking' ? 'Let him in or answer at the door.' : `At ${v.friend}’s house.`}</span>
            </span>
            <span className="w-tiny c-2">now</span>
          </Link>
        ))}
      </div>
    </>
  );
}
