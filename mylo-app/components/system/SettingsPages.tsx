'use client';

import '@/styles/system.css';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useSyncExternalStore } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import Confirm from './Confirm';
import PermissionPrimer from './PermissionPrimer';
import { Group, Row, SectionLabel, Segmented } from './ui';
import {
  BUILD, LANGUAGES, SITE, setDocLang, SUPPORT_EMAIL, VERSION, clearDevice, downloadDeviceData, since,
  usePeople, usePrefs, usePrivacy, useSession, useWords, type Person, type Privacy
} from '@/lib/system';

/* The settings subpages and the bodies DT8 reuses in its right column. */

export function Page({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <main className={`screen on-desk sys-screen ${className}`}>
      <ScreenHeader title={title} fallback="/settings" />
      {children}
    </main>
  );
}

const PROFILE_WHO = ['Friends', 'Rooms', 'Anyone on Mylo'] as const satisfies readonly Privacy['profile'][];
const MESSAGE_WHO = ['Friends', 'Rooms', 'Nobody'] as const satisfies readonly Privacy['message'][];

/* ST2 · Privacy and safety */
export function PrivacyBody() {
  const [p, set] = usePrivacy();
  const [blocked] = usePeople('blocked');
  const [muted] = usePeople('muted');
  return (
    <>
      <SectionLabel>Who can see your profile</SectionLabel>
      <Segmented label="Who can see your profile" options={PROFILE_WHO} value={p.profile} onChange={v => set({ profile: v })} />
      <SectionLabel>Who can message you</SectionLabel>
      <Segmented label="Who can message you" options={MESSAGE_WHO} value={p.message} onChange={v => set({ message: v })} />
      <SectionLabel>Activity</SectionLabel>
      <Group>
        <Row icon="system/eye" label="Show when I am online" toggle={{ on: p.online, onChange: v => set({ online: v }) }} />
        <Row icon="system/check" label="Read receipts" toggle={{ on: p.receipts, onChange: v => set({ receipts: v }) }} />
        <Row icon="system/search" label="Find me by phone number" toggle={{ on: p.findByPhone, onChange: v => set({ findByPhone: v }) }} />
      </Group>
      <SectionLabel>Safety tools</SectionLabel>
      <Group>
        <Row icon="system/ban" label="Blocked people" href="/settings/blocked" value={blocked.length ? String(blocked.length) : undefined} />
        <Row icon="system/minus" label="Muted people" href="/settings/muted" value={muted.length ? String(muted.length) : undefined} />
        <Row icon="system/hash" label="Hidden words" href="/settings/words" />
      </Group>
      <SectionLabel>Your data</SectionLabel>
      <Group>
        <Row icon="system/download" label="Download my data" sub="Goals, posts and chats" href="/settings/data" chevron />
        <Row icon="system/shield" label="How we keep you safe" href={`${SITE}/safety`} external chevron />
      </Group>
    </>
  );
}

/* ST3 · Blocked people, and the same list for muted people. */
const TINTS = ['var(--tint-amber)', 'var(--tint-green)', 'var(--tint-blue)', 'var(--tint-red)'];
export function PeopleBody({ list }: { list: 'blocked' | 'muted' }) {
  const [people, setPeople] = usePeople(list);
  const remove = (p: Person) => setPeople(all => all.filter(x => x.id !== p.id));
  const blocked = list === 'blocked';
  return (
    <>
      {blocked && <p className="sys-intro">They cannot see your profile, posts or message you. They are not told.</p>}
      {people.length > 0 && (
        <ul className="sys-people">
          {people.map((p, i) => (
            <li key={p.id} className="sys-person">
              <span className="sys-person-avatar" style={{ background: TINTS[i % TINTS.length] }} aria-hidden>{p.name.charAt(0).toUpperCase()}</span>
              <span className="sys-person-text">
                <span className="sys-row-label">{p.name}</span>
                <span className="sys-row-sub">{blocked ? 'Blocked' : 'Muted'} {since(p.at)}</span>
              </span>
              <button type="button" className="sys-pill" onClick={() => remove(p)}>{blocked ? 'Unblock' : 'Unmute'}</button>
            </li>
          ))}
        </ul>
      )}
      <p className="sys-tip"><Icon name="system/help" size={24} />{blocked ? 'To block someone, open their profile and tap More.' : 'To mute someone, open their profile and tap More.'}</p>
    </>
  );
}

