'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { addDays, clock, fromIso, iso, shortDate } from '@/lib/dates';
import { useSession } from '@/lib/session';
import { useStore, type Item } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { Screen } from './ui';
import { canGoBack, goBack, stampNav } from '@/components/NavMotion';

/* X3 Search (597:53531): the person's own tasks and goals, the rooms they
   are in, and people by name or username. Nothing shows until they type. */
type Room = { id: string; title: string };
type Person = { id: string; username: string | null; display_name: string | null };
const FACE = ['#E8A23A', '#4BA37A', '#9B6BD6', '#5B8DEF'];
const faceFor = (id: string) => FACE[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % FACE.length];

function dayLabel(day: string) {
  const now = new Date();
  if (day === iso(now)) return 'Today';
  if (day === iso(addDays(now, 1))) return 'Tomorrow';
  if (day === iso(addDays(now, -1))) return 'Yesterday';
  return shortDate(fromIso(day));
}
function meta(i: Item) {
  if (i.kind === 'goal') return 'Goal';
  if (i.kind === 'system') return 'System';
  return [dayLabel(i.date), i.time ? clock(i.time) : null].filter(Boolean).join('  ·  ');
}

export default function Search() {
  const router = useRouter();
  const { items } = useStore();
  const { user } = useSession();
  const [q, setQ] = useState('');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [found, setFound] = useState<{ q: string; people: Person[] }>({ q: '', people: [] });
  const term = q.trim().toLowerCase();

  // The rooms this person is in, once.
  useEffect(() => {
    if (!user) return;
    let live = true;
    supabase().from('room_members').select('room_id, archived_at, rooms(id, title)').eq('user_id', user.id)
      .then(({ data }) => {
        if (!live || !data) return;
        const list = (data as unknown as { archived_at: string | null; rooms: Room | Room[] | null }[])
          .filter(r => !r.archived_at)
          .flatMap(r => (Array.isArray(r.rooms) ? r.rooms : r.rooms ? [r.rooms] : []))
          .filter(r => r.title);
        setRooms(list);
      });
    return () => { live = false; };
  }, [user]);

  // People by name, a moment after typing stops.
  useEffect(() => {
    const safe = term.replace(/[^a-z0-9_ .-]/g, '');
    if (!user || safe.length < 2) return;
    const t = window.setTimeout(() => {
      supabase().from('profiles').select('id, username, display_name')
        .or(`username.ilike.%${safe}%,display_name.ilike.%${safe}%`).neq('id', user.id).limit(5)
        .then(({ data }) => setFound({ q: term, people: (data as Person[] | null) ?? [] }));
    }, 220);
    return () => window.clearTimeout(t);
  }, [term, user]);

  const tasks = useMemo(() => (term ? items.filter(i => i.title.toLowerCase().includes(term)).slice(0, 8) : []), [items, term]);
  const myRooms = term ? rooms.filter(r => r.title.toLowerCase().includes(term)).slice(0, 6) : [];
  const people = term && found.q === term ? found.people : [];
  const nothing = term && !tasks.length && !myRooms.length && !people.length;

  const cancel = () => {
    if (canGoBack()) { goBack(router); return; }
    stampNav('pop'); router.push('/today');
  };
  return (
    <Screen className="si-search">
      <form className="si-search-top" role="search" onSubmit={e => {
        // Enter opens the first thing found.
        e.preventDefault();
        const first = document.querySelector<HTMLAnchorElement>('.si-search .si-result');
        if (first) first.click();
      }}>
        <label className="si-search-field">
          <Icon name="search" size={20} />
          <span className="sr-only">Search</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)} autoFocus enterKeyHint="search" placeholder="Search"
                 onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); if (q) setQ(''); else cancel(); } }} />
        </label>
        <button type="button" className="t-body-s si-search-cancel" onClick={cancel}>Cancel</button>
      </form>

      {tasks.length > 0 && <>
        <h2 className="t-label c-3 si-search-label">TASKS</h2>
        <div className="si-results">
          {tasks.map(i => (
            <Link key={i.id} href={i.kind === 'goal' ? `/goals/${i.id}` : '/today'} className="si-result">
              <span className="si-result-tile is-green"><Icon name="signin/i-check" size={16} /></span>
              <span className="si-result-text"><span className="t-body">{i.title}</span><span className="t-caption c-3">{meta(i)}</span></span>
            </Link>
          ))}
        </div>
      </>}

      {myRooms.length > 0 && <>
        <h2 className="t-label c-3 si-search-label">ROOMS</h2>
        <div className="si-results">
          {myRooms.map(r => (
            <Link key={r.id} href={`/rooms/${r.id}`} className="si-result">
              <span className="si-result-tile is-blue"><Icon name="signin/i-room" size={16} /></span>
              <span className="si-result-text"><span className="t-body">{r.title}</span><span className="t-caption c-3">Your room</span></span>
            </Link>
          ))}
        </div>
      </>}

      {people.length > 0 && <>
        <h2 className="t-label c-3 si-search-label">PEOPLE</h2>
        <div className="si-results">
          {people.map(p => {
            const name = p.display_name || p.username || '';
            return (
              <Link key={p.id} href={p.username ? `/u/${p.username}` : '/people'} className="si-result">
                <span className="si-result-face" style={{ background: faceFor(p.id) }}>{name.charAt(0).toUpperCase()}</span>
                <span className="si-result-text"><span className="t-body">{name}</span>{p.username && <span className="t-caption c-3">@{p.username}</span>}</span>
              </Link>
            );
          })}
        </div>
      </>}

      {!term && <p className="t-body-s c-3 si-search-none">Find your tasks and goals{user ? ', your rooms and people' : ''}.</p>}
      {nothing && <p className="t-body c-2 si-search-none">Nothing matches &ldquo;{q.trim()}&rdquo;.</p>}
    </Screen>
  );
}
