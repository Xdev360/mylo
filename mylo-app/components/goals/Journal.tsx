'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '../Icon';
import ScreenHeader from '../ScreenHeader';
import Sheet from '../Sheet';
import { Confetti } from './Moments';
import { useHydrated } from '@/lib/local';
import { fromIso, iso, todayIso, weekdayName } from '@/lib/dates';
import { JOURNAL_TAGS, MOODS, nightsInRow, useJournal, useLock, weekOf, type Entry, type Mood } from '@/lib/goals';

/* J1 How was today, J2 Saved · streak, J3 Journal entry, J4 Journal locked.
   One entry a day: a mood, what made it so, a line and maybe a photo. Only
   on this device, and behind a passcode (and Face ID where the device has
   it) once locked. */
const sticker = (m: Mood) => `/figma/goals/sticker-${m}.svg`;
const longDay = (d: Date) => `${weekdayName(d)} ${d.getDate()} ${d.toLocaleDateString('en-GB', { month: 'long' })}`;

/* Photos are kept small: 1200px on the long side, as a JPEG. */
function shrink(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, 1200 / Math.max(img.width, img.height));
      const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src); resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ── J1 · How was today ─────────────────────────────────────────────────── */
export function JournalForm() {
  const ready = useHydrated();
  return ready ? <Gate><Form /></Gate> : <main className="screen on-desk" aria-busy="true" />;
}
function Form() {
  const q = useSearchParams();
  const router = useRouter();
  const [journal, setJournal] = useJournal();
  const day = q.get('day') && q.get('day')! <= todayIso() ? q.get('day')! : todayIso();
  const was = journal[day];
  const [mood, setMood] = useState<Mood | undefined>(was?.mood);
  const [tags, setTags] = useState<string[]>(was?.tags ?? []);
  const [line, setLine] = useState(was?.line ?? '');
  const [photo, setPhoto] = useState(was?.photo);
  const [err, setErr] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const d = fromIso(day);
  const now = new Date();
  const stamp = day === todayIso() ? `${weekdayName(d)}, ${now.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true }).toLowerCase()}` : longDay(d);

  function save() {
    const entry: Entry = { mood, tags, line: line.trim(), photo, at: new Date().toISOString() };
    try { setJournal(j => ({ ...j, [day]: entry })); } catch { setErr(true); return; }
    router.push(was ? `/journal?day=${day}` : '/journal/saved');
  }

  return (
    <main className="screen on-desk g-jform">
      <ScreenHeader fallback="/journal" />
      <div className="g-jform-head">
        <p className="t-body-s c-2 g-600">{stamp}</p>
        <h1 className="g-h28">How was today?</h1>
      </div>
      <div className="g-moods5" role="radiogroup" aria-label="How was today?">
        {MOODS.map(m => (
          <button key={m.id} type="button" role="radio" aria-checked={mood === m.id} className="g-mood5" onClick={() => setMood(m.id)}>
            <img src={sticker(m.id)} alt="" width={60} height={60} /><span>{m.label}</span>
          </button>
        ))}
      </div>
      <h2 className="g-h15">What made it that way?</h2>
      <div className="g-wrap">
        {JOURNAL_TAGS.map(t => (
          <button key={t} type="button" className="g-jtag" aria-pressed={tags.includes(t)} onClick={() => setTags(x => x.includes(t) ? x.filter(y => y !== t) : [...x, t])}>{t}</button>
        ))}
      </div>
      <label className="g-h15" htmlFor="g-jline1">One line about it</label>
      <textarea id="g-jline1" className="g-jinput" rows={3} value={line} onChange={e => setLine(e.target.value)} placeholder="Beat my 5k time and Tobi bought lunch." />
      {photo ? (
        <div className="g-jphoto-wrap">
          <img className="g-jphoto" src={photo} alt="Your photo for the day" />
          <button type="button" className="icon-btn g-jphoto-x" aria-label="Remove photo" onClick={() => setPhoto(undefined)}><Icon name="close" size={19} /></button>
        </div>
      ) : (
        <button type="button" className="g-addphoto" onClick={() => file.current?.click()}><Icon name="goals/camera" size={24} />Add a photo</button>
      )}
      <input ref={file} type="file" accept="image/*" hidden onChange={async e => { const f = e.target.files?.[0]; if (f) setPhoto(await shrink(f)); e.target.value = ''; }} />
      {err && <p className="t-body-s" style={{ color: 'var(--red)' }}>Couldn’t save on this device.</p>}
      <button type="button" className="g-btn-ink" onClick={save}>Save today</button>
    </main>
  );
}

