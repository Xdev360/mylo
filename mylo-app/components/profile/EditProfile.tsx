'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import Confirm from '@/components/system/Confirm';
import { useHydrated } from '@/lib/local';
import { cleanUsername, usernameProblem, usernameTaken, useProfile, VISIBILITY, type Profile, type Visibility } from '@/lib/profile';
import { flash, leave, readDraft, writeDraft } from '@/lib/system';
import Room from './Room';
import PhotoFlow from './PhotoFlow';
import { Avatar, useToast } from './bits';
import { useRoom } from './ProfileView';

/* P20 · Edit profile (877:116654), with P25/P26 for the photo.

   What is saved where: name, username and photo go to the account (the
   profiles row) when signed in, and stay on this device otherwise; the bio,
   the cover room, Show streak, visibility and the badge colour stay on this
   device (the row has no column for them yet). The words being typed are
   kept for this tab, so a reload or a trip to Change cover loses nothing;
   Save or Discard clears them. Show streak and visibility save as they are
   flipped, like any switch. */
const DRAFT = 'mylo.profile.draft.v1';
type Draft = { name: string; username: string; bio: string };

export default function EditProfile() {
  const hydrated = useHydrated();
  const me = useProfile();
  if (!hydrated || !me.checked) return <main className="screen on-desk" aria-busy="true" />;
  return <Form initial={me.profile} me={me} />;
}

