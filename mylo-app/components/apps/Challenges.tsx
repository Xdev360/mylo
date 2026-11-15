'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated } from '@/lib/local';
import { todayIso } from '@/lib/dates';
import { ME, useRooms } from '@/lib/rooms';
import { useFriends } from '@/lib/social';
import { uid, useChallenges, type Challenge } from '@/lib/apps';
import { Avatar, CloseBtn, Head, Seg, Toggle, useSlideDir, useToast } from './ui';

/* CH1 to CH5: challenges you run together and dares you send or get. Kept
   on the device; people come from your rooms and friends. A challenge's
   score is days checked in. */
const YOU = 'you';
const TONES = ['var(--tint-green)', 'var(--tint-amber)', 'var(--surface-2)'];
const dayMs = 864e5;
function iconFor(title: string) {
  const t = title.toLowerCase();
  if (/step|walk|run|gym|push|squat|swim|bike|move|workout|yoga/.test(t)) return 'i-workout';
  if (/read|book|page|study/.test(t)) return 'i-book';
  if (/sleep|bed|rest|calm/.test(t)) return 'i-moon';
  if (/save|money|spend/.test(t)) return 'i-chart';
  return 'i-heart';
}
const midnight = (d: Date) => new Date(d.toDateString()).getTime();
const daysIn = (c: Challenge) => Math.min(c.days, Math.floor((midnight(new Date()) - midnight(new Date(c.startedAt))) / dayMs) + 1);
const daysLeft = (c: Challenge) => Math.max(0, c.days - daysIn(c) + 1);
const leftLabel = (n: number) => (n === 7 ? '1 week left' : n === 1 ? '1 day left' : `${n} days left`);
const hoursLeft = (c: Challenge) => Math.max(0, Math.ceil((new Date(c.startedAt).getTime() + c.days * dayMs - Date.now()) / 36e5));
const board = (c: Challenge) => [YOU, ...c.people].map(p => ({ who: p, n: (c.checkins[p] ?? []).length })).sort((a, b) => b.n - a.n);
function leads(c: Challenge) {
  const b = board(c);
  if (!b[0].n || (b[1] && b[1].n === b[0].n)) return '';
  return b[0].who === YOU ? 'You lead' : `${b[0].who} leads`;
}
const nameOf = (p: string) => (p === YOU ? 'You' : p);
const agoText = (at: string) => (Date.now() - new Date(at).getTime() < 36e5 ? 'just now' : new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/* People to pick from: rooms first (all their members), then friends. */
function usePeople() {
  const { rooms } = useRooms();
  const [friends] = useFriends();
  const groups = rooms.filter(r => !r.asked).map(r => ({ label: r.name, members: r.members.filter(m => m.id !== ME).map(m => m.name) }));
  const people = [...new Set([...groups.flatMap(g => g.members), ...friends.map(f => f.name)])];
  return { groups, people };
}

/* ── CH1 · Challenges (879:115416) ──────────────────────────────────────── */
export function ChallengesList() {
  const ready = useHydrated();
  const [all] = useChallenges();
  const [tab, setTab] = useState<'active' | 'dares' | 'done'>('active');
  const slide = useSlideDir(['active', 'dares', 'done'] as const, tab);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const inbox = all.filter(c => c.kind === 'dare' && c.status === 'offered' && c.from);
  const shown = tab === 'active' ? all.filter(c => c.status === 'active')
    : tab === 'dares' ? all.filter(c => c.kind === 'dare' && (c.status === 'active' || (c.status === 'offered' && !c.from)))
    : all.filter(c => c.status === 'done');
  return (
    <main className="screen on-desk ax-ch">
      <header className="ax-title ax-title-row">
        <h1 className="ax-h1">Challenges</h1>
        <Link href="/challenges/new" className="ax-round is-ink" aria-label="New challenge"><Icon name="plus-20" size={22} /></Link>
      </header>
      <Seg label="Challenges" value={tab} onChange={setTab} options={[{ id: 'active', label: 'Active' }, { id: 'dares', label: 'Dares' }, { id: 'done', label: 'Done' }]} />
      <div key={tab} className={`ax-pane ${slide}`} role="tabpanel">
      {tab !== 'done' && inbox.map(c => (
        <div key={c.id} className="ax-dare-in">
          <Avatar name={c.from!} size={40} tint="var(--tint-amber)" />
          <span className="ax-dare-in-text"><span className="t-body ax-600">{c.from} dared you</span><span className="t-body-s c-2">{c.title}. {hoursLeft(c)} h left</span></span>
          <Link href={`/challenges/${c.id}`} className="ax-small-btn is-open">Open</Link>
        </div>
      ))}
      {shown.map((c, k) => (
        <Link key={c.id} href={`/challenges/${c.id}`} className="ax-ch-card" style={{ background: TONES[k % 3] }}>
          <span className="ax-ch-head">
            <span className="ax-ch-icon"><Icon name={`apps/${iconFor(c.title)}`} size={24} /></span>
            <span className="ax-ch-text">
              <span className="ax-ch-t">{c.title}</span>
              <span className="t-body-s c-2">
                {c.kind === 'dare' && c.status === 'offered'
                  ? `You dared ${c.people[0] ?? ''}`
                  : [c.room ?? (c.people.length === 0 ? 'You' : c.people.length === 1 ? `You and ${c.people[0]}` : `You and ${c.people.length} others`), c.status === 'done' ? 'Done' : leftLabel(daysLeft(c))].join(' · ')}
              </span>
            </span>
          </span>
          {c.kind === 'challenge' && <>
            <span className="ax-ch-track"><span style={{ width: `${(daysIn(c) / c.days) * 100}%` }} /></span>
            <span className="ax-ch-foot">
              <span className="ax-ch-people">{[YOU, ...c.people].slice(0, 5).map(p => <Avatar key={p} name={nameOf(p)} size={24} me={p === YOU} />)}</span>
              <span className="ax-12 ax-600">{leads(c)}</span>
            </span>
          </>}
        </Link>
      ))}
      {!shown.length && !(tab !== 'done' && inbox.length) && (
        <div className="ax-empty">
          <img src="/figma/apps/mylo-later.svg" alt="" width={74} height={88} />
          <p className="t-body c-2">{tab === 'active' ? 'Run one together with your room.' : tab === 'dares' ? 'Dare a friend, or run one together.' : 'Finished challenges and dares land here.'}</p>
          {tab !== 'done' && <Link href={tab === 'dares' ? '/challenges/new?kind=dare' : '/challenges/new'} className="ax-small-btn">New challenge</Link>}
        </div>
      )}
      </div>
    </main>
  );
}

/* ── CH2 · New challenge (879:115496) ───────────────────────────────────── */
const LONG = [{ id: '1', label: '1 day' }, { id: '3', label: '3 days' }, { id: '7', label: '1 week' }, { id: 'c', label: 'Custom' }];
export function NewChallenge({ dareTo, dare = false }: { dareTo?: string; dare?: boolean }) {
  const router = useRouter();
  const ready = useHydrated();
  const [, setAll] = useChallenges();
  const { groups, people } = usePeople();
  const [kind, setKind] = useState<'challenge' | 'dare'>(dareTo || dare ? 'dare' : 'challenge');
  const [title, setTitle] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [room, setRoom] = useState<string | null>(null);
  const [typed, setTyped] = useState(dareTo ?? '');
  const [long, setLong] = useState('3');
  const [custom, setCustom] = useState(14);
  const [loser, setLoser] = useState('');
  const [proof, setProof] = useState(true);
  const [nudge, setNudge] = useState(true);
  const sent = useRef(false);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const choices = [...(kind === 'challenge' ? groups.map(g => ({ id: `room:${g.label}`, label: g.label })) : []), ...people.map(p => ({ id: p, label: p }))];
  const isOn = (id: string) => (id.startsWith('room:') ? room === id.slice(5) : picked.includes(id));
  const flip = (id: string) => {
    if (id.startsWith('room:')) {
      const g = groups.find(x => x.label === id.slice(5))!;
      if (room === g.label) { setRoom(null); setPicked([]); } else { setRoom(g.label); setPicked(g.members); }
      return;
    }
    setRoom(null);
    if (kind === 'dare') { setPicked(picked[0] === id ? [] : [id]); setTyped(''); }
    else setPicked(picked.includes(id) ? picked.filter(x => x !== id) : [...picked, id]);
  };
  const extra = typed.trim();
  const who = [...new Set([...picked, ...(extra ? [extra] : [])])];
  const days = long === 'c' ? Math.min(90, Math.max(1, custom || 1)) : Number(long);
  const can = !!title.trim() && (kind === 'challenge' || who.length === 1);
  const send = () => {
    if (!can || sent.current) return;
    sent.current = true;
    const id = uid();
    setAll(a => [{ id, kind, title: title.trim(), people: who, days, loser: kind === 'challenge' ? loser.trim() || undefined : undefined, proof, nudge, startedAt: new Date().toISOString(), checkins: {}, status: kind === 'dare' ? 'offered' : 'active', room: room ?? undefined }, ...a]);
    router.replace(kind === 'dare' ? '/challenges' : `/challenges/${id}`);
  };
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow ax-new">
      <header className="screen-header">
        <CloseBtn href="/challenges" />
        <h1 className="screen-header-title">New challenge</h1>
        <div className="screen-header-actions" />
      </header>
      <Seg label="Kind" value={kind} onChange={k => { setKind(k); setRoom(null); setPicked(k === 'dare' ? picked.slice(0, 1) : picked); }} options={[{ id: 'challenge', label: 'Challenge' }, { id: 'dare', label: 'Dare' }]} />
      <label className="ax-field"><span className="ax-13 c-2">What is it?</span>
        <input className="ax-input" value={title} onChange={e => setTitle(e.target.value)} placeholder={kind === 'dare' ? 'Cold shower tomorrow morning' : '10k steps a day'} maxLength={80} enterKeyHint="next"
               onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (can) send(); else (e.currentTarget.closest('main')?.querySelector('input[aria-label="Add someone by name"]') as HTMLInputElement | null)?.focus(); } }} />
      </label>
      <div className="ax-field"><span className="ax-13 c-2">Who is in</span>
        {choices.length > 0 && (
          <div className="ax-chips">
            {choices.map(c => <button key={c.id} type="button" className={`ax-chip is-sm${isOn(c.id) ? ' is-on' : ''}`} aria-pressed={isOn(c.id)} onClick={() => flip(c.id)}>{c.label}</button>)}
          </div>
        )}
        {(kind === 'challenge' || !picked.length) && (
          <input className="ax-input" value={typed} onChange={e => setTyped(e.target.value)} placeholder="Name" aria-label="Add someone by name" maxLength={40} enterKeyHint="send"
                 onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send(); } }} />
        )}
      </div>
      <div className="ax-field"><span className="ax-13 c-2">How long</span>
        <Seg label="How long" value={long} onChange={setLong} options={LONG} />
        {long === 'c' && (
          <label className="ax-custom"><input className="ax-input is-num" type="number" min={1} max={90} value={custom} onChange={e => setCustom(Number(e.target.value))} aria-label="Days" /><span className="t-body c-2">days</span></label>
        )}
      </div>
      {kind === 'challenge' && (
        <label className="ax-field"><span className="ax-13 c-2">Loser has to</span>
          <input className="ax-input" value={loser} onChange={e => setLoser(e.target.value)} placeholder="Buy smoothies for everyone" maxLength={80} />
        </label>
      )}
      <div className="ax-rows">
        <div className="ax-trow">
          <span className="ax-trow-icon"><img src="/figma/apps/i-camera.svg" alt="" width={24} height={24} className="ax-dark-invert" /></span>
          <span className="ax-trow-text"><span className="t-body">Proof photo needed</span><span className="t-body-s c-2">Each check-in needs a photo</span></span>
          <Toggle on={proof} onChange={setProof} label="Proof photo needed" />
        </div>
        <div className="ax-trow">
          <span className="ax-trow-icon"><Icon name="bell" size={22} /></span>
          <span className="ax-trow-text"><span className="t-body">Daily nudge</span><span className="t-body-s c-2">At 8:00 pm if you have not checked in</span></span>
          <Toggle on={nudge} onChange={setNudge} label="Daily nudge" />
        </div>
      </div>
      <span className="spacer" />
      <button type="button" className="ax-btn ax-cta" disabled={!can} onClick={send}><Icon name="apps/i-send" size={22} />{kind === 'dare' ? 'Send dare' : 'Send challenge'}</button>
    </main>
  );
}

