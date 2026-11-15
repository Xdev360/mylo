'use client';

import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import ScreenHeader from '@/components/ScreenHeader';
import { Avatar, Segment, SIcon } from './ui';
import { firstName, useCheers, useMe, useRooms, useSeen, type RoomLite, type Seen } from '@/lib/social';
import { useRooms as useAccountRooms } from '@/lib/rooms';
import { onDay, streak, useStore, type Item } from '@/lib/store';
import { clock, todayIso } from '@/lib/dates';
import { useHydrated } from '@/lib/local';

/* Room people: everyone in the room today (RP1), one person's day (RP2), the
   room's goals (RP3) and what the room sees of you (RP4). The room comes from
   the rooms area; what Mylo knows of each day is yours, so your card is full
   and the others show who they are, with a cheer and a nudge. */

/* The room asked for, or the first one. `loading` while the account's rooms
   are still on their way, so "No room yet" never flashes first. */
function useRoom() {
  const rooms = useRooms();
  const { ready, signedOut, error } = useAccountRooms();
  const id = useSearchParams().get('room');
  return { room: rooms.find(r => r.id === id) ?? rooms[0] ?? null, loading: !ready && !signedOut && !error };
}
const roomQ = (r: RoomLite) => `?room=${encodeURIComponent(r.id)}`;

function NoRoom() {
  return (
    <main className="screen on-desk sx-full">
      <ScreenHeader fallback="/chats" />
      <section className="sx-gone">
        <img src="/figma/social/mylo-empty.svg" alt="" width={100} height={120} />
        <h1 className="sx-empty-title">No room yet</h1>
        <p className="sx-empty-text">Everyone in your room and how their day is going shows here. Make a room, or join one with a code.</p>
        <Link href="/rooms/new" className="btn-primary sx-wide">New room</Link>
        <Link href="/rooms/join" className="sx-btn-soft sx-wide">Join with a code</Link>
      </section>
    </main>
  );
}

function RoomHead({ room, more = true }: { room: RoomLite; more?: boolean }) {
  const n = room.size;
  return (
    <div className="sx-room-head">
      <ScreenHeader title={room.name} fallback={`/chats/${room.id}`}
        actions={more ? <Link href={`/chats/${room.id}/settings`} className="back-btn" aria-label="Room settings"><SIcon name="more-round" size={20} /></Link> : undefined} />
      <p className="sx-room-sub">{n} {n === 1 ? 'person' : 'people'}</p>
    </div>
  );
}

function useMine() {
  const { items, ready } = useStore();
  const day = onDay(items, todayIso());
  const done = day.filter(i => i.done);
  const left = day.filter(i => !i.done).sort((a, b) => (a.time ?? '99').localeCompare(b.time ?? '99'));
  const next = left.find(i => i.time);
  return { ready, items, day, done, left, next };
}

function TaskLine({ item }: { item: Item }) {
  return (
    <li className={`sx-task${item.done ? ' is-done' : ''}`}>
      <span className="sx-check">{item.done && <SIcon name="rp-check" size={14} />}</span>
      <span className="sx-task-title">{item.title}</span>
      {item.time && <span className="t-caption c-3">{clock(item.time)}</span>}
    </li>
  );
}

function CheerNudge({ room, name, big = false }: { room: RoomLite; name: string; big?: boolean }) {
  const [cheers, setCheers] = useCheers();
  const today = todayIso();
  const key = (k: string) => `${room.id}:${name}:${k}:${today}`;
  const toggle = (k: string) => setCheers(c => { const n = { ...c }; if (n[key(k)]) delete n[key(k)]; else n[key(k)] = Date.now(); return n; });
  const cheered = !!cheers[key('cheer')], nudged = !!cheers[key('nudge')];
  if (big) return (
    <div className="sx-day-actions">
      <button type="button" className="btn-primary sx-day-cheer" aria-pressed={cheered} onClick={() => toggle('cheer')}><SIcon name="party" size={20} />{cheered ? 'Cheered' : `Cheer ${firstName(name)}`}</button>
      <button type="button" className="sx-btn-soft sx-day-nudge" aria-pressed={nudged} onClick={() => toggle('nudge')}><SIcon name="hand" size={20} />{nudged ? 'Nudged' : 'Nudge'}</button>
    </div>
  );
  return (
    <span className="sx-mini-actions">
      <button type="button" className="sx-mini" aria-pressed={nudged} onClick={() => toggle('nudge')}><SIcon name="hand" size={14} />Nudge</button>
      <button type="button" className="sx-mini" aria-pressed={cheered} onClick={() => toggle('cheer')}><SIcon name="party" size={14} />Cheer</button>
    </span>
  );
}

