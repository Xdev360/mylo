'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import QuickTodo from '@/components/QuickTodo';
import Mylo from './Mylo';
import { Switch, WorldHeader, WorldPage, wi } from './ui';
import { useLocal } from '@/lib/local';
import { onDay, streak, useStore } from '@/lib/store';
import { dayLetter, greeting, iso, longDate, thisWeek, todayIso } from '@/lib/dates';
import { KEYS, useLook, usePhoneIsDark, useTheme } from '@/lib/world';

/* ── T3 App theme (879:192869) ─────────────────────────────────────────────
   Classic and Dark really switch the app: the choice is kept and stamped as
   data-theme on <html>. "Follow the phone" clears the stamp. The four drawn
   themes unlock with levels, which the server gives, so they are previews. */
const APP_THEMES = [
  { id: 'light', label: 'Classic', art: 'classic' },
  { id: 'dark', label: 'Dark', art: 'dark' },
  { id: 'blush', label: 'Blush', art: 'blush', locked: 'Blush unlocks at Kindle', preview: '/themes/blush' },
  { id: 'gym', label: 'Gym', art: 'gym', locked: 'Gym unlocks as you level up', preview: '/themes/gym' },
  { id: 'study', label: 'Study', art: 'study', locked: 'Study unlocks as you level up' },
  { id: 'ocean', label: 'Ocean', art: 'ocean', locked: 'Ocean unlocks as you level up' }
] as const;