function Form({ initial, me }: { initial: Profile; me: ReturnType<typeof useProfile> }) {
  const router = useRouter();
  const { profile: p, save, savePhoto, userId } = me;
  const [room] = useRoom();
  const start: Draft = { name: initial.name, username: initial.username, bio: initial.bio };
  const [draft] = useState<Draft>(() => readDraft<Draft>(DRAFT) ?? start);
  const [name, setName] = useState(draft.name);
  const [username, setUsername] = useState(draft.username);
  const [bio, setBio] = useState(draft.bio);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [visOpen, setVisOpen] = useState(false);
  const [discard, setDiscard] = useState(false);
  const [taken, setTaken] = useState<{ u: string; taken: boolean } | null>(null);
  const toast = useToast();
  const userRef = useRef<HTMLInputElement>(null);
  const bioRef = useRef<HTMLTextAreaElement>(null);

  const dirty = name.trim() !== start.name.trim() || cleanUsername(username) !== start.username || bio.trim() !== start.bio.trim();
  useEffect(() => { writeDraft(DRAFT, dirty ? { name, username, bio } : null); }, [dirty, name, username, bio]);

  /* Username: its shape is checked as it is typed; whether someone else has
     it is asked once typing pauses (signed in only: on this device nobody
     else can have it). */
  const u = cleanUsername(username);
  const shape = usernameProblem(username);
  useEffect(() => {
    if (!userId || shape || !u || u === start.username) return;
    let live = true;
    const t = setTimeout(() => { usernameTaken(u, userId).then(r => { if (live && r !== null) setTaken({ u, taken: r }); }); }, 450);
    return () => { live = false; clearTimeout(t); };
  }, [u, shape, userId, start.username]);
  const isTaken = taken?.u === u && taken.taken;
  const userErr = shape || (isTaken ? 'That username is taken' : '');
  const blocked = Boolean(userErr) || busy;

  const out = () => leave(router, '/profile');
  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (blocked) { if (userErr) userRef.current?.focus(); return; }
    if (!dirty) { writeDraft(DRAFT, null); out(); return; }
    setBusy(true); setErr('');
    try {
      await save({ name, username, bio: bio.trim().slice(0, 160) });
      writeDraft(DRAFT, null);
      flash('Profile saved');
      out();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not save'); setBusy(false); }
  }
  const back = () => (dirty ? setDiscard(true) : out());
  /* Enter moves to the next field; in the bio it saves (Shift+Enter for a new line). */
  const next = (e: React.KeyboardEvent, to: { current: HTMLElement | null }) => { if (e.key === 'Enter') { e.preventDefault(); to.current?.focus(); } };

  const seen = `${p.showcase.length} cards, ${p.badges.length} badges, ${p.pets.length} pets`;

  return (
    <main className="screen on-desk pf-edit">
      <header className="screen-header">
        <button type="button" className="back-btn" aria-label="Back" onClick={back}><Icon name="chevron-right" size={20} className="flip" /></button>
        <h1 className="screen-header-title">Edit profile</h1>
        <div className="screen-header-actions">
          <button type="submit" form="pf-edit-form" className="pf-chip pf-save" disabled={blocked} aria-busy={busy}>Save</button>
        </div>
      </header>

      <div className="pf-edit-cover">
        <Room room={room} H={300} F={198} mylo="cover" className="pf-edit-room-art" />
        <Link href="/profile/cover" className="pf-chip pf-change-cover">Change cover</Link>
        <div className="pf-photo is-edit">
          <button type="button" className="pf-photo-btn" onClick={() => setPhotoOpen(true)} aria-label="Change photo">
            <Avatar photo={p.photo} mylo={p.myloLook} name={name} size={84} className="pf-photo-ring" />
          </button>
          <button type="button" className="pf-photo-cam" onClick={() => setPhotoOpen(true)} aria-label="Change photo"><Icon name="profile/camera" size={18} /></button>
        </div>
      </div>

      <form id="pf-edit-form" className="pf-fields" onSubmit={submit} noValidate>
        <label className="pf-field">
          <span className="t-body-s c-2">Name</span>
          <input className="pf-input" value={name} maxLength={40} autoComplete="name" enterKeyHint="next"
                 onChange={e => setName(e.target.value)} onKeyDown={e => next(e, userRef)} />
        </label>
        <label className="pf-field">
          <span className="t-body-s c-2">Username</span>
          <input ref={userRef} className="pf-input" value={username} maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false} enterKeyHint="next"
                   onChange={e => { setUsername(e.target.value.toLowerCase().replace(/\s/g, '').replace(/^@/, '')); setErr(''); }}
                   onKeyDown={e => next(e, bioRef)}
                   aria-invalid={Boolean(userErr || err)} aria-describedby="pf-user-msg" />
          {userErr && <span id="pf-user-msg" className="t-body-s pf-danger pf-field-msg" role="alert">{userErr}</span>}
        </label>
        <label className="pf-field">
          <span className="pf-field-head"><span className="t-body-s c-2">Bio</span>{bio.length > 120 && <span className="t-caption c-3">{bio.length}/160</span>}</span>
          <textarea ref={bioRef} className="pf-input pf-textarea" value={bio} maxLength={160} rows={3} enterKeyHint="done"
                    onChange={e => setBio(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void submit(); } }} />
        </label>
        {err && <p className="t-body-s pf-danger pf-field-msg" role="alert">{err}</p>}
      </form>

      <section className="pf-onprofile">
        <h2 className="pf-sec-title">On your profile</h2>
        <div className="list">
          <Link href="/profile/showcase" className="pf-set-row">
            <span className="t-body">What friends see</span>
            <span className="t-body-s c-3 pf-set-value">{seen}</span>
            <Icon name="chevron-right" size={22} className="c-3" />
          </Link>
          <label className="pf-set-row">
            <span className="t-body">Show streak</span>
            <span className="spacer" />
            <input type="checkbox" role="switch" className="pf-switch" checked={p.showStreak} onChange={e => save({ showStreak: e.target.checked })} />
          </label>
          <button type="button" className="pf-set-row" onClick={() => setVisOpen(true)}>
            <span className="pf-set-text"><span className="t-body">Profile visibility</span><span className="t-body-s c-2">{VISIBILITY[p.visibility]}</span></span>
            <Icon name="chevron-right" size={22} className="c-3" />
          </button>
        </div>
      </section>

      <Sheet open={visOpen} onClose={() => setVisOpen(false)} title="Profile visibility" labelId="pf-vis-title">
        <div className="pf-rows" role="radiogroup" aria-labelledby="pf-vis-title">
          {(Object.keys(VISIBILITY) as Visibility[]).map(v => (
            <button key={v} type="button" role="radio" aria-checked={p.visibility === v} className="pf-row"
                    onClick={() => { save({ visibility: v }); setTimeout(() => setVisOpen(false), 160); }}>
              <span className="pf-row-text"><span className="t-body">{VISIBILITY[v]}</span></span>
              <span className={`pf-radio${p.visibility === v ? ' is-on' : ''}`}><Icon name="check" size={14} /></span>
            </button>
          ))}
        </div>
      </Sheet>

      <PhotoFlow open={photoOpen} onClose={() => setPhotoOpen(false)} hasPhoto={Boolean(p.photo) || p.myloLook}
                 onPhoto={async blob => { try { await savePhoto(blob); await save({ myloLook: false }); toast.show('Photo updated'); } catch (x) { toast.show(x instanceof Error ? x.message : 'Could not save that photo'); throw x; } }}
                 onMylo={async () => { try { if (p.photo) await savePhoto(null); await save({ myloLook: true }); toast.show('Photo updated'); } catch { toast.show('Could not save that photo'); } }}
                 onRemove={async () => { try { await save({ myloLook: false }); await savePhoto(null); toast.show('Photo removed'); } catch { toast.show('Could not remove that photo'); } }} />
      <Confirm open={discard} title="Discard your changes?" body="Your profile stays as it was." confirmLabel="Discard" cancelLabel="Keep editing"
               onCancel={() => setDiscard(false)} onConfirm={() => { writeDraft(DRAFT, null); setDiscard(false); out(); }} />
      {toast.node}
    </main>
  );
}
