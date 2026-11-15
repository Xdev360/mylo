'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import Confirm from '@/components/system/Confirm';
import { useHydrated, useLocal } from '@/lib/local';
import { badgeHex, profileUrl, useFriend, useProfile } from '@/lib/profile';
import { leave, usePeople } from '@/lib/system';
import Room from './Room';
import { Avatar, BareSheet, Seal, SheetRow, Tabs, copyText, useTabMotion, useToast } from './bits';
import { ProfileLoading } from './ProfileView';
import { DEFAULT_ROOM } from './room-data';

/* A friend's profile: P4 (877:117049) and its Goals tab P5 (877:117845),
   the menu P6 (877:118162), Dare P7 (877:118995) and P27 · What verified
   means (877:119860). Only what their profiles row holds is shown; their
   room, cards and goals arrive with the social tables. */
/* Blocked and muted people live in the same lists Settings shows (ST3 and
   Muted people, lib/system), so unblocking there unblocks here. Removed
   friends and sent dares stay on this device until the social tables. */
type People = { removed: string[]; dares: { to: string; text: string; proof: boolean; at: string }[] };
const DARES = ['Cold shower tomorrow morning', '30 push-ups before bed', 'No phone for the first hour'];
const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'goals', label: 'Goals' }] as const;
const ORDER = TABS.map(t => t.id);