const SEEN_ROWS: { key: keyof Seen; label: string; sub: string }[] = [
  { key: 'tasks', label: 'My tasks', sub: 'The room sees what you plan today' },
  { key: 'names', label: 'Task names', sub: 'Off shows a count only, like “3 of 7”' },
  { key: 'focus', label: 'When I’m focusing', sub: 'Shows a timer on your card' },
  { key: 'streak', label: 'Streak and level', sub: 'Shown on your card in the room' }
];
export function WhoSeesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [seen, setSeen] = useSeen();
  return (
    <Sheet open={open} onClose={onClose} title="What your room sees" sub="You choose. Changes apply right away." labelId="sx-seen">
      <ul className="sx-switches">
        {SEEN_ROWS.map(r => (
          <li key={r.key} className="sx-switch-row">
            <span className="sx-switch-text"><span className="t-body">{r.label}</span><span className="t-caption c-3">{r.sub}</span></span>
            <button type="button" role="switch" aria-checked={seen[r.key]} aria-label={r.label} className="sx-switch"
                    onClick={() => setSeen(s => ({ ...s, [r.key]: !s[r.key] }))}><span /></button>
          </li>
        ))}
      </ul>
      <p className="sx-note is-sheet"><SIcon name="lock" size={20} className="c-2" />Tasks set to Just me always show as private. Nobody sees the name.</p>
      <button type="button" className="btn-primary sx-wide" onClick={onClose}>Done</button>
    </Sheet>
  );
}

/* ── RP1 · Everyone in the room ─────────────────────────────────────────── */
export function RoomPeople() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { room, loading } = useRoom();
  const me = useMe();
  const mine = useMine();
  const [sees, setSees] = useState(false);
  if (!hydrated || !mine.ready) return <main className="screen on-desk sx-full" aria-busy="true" />;
  if (!room) return loading ? <main className="screen on-desk sx-full" aria-busy="true" /> : <NoRoom />;
  const others = room.members;
  const shown = [...mine.left.slice(0, 1), ...mine.done.slice(0, 1)];
  const more = mine.day.length - shown.length;
  const stack = [me.name, ...others].slice(0, 4);
  const pct = mine.day.length ? (mine.done.length / mine.day.length) * 100 : 0;
  return (
    <main className="screen on-desk sx-full sx-room">
      <RoomHead room={room} />
      <Segment label="Room" value="Today" options={['Today', 'Goals'] as const} onChange={v => v === 'Goals' && router.push(`/people/goals${roomQ(room)}`)} />
      <section className="sx-room-hero" aria-label="Room today">
        <div className="sx-room-hero-text">
          <p className="t-label sx-hero-label">Room today</p>
          <p className="sx-hero-n">{mine.done.length} of {mine.day.length} done</p>
        </div>
        <span className="sx-stack">{stack.map((n, i) => <Avatar key={n + i} name={n} size={32} solid me={i === 0} className="sx-stack-av" />)}</span>
      </section>
      <div className="section-head"><h2 className="t-title-s">People</h2><button type="button" className="t-body-s c-2" onClick={() => setSees(true)}>Who sees what</button></div>

      <article className="sx-pcard">
        <header className="sx-pcard-head">
          <Avatar name={me.name} size={40} solid me />
          <span className="sx-pcard-who">
            <span className="t-title-s">You</span>
            <span className="t-caption c-2 sx-presence">{mine.next ? `Next up at ${clock(mine.next.time!)}` : 'Online'}</span>
          </span>
          <span className="t-body-s">{mine.done.length} of {mine.day.length}</span>
        </header>
        <span className="sx-progress"><span style={{ width: `${pct}%` }} /></span>
        {shown.length > 0 && <ul className="sx-tasks">{shown.map(i => <TaskLine key={i.id} item={i} />)}</ul>}
        <footer className="sx-pcard-foot">
          <span className="t-caption c-3">{more > 0 ? `+ ${more} more` : ''}</span>
          <Link href="/today" className="t-caption c-2">Open my day</Link>
        </footer>
      </article>

      {others.map(name => (
        <article key={name} className="sx-pcard">
          <Link href={`/people/${encodeURIComponent(name)}${roomQ(room)}`} className="sx-pcard-head">
            <Avatar name={name} size={40} solid />
            <span className="sx-pcard-who"><span className="t-title-s">{name}</span></span>
          </Link>
          <footer className="sx-pcard-foot"><span /><CheerNudge room={room} name={name} /></footer>
        </article>
      ))}
      <WhoSeesSheet open={sees} onClose={() => setSees(false)} />
    </main>
  );
}

