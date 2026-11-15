'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import ScreenHeader from '@/components/ScreenHeader';
import Sheet from '@/components/Sheet';
import { useHydrated } from '@/lib/local';
import { useProfile, VISIBILITY, type Profile, type Visibility } from '@/lib/profile';
import Room from './Room';
import PhotoFlow from './PhotoFlow';
import { Avatar, useToast } from './bits';
import { useRoom } from './ProfileView';

/* P20 · Edit profile (877:116654), with P25/P26 for the photo. */
export default function EditProfile() {
  const hydrated = useHydrated();
  const me = useProfile();
  if (!hydrated || !me.checked) return <main className="screen on-desk" aria-busy="true" />;
  return <Form initial={me.profile} me={me} />;
}

function Form({ initial, me }: { initial: Profile; me: ReturnType<typeof useProfile> }) {
  const router = useRouter();
  const { profile: p, save, savePhoto } = me;
  const [room] = useRoom();
  const [name, setName] = useState(initial.name);
  const [username, setUsername] = useState(initial.username);
  const [bio, setBio] = useState(initial.bio);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [visOpen, setVisOpen] = useState(false);
  const toast = useToast();

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true); setErr('');
    try {
      await save({ name, username, bio: bio.trim().slice(0, 160) });
      router.push('/profile');
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not save'); setBusy(false); }
  }

  const seen = `${p.showcase.length} cards, ${p.badges.length} badges, ${p.pets.length} pets`;

  return (
    <main className="screen on-desk pf-edit">
      <ScreenHeader title="Edit profile" fallback="/profile"
                    actions={<button type="submit" form="pf-edit-form" className="pf-chip pf-save" disabled={busy}>Save</button>} />

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

      <form id="pf-edit-form" className="pf-fields" onSubmit={submit}>
        <label className="pf-field">
          <span className="t-body-s c-2">Name</span>
          <input className="pf-input" value={name} maxLength={40} autoComplete="name" onChange={e => setName(e.target.value)} />
        </label>
        <label className="pf-field">
          <span className="t-body-s c-2">Username</span>
          <input className="pf-input" value={username} maxLength={21} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                 onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} aria-invalid={Boolean(err)} aria-describedby="pf-edit-err" />
        </label>
        <label className="pf-field">
          <span className="t-body-s c-2">Bio</span>
          <textarea className="pf-input pf-textarea" value={bio} maxLength={160} rows={3} onChange={e => setBio(e.target.value)} />
        </label>
        {err && <p id="pf-edit-err" className="t-body-s pf-danger" role="alert">{err}</p>}
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
            <input type="checkbox" className="pf-switch" checked={p.showStreak} onChange={e => save({ showStreak: e.target.checked })} />
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
                    onClick={() => { save({ visibility: v }); setVisOpen(false); }}>
              <span className="pf-row-text"><span className="t-body">{VISIBILITY[v]}</span></span>
              <span className={`pf-radio${p.visibility === v ? ' is-on' : ''}`}>{p.visibility === v && <Icon name="check" size={14} />}</span>
            </button>
          ))}
        </div>
      </Sheet>

      <PhotoFlow open={photoOpen} onClose={() => setPhotoOpen(false)} hasPhoto={Boolean(p.photo) || p.myloLook}
                 onPhoto={async blob => { try { await savePhoto(blob); await save({ myloLook: false }); toast.show('Photo updated'); } catch (x) { toast.show(x instanceof Error ? x.message : 'Could not save that photo'); } }}
                 onMylo={() => { save({ myloLook: true }); if (p.photo) savePhoto(null).catch(() => {}); }}
                 onRemove={() => { save({ myloLook: false }); savePhoto(null).catch(() => {}); }} />
      {toast.node}
    </main>
  );
}