export default function FriendView({ username }: { username: string }) {
  const hydrated = useHydrated();
  const router = useRouter();
  const state = useFriend(username);
  const { profile: me } = useProfile();
  const [, setPeople] = useLocal<People>('mylo.profile.people.v1', { removed: [], dares: [] });
  const [blockedList, setBlocked] = usePeople('blocked');
  const [mutedList, setMuted] = usePeople('muted');
  const [tab, setTab, pane] = useTabMotion(ORDER, 'overview');
  const [menu, setMenu] = useState(false);
  const [askBlock, setAskBlock] = useState(false);
  const [dare, setDare] = useState(false);
  const [verified, setVerified] = useState(false);
  const [pick, setPick] = useState(DARES[0]);
  const [own, setOwn] = useState('');
  const [proof, setProof] = useState(true);
  const toast = useToast();
  const back = () => leave(router, '/today');

  if (!hydrated || state.status === 'loading') return <ProfileLoading />;
  if (state.status === 'missing' || !state.profile) {
    return (
      <main className="screen on-desk pf-missing">
        <header className="screen-header">
          <button type="button" className="back-btn" aria-label="Back" onClick={back}><Icon name="chevron-right" size={20} className="flip" /></button>
        </header>
        <img src="/figma/profile/mylo-sleepy.svg" alt="" width={125} height={150} className="pf-empty-mylo" />
        <h1 className="pf-empty-title">No one goes by @{decodeURIComponent(username)}</h1>
        <Link href="/friends/add" className="btn-primary pf-wide">Find friends</Link>
      </main>
    );
  }

  const f = state.profile;
  const name = f.name || `@${f.username}`;
  const first = (f.name || f.username).split(' ')[0];
  const isMe = me.username && me.username === f.username;
  const muted = mutedList.some(x => x.id === f.id);
  const blocked = blockedList.some(x => x.id === f.id);
  const entry = { id: f.id, name, at: new Date().toISOString() };

  async function share() {
    const url = profileUrl(f.username);
    try { if (navigator.share) { await navigator.share({ title: name, url }); return; } } catch { return; }
    toast.show((await copyText(url)) ? 'Link copied' : url);
  }
  function mute(on: boolean) {
    setMuted(all => on ? [...all.filter(x => x.id !== f.id), entry] : all.filter(x => x.id !== f.id));
  }
  function block(on: boolean) {
    setBlocked(all => on ? [...all.filter(x => x.id !== f.id), entry] : all.filter(x => x.id !== f.id));
  }
  function removeFriend() {
    setPeople(p => ({ ...p, removed: [...new Set([...(p.removed ?? []), f.id])] }));
  }
  function sendDare() {
    const text = own.trim() || pick;
    setPeople(p => ({ ...p, dares: [...(p.dares ?? []), { to: f.id, text, proof, at: new Date().toISOString() }] }));
    setDare(false); setOwn('');
    toast.show(`Dare sent to ${first}`);
  }

  return (
    <main className="screen pf-screen on-desk pf-friend">
      <div className="pf-cover" aria-hidden>
        <Room room={DEFAULT_ROOM} H={300} F={198} mylo="cover" className="pf-cover-room" />
      </div>
      <div className="pf-cover-top">
        <button type="button" className="back-btn" aria-label="Back" onClick={back}><Icon name="chevron-right" size={20} className="flip" /></button>
        <button type="button" className="pf-round" aria-label={`${first}, more`} onClick={() => setMenu(true)}><Icon name="profile/more" size={24} /></button>
      </div>
      <div className="pf-photo">
        <Avatar photo={f.photo} name={f.name} size={96} mode="initial" className="pf-photo-ring" />
      </div>

      <section className="pf-id">
        <h1 className="pf-name">
          <span>{name}</span>
          {f.verified && <button type="button" onClick={() => setVerified(true)} aria-label="What verified means"><Seal /></button>}
        </h1>
        {f.name && <p className="pf-handle">@{f.username}</p>}
      </section>

      {isMe ? (
        <div className="pf-actions"><Link href="/profile" className="pf-btn is-dark">Your profile</Link></div>
      ) : blocked ? (
        <div className="pf-actions"><button type="button" className="pf-btn" onClick={() => { block(false); toast.show(`${first} unblocked`); }}>Unblock</button></div>
      ) : (
        <div className="pf-actions is-friend">
          <Link href="/chats" className="pf-btn is-dark"><Icon name="profile/chat" size={22} />Message</Link>
          <button type="button" className="pf-btn is-narrow" onClick={() => setDare(true)}><Icon name="profile/swords" size={22} />Dare</button>
        </div>
      )}

      <Tabs tabs={TABS} value={tab} onChange={setTab} label={`${first}'s profile`} />

      <div className={pane} key={tab} role="tabpanel">
      {tab === 'overview' ? <>
        <section className="pf-sec"><h2 className="pf-sec-title">Showcase</h2><p className="t-body-s c-2">Nothing to show yet.</p></section>
        <section className="pf-sec"><h2 className="pf-sec-title">Badges</h2><p className="t-body-s c-2">Nothing to show yet.</p></section>
        <section className="pf-sec"><h2 className="pf-sec-title">Pets</h2><p className="t-body-s c-2">Nothing to show yet.</p></section>
      </> : (
        <p className="t-body-s c-2">Goals {first} shares with you.</p>
      )}
      </div>

      {/* P6 */}
      <Sheet open={menu} onClose={() => setMenu(false)} title={name} labelId="pf-friend-menu">
        <div className="pf-rows">
          <SheetRow icon="profile/share" label="Share profile" chevron={false} onClick={() => { setMenu(false); share(); }} />
          <SheetRow icon="profile/bell" label={muted ? 'Unmute updates' : 'Mute updates'} sub={`${first} will not know`} chevron={false}
                    onClick={() => { mute(!muted); setMenu(false); toast.show(muted ? 'Updates on' : 'Updates muted'); }} />
          <SheetRow icon="profile/user-plus" label="Invite to a room" chevron={false} href="/rooms" />
          <SheetRow icon="profile/minus" label="Remove friend" chevron={false} onClick={() => { removeFriend(); setMenu(false); toast.show(`${first} removed`); }} />
          <SheetRow icon="profile/flag" label="Report" danger chevron={false} href="/report-a-bug" />
          <SheetRow icon="profile/ban" label={blocked ? 'Unblock' : 'Block'} danger={!blocked} chevron={false}
                    onClick={() => { setMenu(false); if (blocked) { block(false); toast.show(`${first} unblocked`); } else setTimeout(() => setAskBlock(true), 180); }} />
        </div>
      </Sheet>

      {/* P7 */}
      <Sheet open={dare} onClose={() => setDare(false)} title={`Dare ${first}`} sub={`Pick one or write your own. ${first} has 24 hours.`} labelId="pf-dare">
        <div className="pf-dares" role="radiogroup" aria-label="Dares">
          {DARES.map(d => (
            <button key={d} type="button" role="radio" aria-checked={!own && pick === d} className={`pf-dare${!own && pick === d ? ' is-on' : ''}`}
                    onClick={() => { setPick(d); setOwn(''); }}>{d}</button>
          ))}
          <label className={`pf-dare is-own${own ? ' is-on' : ''}`}>
            <Icon name="profile/pencil" size={20} className="c-3" />
            <input value={own} maxLength={80} placeholder="Write your own dare" onChange={e => setOwn(e.target.value)} />
          </label>
        </div>
        <label className="pf-set-row">
          <span className="pf-row-icon"><Icon name="profile/camera" size={20} /></span>
          <span className="t-body">Proof photo needed</span>
          <span className="spacer" />
          <input type="checkbox" className="pf-switch" checked={proof} onChange={e => setProof(e.target.checked)} />
        </label>
        <button type="button" className="btn-primary pf-wide" onClick={sendDare}><Icon name="profile/swords" size={20} />Send dare</button>
      </Sheet>

      {/* P27 */}
      <BareSheet open={verified} onClose={() => setVerified(false)} label={`${first} is verified`}>
        <div className="pf-verified">
          <Seal size={64} colour={badgeHex('blue')} />
          <h2 className="t-title-m">{first} is verified</h2>
          <p className="t-body c-2">This is the real {first}. Mylo checked their phone number and a selfie. Verified people can host public rooms.</p>
          <Link href="/profile/badge" className="btn-primary pf-wide">Get verified</Link>
          <button type="button" className="pf-btn pf-wide" onClick={() => setVerified(false)}>Close</button>
        </div>
      </BareSheet>
      <Confirm open={askBlock} title={`Block ${first}?`} body="They cannot see your profile, posts or message you. They are not told."
               confirmLabel="Block" cancelLabel="Cancel" onCancel={() => setAskBlock(false)}
               onConfirm={() => { block(true); setAskBlock(false); toast.show(`${first} blocked`); }} />
      {toast.node}
    </main>
  );
}