/* ── J2 · Saved · streak ────────────────────────────────────────────────── */
const PIECES = Array.from({ length: 20 }, (_, i) => ({
  x: 34 + ((i * 71) % 318), y: 96 + ((i * 43) % 147), r: (i * 47) % 360, dot: false,
  c: ['var(--red)', '#F5B83D', 'var(--green)', 'var(--ink)'][i % 4]
}));
export function JournalSaved() {
  const ready = useHydrated();
  const [journal] = useJournal();
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;
  const today = todayIso();
  const n = nightsInRow(journal);
  const week = weekOf();
  const all = week.filter(d => iso(d) <= today).every(d => journal[iso(d)]);
  return (
    <main className="screen on-desk g-moment g-saved g-no-tabs">
      <Confetti pieces={PIECES} />
      <header className="g-moment-nav is-right"><Link href="/today" className="back-btn" aria-label="Close"><Icon name="close" size={20} /></Link></header>
      <img className="g-saved-sticker" src={sticker(journal[today]?.mood ?? 'good')} alt="" width={170} height={170} />
      <p className="t-body-s c-2 g-600">Saved</p>
      <h1 className="g-h28">{n} {n === 1 ? 'day' : 'days'} in a row</h1>
      {all && <p className="t-body c-2">You have written every night this week.</p>}
      <div className="g-jweek">
        {week.map((d, i) => {
          const k = iso(d);
          const state = k === today ? 'today' : journal[k] ? 'done' : 'none';
          return (
            <span key={k} className="g-jweek-day">
              <span className="g-jweek-l">{'MTWTFSS'[i]}</span>
              <span className={`g-jweek-c is-${state}`}>
                {state === 'done' && <Icon name="goals/check-20" size={20} />}
                {state === 'today' && <Icon name="flame" size={20} />}
              </span>
            </span>
          );
        })}
      </div>
      <div className="g-saved-btns">
        <Link href="/today" className="g-btn-ink">Done</Link>
        <Link href="/journal" className="g-btn-ink is-soft">See my journal</Link>
      </div>
    </main>
  );
}

/* ── J3 · Journal entry ─────────────────────────────────────────────────── */
export function JournalView() {
  const ready = useHydrated();
  return ready ? <Gate><Entries /></Gate> : <main className="screen on-desk" aria-busy="true" />;
}
function Entries() {
  const q = useSearchParams();
  const router = useRouter();
  const [journal, setJournal] = useJournal();
  const [lock, setLock] = useLock();
  const [menu, setMenu] = useState(false);
  const [locking, setLocking] = useState(false);
  const [copied, setCopied] = useState(false);
  const empty = Object.keys(journal).length === 0;
  useEffect(() => { if (empty) router.replace('/journal/new'); }, [empty, router]);
  if (empty) return <main className="screen on-desk" aria-busy="true" />;

  const today = todayIso();
  const day = q.get('day') ?? (journal[today] ? today : Object.keys(journal).sort().pop()!);
  const d = fromIso(day);
  const e = journal[day];
  const mood = e?.mood ? MOODS.find(m => m.id === e.mood) : undefined;

  async function share() {
    if (!e) return;
    const text = [longDay(d), mood?.label, e.line].filter(Boolean).join(' · ');
    try {
      if (navigator.share) await navigator.share({ title: 'Mylo', text });
      else { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* closed */ }
  }

  return (
    <main className="screen on-desk g-journal g-no-tabs">
      <ScreenHeader title="Journal" fallback="/today" actions={
        <button type="button" className="back-btn" aria-label="More" onClick={() => setMenu(true)}><Icon name="goals/more" size={19} /></button>
      } />
      <nav className="g-jstrip" aria-label="This week">
        {weekOf(d).map((w, i) => {
          const k = iso(w); const x = journal[k];
          return (
            <button key={k} type="button" className="g-jstrip-day" aria-pressed={k === day} disabled={k > today} onClick={() => router.replace(`/journal?day=${k}`)}>
              <span>{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i]}</span>
              {x?.mood ? <img src={sticker(x.mood)} alt={x.mood} width={34} height={34} /> : <i className="g-jstrip-dot" />}
            </button>
          );
        })}
      </nav>
      <h1 className="g-h22">{longDay(d)}</h1>
      {e ? <>
        {(mood || e.tags.length > 0) && (
          <div className="g-wrap">
            {mood && <span className="g-jtag is-mood">{mood.label}</span>}
            {e.tags.map(t => <span key={t} className="g-jtag">{t}</span>)}
          </div>
        )}
        {e.line && <p className="g-jtext">{e.line}</p>}
        {e.photo && <img className="g-jphoto" src={e.photo} alt="Photo from the day" />}
        <p className="t-caption c-3 g-center">Only you can see your journal.</p>
        <div className="g-jbtns">
          <Link href={`/journal/new?day=${day}`} className="g-btn-ink is-soft">Edit</Link>
          <button type="button" className="g-btn-ink" onClick={share}>{copied ? 'Copied' : 'Share as card'}</button>
        </div>
      </> : (
        <Link href={`/journal/new?day=${day}`} className="g-btn-ink">How was today?</Link>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} title="Journal">
        <div className="g-steps">
          {lock.on
            ? <button type="button" className="g-step t-body" onClick={() => { setLock({ on: false }); setMenu(false); }}>Unlock journal</button>
            : <button type="button" className="g-step t-body" onClick={() => { setMenu(false); setLocking(true); }}>Lock journal</button>}
          {e && <button type="button" className="g-step t-body" style={{ color: 'var(--red)' }} onClick={() => { setJournal(j => { const n = { ...j }; delete n[day]; return n; }); setMenu(false); }}>Delete entry</button>}
        </div>
      </Sheet>
      <LockSetup open={locking} onClose={() => setLocking(false)} />
    </main>
  );
}

/* ── J4 · Journal locked ────────────────────────────────────────────────── */
const UNLOCKED = 'mylo.goals.unlocked';
const hash = async (s: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`mylo:${s}`)))).map(b => b.toString(16).padStart(2, '0')).join('');
const b64 = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = (s: string) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const rand = () => crypto.getRandomValues(new Uint8Array(32));