/* ── CH3 · in progress, CH4 · dare received, CH5 · proof done ──────────── */
export function ChallengeDetail({ id }: { id: string }) {
  const router = useRouter();
  const ready = useHydrated();
  const [all, setAll] = useChallenges();
  const [toast, showToast] = useToast();
  const file = useRef<HTMLInputElement>(null);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const c = all.find(x => x.id === id);
  if (!c) return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow">
      <Head fallback="/challenges" />
      <Link href="/challenges" className="ax-btn ax-btn-soft">Challenges</Link>
    </main>
  );
  const update = (patch: Partial<Challenge>) => setAll(a => a.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const today = todayIso();
  const checkedToday = (c.checkins[YOU] ?? []).includes(today);

  const checkIn = (photo?: string) => {
    if (checkedToday) return;
    const next = { ...c.checkins, [YOU]: [...(c.checkins[YOU] ?? []), today] };
    if (c.kind === 'dare') update({ checkins: next, status: 'done', proofPhoto: photo, doneAt: new Date().toISOString() });
    else { update({ checkins: next, ...(daysLeft(c) <= 1 ? { status: 'done' as const, doneAt: new Date().toISOString() } : {}) }); showToast('Checked in'); }
  };
  const onPhoto = (f?: File) => {
    if (!f) return;
    const img = new Image();
    const url = URL.createObjectURL(f);
    img.onload = () => {
      // Kept small so it fits on the device.
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * scale); cv.height = Math.round(img.height * scale);
      cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      checkIn(cv.toDataURL('image/jpeg', 0.78));
    };
    img.src = url;
  };
  const photoInput = <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={e => onPhoto(e.target.files?.[0])} />;
  const startCheckIn = () => (c.proof ? file.current?.click() : checkIn());

  // CH4: a dare someone sent you.
  if (c.kind === 'dare' && c.status === 'offered' && c.from) return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-dare">
      <Head fallback="/challenges" />
      <article className="ax-dare-card">
        <header className="ax-dare-from">
          <Avatar name={c.from} size={46} tint="var(--tint-amber)" />
          <span><span className="t-body ax-600">{c.from} dared you</span><span className="t-caption c-2">{hoursLeft(c)} hours left</span></span>
        </header>
        <p className="ax-dare-text">{c.title}</p>
        <span className="spacer" />
        <footer className="ax-dare-foot">
          {c.proof && <span className="ax-chip-static is-12">Proof: photo</span>}
        </footer>
        <img className="ax-dare-mylo" src="/figma/apps/mylo-dare.svg" alt="" width={143} height={143} />
      </article>
      <span className="spacer" />
      <div className="ax-moment-btns">
        <button type="button" className="ax-btn" onClick={() => update({ status: 'active', startedAt: new Date().toISOString() })}><Icon name="apps/i-bolt" size={22} />Accept dare</button>
        <button type="button" className="ax-btn ax-btn-soft" onClick={() => { update({ status: 'declined' }); router.replace('/challenges'); }}>Not this one</button>
      </div>
    </main>
  );

  // CH5: a dare done, with its proof.
  if (c.kind === 'dare' && c.status === 'done') {
    const from = c.from ?? c.people[0];
    const ago = c.doneAt ? agoText(c.doneAt) : '';
    return (
      <main className="screen on-desk ax-no-tabs no-tabs ax-done">
        <Head title="Dare done" fallback="/challenges" right={<Link href="/notifications" className="ax-round is-40" aria-label="Notifications"><Icon name="bell" size={19} /></Link>} />
        <div className="ax-proof">
          {c.proofPhoto ? <img src={c.proofPhoto} alt="Your proof" /> : <span className="ax-proof-sky" />}
          <span className="ax-stamp">Done</span>
        </div>
        <h1 className="ax-done-t">{c.title}</h1>
        <p className="t-body-s c-2">{c.room ? `Posted to ${c.room} · ${ago}` : ago}</p>
        {from && (
          <div className="ax-reward">
            <span className="ax-reward-icon"><img src="/figma/apps/i-dare-done.svg" alt="" width={16} height={16} /></span>
            <span><span className="t-body ax-600">Dare done</span><span className="t-body-s c-2">{from} owes you one. Your proof is in the room.</span></span>
          </div>
        )}
        <span className="spacer" />
        {from && <Link href={`/challenges/new?dare=${encodeURIComponent(from)}`} className="ax-btn ax-cta"><Icon name="apps/i-swords" size={22} />Dare {from} back</Link>}
      </main>
    );
  }

  // CH3: a challenge (or an accepted dare) under way.
  const rows = board(c);
  const most = Math.max(1, ...rows.map(r => r.n));
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-flow ax-progress">
      <Head title={c.title} fallback="/challenges"
            right={<button type="button" className="ax-round is-40" aria-label="Daily nudge" aria-pressed={c.nudge} onClick={() => { update({ nudge: !c.nudge }); showToast(c.nudge ? 'Daily nudge off' : 'Daily nudge on'); }}><Icon name="bell" size={19} className={c.nudge ? '' : 'c-3'} /></button>} />
      <div className="ax-status">
        <span className="ax-status-text">
          <span className="ax-13 ax-600 c-2">Day {daysIn(c)} of {c.days}</span>
          <span className="ax-status-t">{c.status === 'done' ? 'Done' : leftLabel(daysLeft(c))}</span>
          {c.loser && <span className="t-body-s c-2">Loser has to {lowerFirst(c.loser)}</span>}
        </span>
        <img src="/figma/apps/i-trophy.svg" alt="" width={36} height={36} className="ax-status-trophy" />
      </div>
      <h2 className="t-body ax-600">Leaderboard</h2>
      <ol className="ax-ranks">
        {rows.map((r, k) => (
          <li key={r.who} className={`ax-rank-row${r.who === YOU ? ' is-me' : ''}`}>
            <span className="ax-rank-n">{k + 1}</span>
            <Avatar name={nameOf(r.who)} size={36} me={r.who === YOU} />
            <span className="ax-rank-text"><span className="t-body ax-600">{nameOf(r.who)}</span><span className="t-caption c-2">{r.n} {r.n === 1 ? 'day' : 'days'}</span></span>
            <span className="ax-rank-track"><span style={{ width: `${(r.n / most) * 100}%`, background: k === 0 && r.n ? 'var(--green)' : 'var(--primary)' }} /></span>
          </li>
        ))}
      </ol>
      <span className="spacer" />
      {photoInput}
      <div className="ax-moment-btns">
        {c.status !== 'done' && (
          <button type="button" className="ax-btn" disabled={checkedToday} onClick={startCheckIn}>
            {c.proof && <img src="/figma/apps/i-camera.svg" alt="" width={22} height={22} className="ax-on-ink" />}{checkedToday ? 'Checked in' : 'Check in today'}
          </button>
        )}
        <Link href="/chats" className="ax-btn ax-btn-soft"><Icon name="apps/i-chat" size={22} />Open chat</Link>
      </div>
      {toast}
    </main>
  );
}