export function AppTheme() {
  return <WorldPage className="w-themes"><AppThemeBody /></WorldPage>;
}
function AppThemeBody() {
  const router = useRouter();
  const [theme, setTheme] = useTheme();
  const phoneDark = usePhoneIsDark();
  const shown = theme === 'system' ? (phoneDark ? 'dark' : 'light') : theme;
  const [pick, setPick] = useState<string>(shown);
  const t = APP_THEMES.find(x => x.id === pick) ?? APP_THEMES[0];
  const locked = 'locked' in t ? t.locked : null;
  const inUse = !locked && theme !== 'system' && theme === t.id;
  const act = () => {
    if (locked) { if ('preview' in t) router.push(t.preview); return; }
    setTheme(t.id as 'light' | 'dark');
  };
  return (
    <>
      <WorldHeader title="App theme" fallback="/settings" />
      <div className="w-banner">
        <Icon name={wi('crown')} size={24} className="w-purple" />
        <span><span className="t-body-s c-ink w-block">Themes unlock as you level up</span><span className="t-caption c-2">No payment needed at launch</span></span>
      </div>
      <div className="w-follow">
        <span className="t-body c-ink w-grow">Follow the phone</span>
        <Switch on={theme === 'system'} label="Follow the phone" onChange={v => { setTheme(v ? 'system' : (shown as 'light' | 'dark')); setPick(shown); }} />
      </div>
      <div className="w-theme-grid" role="radiogroup" aria-label="App theme">
        {APP_THEMES.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={pick === x.id} className={`w-theme${pick === x.id ? ' is-on' : ''}`} onClick={() => setPick(x.id)}>
            <span className="w-theme-art"><img src={`/figma/world/theme/app-${x.art}.svg`} alt="" /></span>
            <span className="w-theme-label"><span className="t-body">{x.label}</span>{'locked' in x && <Icon name={wi('crown')} size={18} className="w-purple" />}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary w-wide w-sticky" onClick={act} disabled={inUse || (!!locked && !('preview' in t))}>
        {locked ?? (inUse ? 'In use' : `Use ${t.label}`)}
      </button>
    </>
  );
}

/* ── T1 Chat theme (879:193054) ──────────────────────────────────────────
   Kept as the default for chats; a room can pass its name to show who else
   sees it (?name=). */
const CHAT_THEMES = [
  { id: 'default', label: 'Default' }, { id: 'midnight', label: 'Midnight' }, { id: 'blush', label: 'Blush' },
  { id: 'iron', label: 'Iron' }, { id: 'garden', label: 'Garden' }, { id: 'sunset', label: 'Sunset' }
];
export function ChatTheme({ room }: { room?: string }) {
  return <WorldPage className="w-themes"><ChatThemeBody room={room} /></WorldPage>;
}
function ChatThemeBody({ room }: { room?: string }) {
  const [saved, setSaved] = useLocal<string>(KEYS.chatTheme, 'default');
  const [pick, setPick] = useState(saved);
  const t = CHAT_THEMES.find(x => x.id === pick)!;
  return (
    <>
      <WorldHeader title="Chat theme" fallback="/chats" />
      {room && <p className="t-body c-2 w-center w-lede">{room} sees it too.</p>}
      <div className="w-theme-grid" role="radiogroup" aria-label="Chat theme">
        {CHAT_THEMES.map(x => (
          <button key={x.id} type="button" role="radio" aria-checked={pick === x.id} className={`w-theme is-chat${pick === x.id ? ' is-on' : ''}`} onClick={() => setPick(x.id)}>
            <span className="w-theme-art"><img src={`/figma/world/theme/chat-${x.id}.svg`} alt="" /></span>
            <span className="t-body w-center">{x.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary w-wide w-sticky" onClick={() => setSaved(pick)} disabled={saved === pick}>
        {saved === pick ? 'In use' : `Use ${t.label}`}
      </button>
    </>
  );
}

/* ── T4 Today · Blush theme (879:193176), T5 Today · Gym theme (879:193486)
   The person's own Today, dressed in the theme they are working toward. */
export function SkinPreview({ skin }: { skin: 'blush' | 'gym' }) {
  return <WorldPage className={`w-skin w-skin-${skin}`} tabs><SkinBody /></WorldPage>;
}
function SkinBody() {
  const { items } = useStore();
  const [look] = useLook();
  const now = useMemo(() => new Date(), []);
  const today = todayIso();
  const mine = onDay(items, today);
  const left = mine.filter(i => !i.done).length, done = mine.length - left;
  const pct = mine.length ? Math.round((done / mine.length) * 100) : 0;
  const n = streak(items);
  return (
    <>
      <span className="w-skin-pattern" aria-hidden />
      <header className="today-top">
        <Link href="/themes" className="back-btn" aria-label="Back"><Icon name={wi('back')} size={20} /></Link>
        <div className="today-top-right">
          <span className="streak w-skin-streak"><Icon name="flame" size={16} /><span className="t-title-s">{n}</span></span>
        </div>
      </header>
      <div className="today-hello">
        <p className="t-body-s c-2">{longDate(now)}</p>
        <h1 className="today-greeting">{greeting(now)}</h1>
        <p className="t-body c-2">{left} left today.</p>
      </div>
      <section className="card week-card w-skin-card" aria-label="This week">
        <div className="week">
          {thisWeek(now).map(d => {
            const ds = onDay(items, iso(d)); const isT = iso(d) === today;
            const dot = isT ? 'today' : !ds.length ? 'empty' : ds.every(i => i.done) ? 'done' : 'part';
            return (
              <span key={iso(d)} className={`day${isT ? ' is-today' : ''}`}>
                <span className="t-caption day-d">{dayLetter(d)}</span><span className="day-n">{d.getDate()}</span><span className={`day-dot dot-${dot}`} />
              </span>
            );
          })}
        </div>
      </section>
      <section className="hero-card w-skin-hero" aria-label="Today, live">
        <div className="hero-text">
          <p className="t-label hero-live"><span className="live-dot" />Today · Live</p>
          <p className="hero-count"><span className="t-display">{left}</span><span className="t-body">tasks left</span></p>
          <p className="hero-chips"><span className="hero-chip t-caption"><Icon name="check-circle" size={16} />{done} of {mine.length} done</span></p>
        </div>
        <Mylo look={look} size={112} className="w-skin-mylo" />
      </section>
      <section className="card progress w-skin-card">
        <div className="section-head"><h2 className="t-title-s">Today’s progress</h2><span className="t-body c-2">{pct}%</span></div>
        <div className="bar"><span className="bar-fill" style={{ width: `${pct}%` }} /></div>
        <p className="t-body-s c-2">You {done} of {mine.length}</p>
      </section>
      <QuickTodo />
    </>
  );
}