function Gate({ children }: { children: React.ReactNode }) {
  const [lock] = useLock();
  const [open, setOpen] = useState(() => { try { return sessionStorage.getItem(UNLOCKED) === '1'; } catch { return false; } });
  const [pin, setPin] = useState(false);
  const [code, setCode] = useState('');
  const [wrong, setWrong] = useState(false);
  if (!lock.on || open) return <>{children}</>;
  const unlock = () => { try { sessionStorage.setItem(UNLOCKED, '1'); } catch { /* fine */ } setOpen(true); };

  async function faceId() {
    if (!lock.cred || !window.PublicKeyCredential) { setPin(true); return; }
    try {
      await navigator.credentials.get({ publicKey: { challenge: rand(), allowCredentials: [{ type: 'public-key', id: unb64(lock.cred) }], userVerification: 'required', timeout: 60000 } });
      unlock();
    } catch { setPin(true); }
  }
  async function tryPin(v: string) {
    setCode(v); setWrong(false);
    if (v.length === 4) { if (lock.pin && (await hash(v)) === lock.pin) unlock(); else { setWrong(true); setCode(''); } }
  }

  return (
    <main className="screen on-desk g-locked g-no-tabs">
      <ScreenHeader fallback="/today" />
      <div className="g-lock-mid">
        <span className="g-lock-disc"><img src="/figma/goals/lock.svg" alt="" width={40} height={40} /></span>
        <h1 className="g-h24">Your journal is locked</h1>
        <p className="t-body c-2">Use Face ID to open it.</p>
        {pin && (
          <label className="g-pin">
            <span className="sr-only">Passcode</span>
            <input className="g-input g-pin-input" inputMode="numeric" autoComplete="off" type="password" maxLength={4} autoFocus value={code} onChange={e => tryPin(e.target.value.replace(/\D/g, ''))} />
            {wrong && <span className="t-body-s" style={{ color: 'var(--red)' }}>Try again</span>}
          </label>
        )}
      </div>
      <div className="g-lock-btns">
        <button type="button" className="btn-primary g-full" onClick={faceId}><Icon name="goals/eye" size={20} />Unlock with Face ID</button>
        <button type="button" className="g-pill-2 is-solid" onClick={() => setPin(true)}>Use passcode</button>
      </div>
    </main>
  );
}

/* Locking asks for a four-digit passcode, then offers the device's own
   Face ID or fingerprint when it has one. */
function LockSetup({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [, setLock] = useLock();
  const [code, setCode] = useState('');
  async function save() {
    if (code.length !== 4) return;
    let cred: string | undefined;
    try {
      if (window.PublicKeyCredential && await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()) {
        const c = await navigator.credentials.create({ publicKey: {
          challenge: rand(), rp: { name: 'Mylo' }, user: { id: rand(), name: 'journal', displayName: 'Journal' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' }, timeout: 60000
        } }) as PublicKeyCredential | null;
        if (c) cred = b64(c.rawId);
      }
    } catch { /* passcode only */ }
    setLock({ on: true, pin: await hash(code), cred });
    try { sessionStorage.setItem(UNLOCKED, '1'); } catch { /* fine */ }
    setCode(''); onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Lock journal" sub="Use passcode">
      <input className="g-input g-pin-input" inputMode="numeric" type="password" maxLength={4} autoComplete="new-password" aria-label="Passcode"
             value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} />
      <button type="button" className="btn-primary" onClick={save} disabled={code.length !== 4}>Lock journal</button>
    </Sheet>
  );
}
