'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { useHydrated, useLocal } from '@/lib/local';

/* N1 · Notifications (877:125598), N2 · empty (877:125651) and DT9
   (948:27991). An account starts with none: rewards, dares and friends put
   them here (under mylo.profile.notifications.v1) as those arrive. */
export type Note = {
  id: string; title: string; sub?: string; at: string; read?: boolean; href?: string;
  icon: 'gift' | 'streak' | 'layers' | 'bolt' | 'swords' | 'chat'; tone?: 'green' | 'blue' | 'amber' | 'red';
};

const TINT = { green: 'var(--tint-green)', blue: 'var(--tint-blue)', amber: 'var(--tint-amber)', red: 'var(--tint-red)' } as const;

function ago(iso: string) {
  const d = new Date(iso), now = new Date();
  const mins = Math.round((now.getTime() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m`;
  if (mins < 60 * 24 && d.getDate() === now.getDate()) return `${Math.round(mins / 60)}h`;
  if (mins < 60 * 24 * 7) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

function Empty() {
  return (
    <section className="pf-notes-empty" aria-label="All caught up">
      <img src="/figma/profile/mylo-sleepy.svg" alt="" width={125} height={150} className="pf-empty-mylo" />
      <h2 className="pf-empty-title">All caught up</h2>
      <p className="t-body c-2">Rewards, dares and friends show up here.</p>
    </section>
  );
}

export default function Notifications() {
  const hydrated = useHydrated();
  const [notes, setNotes] = useLocal<Note[]>('mylo.profile.notifications.v1', []);
  if (!hydrated) return <main className="screen" aria-busy="true" />;

  const sorted = [...notes].sort((a, b) => b.at.localeCompare(a.at));
  const fresh = sorted.filter(n => !n.read);
  const earlier = sorted.filter(n => n.read);
  const weekAgo = new Date().getTime() - 7 * 864e5;
  const today = new Date().toDateString();
  const open = (id: string) => setNotes(all => all.map(n => n.id === id ? { ...n, read: true } : n));

  const row = (n: Note, desk = false) => {
    const body = <>
      <span className="pf-note-icon" style={{ background: TINT[n.tone ?? 'blue'] }}><Icon name={`profile/${n.icon}`} size={desk ? 20 : 24} /></span>
      <span className="pf-note-text"><span className={desk ? 'pf-note-title' : 't-body'}>{n.title}</span>
        <span className="t-body-s c-2">{[n.sub, desk ? null : ago(n.at)].filter(Boolean).join(' · ')}</span></span>
      {desk && <span className="t-caption c-3">{new Date(n.at).toDateString() === today ? time(n.at) : ago(n.at)}</span>}
      {!n.read && <span className={desk ? 'pf-note-dot is-ink' : 'pf-note-dot'} aria-label="New" />}
    </>;
    return n.href
      ? <Link key={n.id} href={n.href} className={`pf-note${desk && !n.read ? ' is-new' : ''}`} onClick={() => open(n.id)}>{body}</Link>
      : <button key={n.id} type="button" className={`pf-note${desk && !n.read ? ' is-new' : ''}`} onClick={() => open(n.id)}>{body}</button>;
  };

  return (
    <>
      {/* ── Phone: N1, N2 ─────────────────────────────────────────────── */}
      <main className="screen pf-notes only-phone">
        <ScreenHeader title="Notifications" fallback="/today"
                      actions={notes.length ? <Link href="/settings" className="icon-btn pf-icon-40" aria-label="Settings"><Icon name="profile/settings" size={22} /></Link> : undefined} />
        {notes.length === 0 ? <Empty /> : <>
          {fresh.length > 0 && <section><h2 className="t-body-s c-2 pf-notes-h">New</h2>{fresh.map(n => row(n))}</section>}
          {earlier.length > 0 && <section><h2 className="t-body-s c-2 pf-notes-h">Earlier</h2>{earlier.map(n => row(n))}</section>}
        </>}
      </main>

      {/* ── Desktop: DT9 ──────────────────────────────────────────────── */}
      <main className="desk pf-notes-desk only-desk">
        <header className="pf-notes-desk-head">
          <div>
            {/* Held even at none, so the title sits where DT9 draws it. */}
            <p className="t-body-s c-2" style={fresh.length ? undefined : { visibility: 'hidden' }} aria-hidden={!fresh.length}>{fresh.length} new</p>
            <h1 className="desk-greeting">Notifications</h1>
          </div>
          {fresh.length > 0 && (
            <button type="button" className="pf-head-btn" onClick={() => setNotes(all => all.map(n => ({ ...n, read: true })))}>
              <Icon name="check" size={18} />Mark all read
            </button>
          )}
        </header>
        <div className="pf-notes-cols">
          <div className="pf-notes-list">
            {notes.length === 0 ? <div className="empty-day is-big"><Empty /></div> : <>
              {sorted.filter(n => new Date(n.at).toDateString() === today).length > 0 && <h2 className="t-label c-2">Today</h2>}
              {sorted.filter(n => new Date(n.at).toDateString() === today).map(n => row(n, true))}
              {sorted.filter(n => new Date(n.at).toDateString() !== today && new Date(n.at).getTime() > weekAgo).length > 0 && <h2 className="t-label c-2">This week</h2>}
              {sorted.filter(n => new Date(n.at).toDateString() !== today && new Date(n.at).getTime() > weekAgo).map(n => row(n, true))}
              {sorted.filter(n => new Date(n.at).getTime() <= weekAgo).length > 0 && <h2 className="t-label c-2">Earlier</h2>}
              {sorted.filter(n => new Date(n.at).getTime() <= weekAgo).map(n => row(n, true))}
            </>}
          </div>
          <aside className="pf-ping">
            <h2 className="t-body pf-ping-title">How often we ping you</h2>
            <p className="t-body-s c-2">Max 3 non-chat notifications a day. Quiet hours 22:00 to 07:00.</p>
            <Link href="/settings" className="pf-ping-link">Change in Settings</Link>
          </aside>
        </div>
      </main>
    </>
  );
}