/* ── RP2 · A friend's day ───────────────────────────────────────────────── */
export function PersonDay() {
  const hydrated = useHydrated();
  const { name: raw } = useParams<{ name: string }>();
  const name = decodeURIComponent(raw);
  const { room } = useRoom();
  const me = useMe();
  const mine = useMine();
  const [tab, setTab] = useState<'Today' | 'Goals'>('Today');
  if (!hydrated || !mine.ready) return <main className="screen on-desk sx-full" aria-busy="true" />;
  const isYou = name === me.name || name.toLowerCase() === 'you';
  const goals = mine.items.filter(i => i.kind === 'goal');
  return (
    <main className="screen on-desk sx-full sx-day">
      <ScreenHeader fallback={room ? `/people${roomQ(room)}` : '/people'}
        actions={room ? <Link href={`/chats/${room.id}`} className="back-btn" aria-label="Open the room chat"><SIcon name="chat" size={20} /></Link> : undefined} />
      <section className="sx-day-who">
        <span className="sx-day-av"><Avatar name={isYou ? me.name : name} size={72} solid me={isYou} /></span>
        <h1 className="t-title-m">{isYou ? 'You' : name}</h1>
      </section>
      {isYou ? <>
        <div className="sx-stats">
          <span className="sx-stat"><span className="sx-stat-n">{mine.done.length} of {mine.day.length}</span><span className="t-caption c-3">Today</span></span>
          <span className="sx-stat"><span className="sx-stat-n">{streak(mine.items)}</span><span className="t-caption c-3">Day streak</span></span>
          <span className="sx-stat"><span className="sx-stat-n">0</span><span className="t-caption c-3">Shared with you</span></span>
        </div>
        <Segment label="Day" value={tab} options={['Today', 'Goals'] as const} onChange={setTab} />
        {tab === 'Today' ? (mine.day.length > 0 && (
          <ul className="sx-tasks sx-day-list">{[...mine.left, ...mine.done].map(i => <TaskLine key={i.id} item={i} />)}</ul>
        )) : (goals.length > 0 && (
          <ul className="sx-tasks sx-day-list">{goals.map(i => <TaskLine key={i.id} item={i} />)}</ul>
        ))}
        <div className="sx-day-actions"><Link href="/today" className="btn-primary sx-wide">Open my day</Link></div>
      </> : room && <CheerNudge room={room} name={name} big />}
    </main>
  );
}

/* ── RP3 · Room goals ───────────────────────────────────────────────────── */
export function RoomGoals() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { room, loading } = useRoom();
  const me = useMe();
  const { items, ready } = useStore();
  if (!hydrated || !ready) return <main className="screen on-desk sx-full" aria-busy="true" />;
  if (!room) return loading ? <main className="screen on-desk sx-full" aria-busy="true" /> : <NoRoom />;
  const goals = items.filter(i => i.kind === 'goal');
  return (
    <main className="screen on-desk sx-full sx-room">
      <RoomHead room={room} />
      <Segment label="Room" value="Goals" options={['Today', 'Goals'] as const} onChange={v => v === 'Today' && router.push(`/people${roomQ(room)}`)} />
      <div className="section-head"><h2 className="t-title-s">Shared goals</h2><span className="t-body-s c-3">{room.goals.length}</span></div>
      {room.goals.map((g, i) => (
        <article key={i} className="sx-goal">
          <div className="sx-goal-top">
            <span className="sx-goal-text">
              <span className="t-title-s">{g.title}</span>
              {g.period && <span className="sx-period">{g.period}</span>}
            </span>
            <span className="sx-stack">{room.members.slice(0, 3).map(n => <Avatar key={n} name={n} size={24} solid className="sx-stack-av" />)}</span>
          </div>
        </article>
      ))}
      <h2 className="t-title-s sx-goals-own">Everyone’s own goals</h2>
      {goals.length > 0 && (
        <ul className="sx-own">
          {goals.map(g => (
            <li key={g.id} className="sx-own-row">
              <Avatar name={me.name} size={32} solid me />
              <span className="sx-own-text"><span className="t-body-s sx-name">{g.title}</span><span className="t-caption c-3">You</span></span>
              <span className="t-body-s">{g.done ? '100%' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