/* Hidden words, from ST2's Safety tools. */
export function WordsBody() {
  const [words, setWords] = useWords();
  const [draft, setDraft] = useState('');
  const add = () => {
    const w = draft.trim().toLowerCase();
    if (w && !words.includes(w)) setWords([...words, w]);
    setDraft('');
  };
  return (
    <>
      <form className="sys-search" onSubmit={e => { e.preventDefault(); add(); }}>
        <Icon name="system/hash" size={22} />
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a word" aria-label="Add a hidden word" enterKeyHint="done" maxLength={40} />
        {draft.trim() && <button type="submit" className="sys-pill" style={{ height: 32, minWidth: 0 }}>Add</button>}
      </form>
      {words.length > 0 && (
        <ul className="sys-words">
          {words.map(w => (
            <li key={w} className="sys-word">{w}
              <button type="button" aria-label={`Remove ${w}`} onClick={() => setWords(words.filter(x => x !== w))}><Icon name="close" size={14} /></button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/* ST4 · Language */
export function LanguageBody() {
  const [prefs, setPrefs] = usePrefs();
  const [q, setQ] = useState('');
  const shown = LANGUAGES.filter(l => l.label.toLowerCase().includes(q.trim().toLowerCase()));
  const pick = (label: string, lang: string) => { setPrefs({ language: label }); setDocLang(lang); };
  return (
    <>
      <label className="sys-search">
        <Icon name="system/search" size={22} />
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search languages" aria-label="Search languages" />
      </label>
      <div className="sys-langs" role="radiogroup" aria-label="Language">
        {shown.map(l => (
          <button key={l.label} type="button" role="radio" aria-checked={prefs.language === l.label} className="sys-lang" lang={l.lang}
                  onClick={() => pick(l.label, l.lang)}>
            {l.label}{prefs.language === l.label && <Icon name="system/check" size={24} />}
          </button>
        ))}
        {shown.length === 0 && <p className="sys-empty-line">No match for “{q.trim()}”</p>}
      </div>
    </>
  );
}

/* ST5 · Help and feedback */
export function HelpBody() {
  return (
    <>
      <Group>
        <Row icon="system/book" label="Help centre" sub="Answers to common questions" href={`${SITE}/help`} external chevron />
        <Row icon="system/alert" label="Report a bug" sub="Something not working?" href="/report-a-bug" chevron />
        <Row icon="system/sparkle" label="Suggest a feature" sub="Tell us what to build next" href={`${SITE}/roadmap`} external chevron />
        <Row icon="system/mail" label="Contact us" sub="A real person replies" href={`mailto:${SUPPORT_EMAIL}`} external chevron />
      </Group>
      <Group>
        <Row icon="system/shield" label="Community guidelines" href={`${SITE}/safety`} external chevron />
        <Row icon="system/flag" label="Safety centre" href={`${SITE}/safety`} external chevron />
      </Group>
    </>
  );
}

/* ST6 · About */
export function AboutBody() {
  return (
    <>
      <div className="sys-about">
        <img className="sys-about-icon" src="/brand/mylo-logo-512.webp" alt="" width={100} height={100} />
        <p className="sys-about-name">Mylo</p>
        <p className="sys-about-ver">Version {VERSION} (build {BUILD})</p>
      </div>
      <Group>
        <Row icon="system/file" label="Terms of service" href={`${SITE}/terms`} external chevron />
        <Row icon="system/lock" label="Privacy policy" href={`${SITE}/privacy`} external chevron />
        <Row icon="system/layers" label="Open source licences" href="/settings/licences" />
        <Row icon="system/star" label="Rate Mylo" href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Rating Mylo')}`} external chevron />
      </Group>
    </>
  );
}

const LICENCES = [
  ['Next.js', 'MIT'], ['React', 'MIT'], ['React DOM', 'MIT'], ['Supabase JS', 'MIT'], ['Figtree', 'SIL Open Font License 1.1']
];
export function LicencesBody() {
  return (
    <Group>
      {LICENCES.map(([name, licence]) => <Row key={name} label={name} value={licence} />)}
    </Group>
  );
}

/* Notifications: the reminder switches from DT8, behind S3's primer until
   the browser allows notifications. */
const subscribeNone = () => () => {};
function notifState() { return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission; }
export function NotificationsBody() {
  const [prefs, setPrefs] = usePrefs();
  const live = useSyncExternalStore(subscribeNone, notifState, () => 'default');
  const [perm, setPerm] = useState<string | null>(null);
  const state = perm ?? live;
  const [primer, setPrimer] = useState(false);
  const r = prefs.reminders;
  const flip = (k: keyof typeof r) => (v: boolean) => {
    if (v && state !== 'granted' && state !== 'unsupported') setPrimer(true);
    setPrefs({ reminders: { ...r, [k]: v } });
  };
  return (
    <>
      {state !== 'granted' && state !== 'unsupported' && (
        <Group>
          <Row icon="system/bell" label="Turn on notifications" sub="Small reminders at the times you pick." onClick={() => setPrimer(true)} chevron />
        </Group>
      )}
      <SectionLabel>Reminders</SectionLabel>
      <Group>
        <Row label="Task reminders" sub="At the task time or anchor" toggle={{ on: r.task, onChange: flip('task') }} />
        <Row label="Evening wrap" sub="21:30 when tasks are left" toggle={{ on: r.evening, onChange: flip('evening') }} />
        <Row label="Quiet hours" sub="22:00 to 07:00" toggle={{ on: r.quiet, onChange: v => setPrefs({ reminders: { ...r, quiet: v } }) }} />
        <Row label="Friend activity" sub="When someone ticks a shared task" toggle={{ on: r.friends, onChange: flip('friends') }} />
      </Group>
      <PermissionPrimer kind="notifications" open={primer} onClose={() => setPrimer(false)}
                        onResult={res => setPerm(res.state === 'granted' ? 'granted' : res.state === 'denied' ? 'denied' : null)} />
    </>
  );
}

/* ST13 · Your data */
export function DataBody() {
  const { user } = useSession();
  const [clear, setClear] = useState(false);
  return (
    <>
      <button type="button" className="sys-box" onClick={() => { downloadDeviceData(user ? { account: { id: user.id, email: user.email } } : undefined); }}>
        <Icon name="system/download" size={24} />
        <span className="sys-box-text"><span className="sys-box-label">Download my data</span><span className="sys-box-sub">Everything, as a file</span></span>
        <Icon name="system/chevron" size={20} className="sys-row-chev" />
      </button>
      <Link href="/journal" className="sys-box">
        <Icon name="system/lock" size={24} />
        <span className="sys-box-text"><span className="sys-box-label">Journal lock</span></span>
        <Icon name="system/chevron" size={20} className="sys-row-chev" />
      </Link>
      <Link href="/ai" className="sys-box">
        <Icon name="system/brain" size={24} />
        <span className="sys-box-text"><span className="sys-box-label">Mylo AI memory</span><span className="sys-box-sub">What Mylo remembers about you</span></span>
        <Icon name="system/chevron" size={20} className="sys-row-chev" />
      </Link>
      <button type="button" className="sys-box" onClick={() => setClear(true)}>
        <Icon name="system/trash" size={24} />
        <span className="sys-box-text"><span className="sys-box-label">Clear AI memory</span><span className="sys-box-sub">Mylo forgets your chats</span></span>
        <Icon name="system/chevron" size={20} className="sys-row-chev" />
      </button>
      <Link href="/settings/delete" className="sys-danger-card">
        <strong>Delete account</strong>
        <span>Removes you, your Mylo and your photos. Friends keep nothing. You have 30 days to change your mind.</span>
      </Link>
      <Confirm open={clear} title="Clear AI memory?" body="Mylo forgets your chats." confirmLabel="Clear AI memory" cancelLabel="Cancel"
               onCancel={() => setClear(false)} onConfirm={() => { clearDevice('mylo.ai.'); setClear(false); }} />
    </>
  );
}

/* Redirects to /signin when an account screen opens with no session. */
export function useNeedsAccount() {
  const s = useSession();
  const router = useRouter();
  useEffect(() => {
    if (s.ready && !s.user) router.replace('/signin');
  }, [s.ready, s.user, router]);
  return s;
}
