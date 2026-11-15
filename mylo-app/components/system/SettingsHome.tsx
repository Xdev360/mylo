'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useSyncExternalStore } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import { supabase } from '@/lib/supabase';
import { VERSION, haptic, shortEmail, usePeople, usePrefs, useProfile, useSession, whoIs } from '@/lib/system';
import Confirm, { CONFIRMS } from './Confirm';
import PermissionPrimer from './PermissionPrimer';
import { AboutBody, HelpBody, LanguageBody, NotificationsBody, PeopleBody, PrivacyBody } from './SettingsPages';
import { Group, Row, SectionLabel, Toggle } from './ui';

/* ST1 · Settings on a phone (877:125671), DT8 · Settings on a wide screen
   (948:27826). ST9 is ST1 with the log out confirm open (/settings/logout). */

function subscribeTheme(cb: () => void) {
  const m = new MutationObserver(cb);
  m.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  return () => m.disconnect();
}
function themeLabel() {
  const t = document.documentElement.dataset.theme;
  return t === 'dark' ? 'Dark' : t === 'light' ? 'Light' : 'System';
}
const none = () => () => {};
function deviceZone() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return ''; } }
let ZONES: string[] | null = null;
function zones(): string[] {
  if (ZONES) return ZONES;
  try { ZONES = (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone'); } catch { ZONES = []; }
  return ZONES;
}

export default function SettingsHome({ logout = false }: { logout?: boolean }) {
  const router = useRouter();
  const { user } = useSession();
  const profile = useProfile(user);
  const who = whoIs(user, profile);
  const [prefs, setPrefs] = usePrefs();
  const [blocked] = usePeople('blocked');
  const theme = useSyncExternalStore(subscribeTheme, themeLabel, () => '');
  const zone = useSyncExternalStore(none, deviceZone, () => '');
  const [confirm, setConfirm] = useState(logout);
  const [busy, setBusy] = useState(false);
  const [primer, setPrimer] = useState(false);
  const [tab, setTab] = useState<'account' | 'notifications' | 'privacy' | 'safety' | 'devices' | 'appearance' | 'help'>('account');

  const acct = (path: string) => (user ? path : '/signin');
  const askLogout = () => (user ? setConfirm(true) : router.push('/signin'));
  const closeLogout = () => { setConfirm(false); if (logout) router.replace('/settings'); };
  const doLogout = async () => {
    setBusy(true);
    try { await supabase().auth.signOut(); } finally { setBusy(false); setConfirm(false); router.push('/welcome'); }
  };
  const r = prefs.reminders;
  const flip = (k: keyof typeof r) => (v: boolean) => {
    if (v && k !== 'quiet' && typeof Notification !== 'undefined' && Notification.permission === 'default') setPrimer(true);
    setPrefs({ reminders: { ...r, [k]: v } });
  };
  const timezone = prefs.timezone || zone;
  const language = prefs.language.split(' (')[0];

  const meCard = (
    <Link href={user ? '/profile/edit' : '/signin'} className="sys-me">
      <span className="sys-avatar" aria-hidden>{user ? who.initial : <Icon name="system/mylo" size={26} />}</span>
      <span className="sys-me-text">
        <span className="sys-me-name">{user ? who.name : 'Sign in'}</span>
        <span className="sys-me-sub">{user ? `${who.handle ? `@${who.handle} · ` : ''}Edit profile` : 'Save your Mylo'}</span>
      </span>
      <Icon name="system/chevron" size={24} className="sys-row-chev" />
    </Link>
  );

  const NAV = [
    ['account', 'Account', 'system/user'], ['notifications', 'Notifications', 'system/bell'], ['privacy', 'Privacy', 'system/lock'],
    ['safety', 'Safety', 'system/shield'], ['devices', 'Devices', 'system/devices'], ['appearance', 'Appearance', 'system/sun'], ['help', 'Help', 'system/book']
  ] as const;

  return (
    <>
      {/* ── Phone: ST1 ─────────────────────────────────────────────────── */}
      <main className="screen sys-screen only-phone">
        <ScreenHeader title="Settings" fallback="/profile" />
        {meCard}
        <SectionLabel>Account</SectionLabel>
        <Group>
          <Row icon="system/mail" label="Email" href={acct('/settings/email')} value={shortEmail(user?.email) || undefined} />
          <Row icon="system/key" label="Password" href={acct('/settings/password')} />
          <Row icon="system/phone" label="Phone number" href={acct('/settings/phone')} />
        </Group>
        <SectionLabel>Preferences</SectionLabel>
        <Group>
          <Row icon="system/bell" label="Notifications" href="/settings/notifications" />
          <Row icon="system/moon" label="Appearance" href="/themes" value={theme || undefined} />
          <Row icon="system/globe" label="Language" href="/settings/language" value={language} />
          <Row icon="system/bolt" label="Haptics" toggle={{ on: prefs.haptics, onChange: v => { setPrefs({ haptics: v }); if (v) haptic(15); } }} />
          <Row icon="system/music" label="Sounds" toggle={{ on: prefs.sounds, onChange: v => setPrefs({ sounds: v }) }} />
        </Group>
        <SectionLabel>Safety</SectionLabel>
        <Group>
          <Row icon="system/shield" label="Privacy and safety" href="/settings/privacy" />
          <Row icon="system/ban" label="Blocked people" href="/settings/blocked" value={blocked.length ? String(blocked.length) : undefined} />
        </Group>
        <SectionLabel>Support</SectionLabel>
        <Group>
          <Row icon="system/help" label="Help and feedback" href="/settings/help" />
          <Row icon="system/mylo" label="About Mylo" href="/settings/about" />
        </Group>
        <Group>
          <Row icon="system/logout" label="Log out" danger onClick={askLogout} />
          <Row icon="system/trash" label="Delete account" danger href="/settings/delete" />
        </Group>
        <p className="sys-foot">Mylo {VERSION}</p>
      </main>

      {/* ── Desktop: DT8 ───────────────────────────────────────────────── */}
      <main className="dt8 only-desk">
        <h1 className="dt8-title">Settings</h1>
        <div className="dt8-cols">
          <nav className="dt8-nav" aria-label="Settings">
            {NAV.map(([id, label, icon]) => (
              <button key={id} type="button" aria-current={tab === id} onClick={() => setTab(id)}><Icon name={icon} size={18} />{label}</button>
            ))}
          </nav>
          <div className="dt8-main">
            {tab === 'account' && (
              <>
                <section className="dt8-card" aria-labelledby="dt8-account">
                  <h2 id="dt8-account" className="dt8-card-head">Account</h2>
                  <DeskRow label="Name" value={user ? who.name : ''} href={user ? '/profile/edit' : '/signin'} />
                  <DeskRow label="Email" value={user?.email ?? ''} href={acct('/settings/email')} />
                  <DeskRow label="Phone" value={user?.phone_confirmed_at ? 'Verified' : user?.phone ?? ''} href={acct('/settings/phone')} />
                  <label className="dt8-row">
                    <span className="dt8-row-text"><span className="dt8-row-label">Time zone</span></span>
                    <span className="dt8-row-value">{timezone}</span>
                    <Icon name="system/chevron" size={16} />
                    <select aria-label="Time zone" value={timezone} onChange={e => setPrefs({ timezone: e.target.value === zone ? undefined : e.target.value })}>
                      {(zone && zones().length ? zones() : [timezone]).map(z => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </label>
                </section>
                <section className="dt8-card" aria-labelledby="dt8-reminders">
                  <h2 id="dt8-reminders" className="dt8-card-head">Reminders</h2>
                  <DeskToggle label="Task reminders" sub="At the task time or anchor" on={r.task} onChange={flip('task')} />
                  <DeskToggle label="Evening wrap" sub="21:30 when tasks are left" on={r.evening} onChange={flip('evening')} />
                  <DeskToggle label="Quiet hours" sub="22:00 to 07:00" on={r.quiet} onChange={flip('quiet')} />
                  <DeskToggle label="Friend activity" sub="When someone ticks a shared task" on={r.friends} onChange={flip('friends')} />
                </section>
                <section className="dt8-danger">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong>Delete account</strong>
                    <span>30 day grace period, then everything is removed.</span>
                  </div>
                  <Link href="/settings/delete">Delete</Link>
                </section>
                {user && (
                  <section className="dt8-card">
                    <DeskRow label="Password" value="" href="/settings/password" />
                    <button type="button" className="dt8-row" onClick={askLogout}>
                      <span className="dt8-row-text"><span className="dt8-row-label" style={{ color: 'var(--red)' }}>Log out</span></span>
                    </button>
                  </section>
                )}
              </>
            )}
            {tab === 'notifications' && <div className="dt8-body"><NotificationsBody /></div>}
            {tab === 'privacy' && <div className="dt8-body"><PrivacyBody /></div>}
            {tab === 'safety' && (
              <div className="dt8-body">
                <SectionLabel>Blocked people</SectionLabel>
                <PeopleBody list="blocked" />
                <SectionLabel>Safety tools</SectionLabel>
                <Group>
                  <Row icon="system/minus" label="Muted people" href="/settings/muted" />
                  <Row icon="system/hash" label="Hidden words" href="/settings/words" />
                </Group>
              </div>
            )}
            {tab === 'devices' && (
              <div className="dt8-body">
                <Group>
                  <Row icon="system/devices" label="Put Mylo on your home screen" href="/install" />
                  <Row icon="system/download" label="Download my data" sub="Everything, as a file" href="/settings/data" chevron />
                </Group>
              </div>
            )}
            {tab === 'appearance' && (
              <div className="dt8-body">
                <Group><Row icon="system/moon" label="Appearance" href="/themes" value={theme || undefined} /></Group>
                <SectionLabel>Language</SectionLabel>
                <LanguageBody />
              </div>
            )}
            {tab === 'help' && <div className="dt8-body"><HelpBody /><AboutBody /></div>}
          </div>
        </div>
      </main>

      <Confirm open={confirm} {...CONFIRMS.logOut()} busy={busy} onCancel={closeLogout} onConfirm={doLogout} />
      <PermissionPrimer kind="notifications" open={primer} onClose={() => setPrimer(false)} />
    </>
  );
}

function DeskRow({ label, value, href }: { label: string; value: string; href: string }) {
  return (
    <Link href={href} className="dt8-row">
      <span className="dt8-row-text"><span className="dt8-row-label">{label}</span></span>
      {value && <span className="dt8-row-value">{value}</span>}
      <Icon name="system/chevron" size={16} />
    </Link>
  );
}

function DeskToggle({ label, sub, on, onChange }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="dt8-row">
      <span className="dt8-row-text"><span className="dt8-row-label">{label}</span><span className="dt8-row-sub">{sub}</span></span>
      <Toggle size="s" on={on} onChange={onChange} label={label} />
    </div>
  );
}
