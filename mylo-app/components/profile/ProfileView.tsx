'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated, useLocal } from '@/lib/local';
import { badgeHex, useProfile } from '@/lib/profile';
import { useStore, type Item } from '@/lib/store';
import { useStreak } from '@/lib/goals';
import { badgeArt, cardArt, petArt, petName, useRewards, useXp } from '@/lib/rewards';
import Skeleton from '@/components/system/Skeleton';
import Room from './Room';
import PhotoFlow from './PhotoFlow';
import { Avatar, Seal, Tabs, useTabMotion, useToast } from './bits';
import { DEFAULT_ROOM, type RoomState } from './room-data';

/* My profile. Phone: P1 (877:114812) and its Goals tab P2 (877:115565), which
   for a new account is P3 (877:114715), the empty profile. Desktop: DT7
   (947:27867). Streak comes from the person's own ticks; level and XP are
   the server's and start at Spark, level 1, 0 XP as P3 draws them. */

export const LOCKED_BADGES = [
  { id: 'first_goal', name: 'First Win', art: 'badge-first-win-locked' },
  { id: 'streak_3', name: '3 Day Streak', art: 'badge-streak-3-locked' },
  { id: 'streak_7', name: 'Queen of Showing Up', art: 'badge-streak-7-locked' }
];
const TONE = { blue: ['var(--tint-blue)', 'var(--blue)'], green: ['var(--tint-green)', 'var(--green)'], amber: ['var(--tint-amber)', 'var(--amber)'], red: ['var(--tint-red)', 'var(--red)'] } as const;

const TABS = [{ id: 'overview', label: 'Overview' }, { id: 'goals', label: 'Goals' }] as const;
const ORDER = TABS.map(t => t.id);

/* While the profile loads: S22's grey shapes, faded in only if it takes a
   moment, so a quick load shows nothing at all. */
export function ProfileLoading() {
  return <main className="screen pf-loading" aria-busy="true"><Skeleton variant="profile" /></main>;
}

export function useRoom() {
  return useLocal<RoomState>('mylo.profile.room.v1', DEFAULT_ROOM);
}

function Stats({ days, level, xp }: { days: number; level: { name: string; id: string; number: number }; xp: number }) {
  return (
    <section className="pf-stats" aria-label="Your progress">
      <Link href="/streak" className="pf-stat">
        <span className={`pf-stat-icon${days ? ' is-on' : ''}`}><Icon name="profile/streak" size={28} /></span>
        <span className="pf-stat-text"><span className="pf-stat-n">{days}</span><span className="t-caption c-2">day streak</span></span>
      </Link>
      <span className="pf-stat-div" />
      <Link href="/level" className="pf-stat">
        <img src={level.id === 'spark' ? '/figma/profile/level-spark.svg' : `/figma/rewards/level-${level.id}.svg`} alt="" width={34} height={34} className="pf-level" />
        <span className="pf-stat-text"><span className="pf-stat-n">{level.name}</span><span className="t-caption c-2">Level {level.number}</span></span>
      </Link>
      <span className="pf-stat-div" />
      <Link href="/xp" className="pf-stat">
        <span className="pf-stat-icon"><Icon name="profile/bolt" size={28} /></span>
        <span className="pf-stat-text"><span className="pf-stat-n">{xp.toLocaleString('en-GB')}</span><span className="t-caption c-2">XP</span></span>
      </Link>
    </section>
  );
}

export function GoalCard({ g }: { g: Item }) {
  const tone = g.tag ? TONE[g.tag.tone] : ['var(--surface)', 'var(--text-2)'];
  return (
    <Link href={`/goals/${g.id}`} className="pf-goal" style={{ background: tone[0] }}>
      {g.tag && <span className="pf-goal-tag t-caption"><span className="pf-dot" style={{ background: tone[1] }} />{g.tag.label}</span>}
      <span className="pf-goal-title">{g.title}</span>
      <span className="pf-goal-foot">
        <span className="pf-goal-track"><span style={{ width: g.done ? '100%' : '0%', background: tone[1] }} /></span>
        <span className="t-caption pf-goal-pct">{g.done ? 100 : 0}%</span>
      </span>
    </Link>
  );
}

export default function ProfileView() {
  const hydrated = useHydrated();
  const { profile: p, signedIn, checked, save, savePhoto } = useProfile();
  const { items } = useStore();
  const streakNow = useStreak();
  const rw = useRewards();
  const xp = useXp();
  const [room] = useRoom();
  const [tab, setTab, pane] = useTabMotion(ORDER, 'overview');
  const [photoOpen, setPhotoOpen] = useState(false);
  const toast = useToast();
  if (!hydrated || !checked) return <ProfileLoading />;

  const days = streakNow;
  // What the rewards ledger says, so the profile and the rewards screens agree.
  const shownBadges = LOCKED_BADGES.map(b => {
    const st = rw.badges.find(x => x.id === b.id);
    return { ...b, earned: !!st?.earned, src: st?.earned ? badgeArt(b.id) : `/figma/profile/${b.art}.svg` };
  });
  const earnedCount = rw.badges.filter(b => b.earned).length;
  const nextBadge = rw.badges.find(b => !b.earned && (b.days || b.goals));
  const badgeLine = !nextBadge ? 'Every badge earned.' : nextBadge.goals ? `Tick your first task to earn ${nextBadge.name}.` : `${nextBadge.left} more ${nextBadge.left === 1 ? 'day' : 'days'} in a row for ${nextBadge.name}.`;
  const cards = rw.owned.slice(0, 3);
  const pets = rw.state.pets;
  const lvl = rw.level;
  const goals = items.filter(i => i.kind === 'goal');
  const ticked = items.some(i => i.done);
  const hasPhoto = Boolean(p.photo) || p.myloLook;
  const steps = [
    { label: 'Pick your Mylo look', done: true, href: '/style' },
    { label: 'Add a photo', done: hasPhoto, onClick: () => setPhotoOpen(true) },
    { label: 'Tick your first task', done: ticked, href: '/today' }
  ];
  const doneSteps = steps.filter(s => s.done).length;
  const roomLabel = 'Your room. Open it.';

  async function onPhoto(blob: Blob) {
    try { await savePhoto(blob); await save({ myloLook: false }); toast.show('Photo updated'); } catch (e) { toast.show(e instanceof Error ? e.message : 'Could not save that photo'); throw e; }
  }

  const seal = p.verified && <Link href="/profile/badge" aria-label="Your badge"><Seal colour={badgeHex(p.badge)} /></Link>;

  return (
    <>
      {/* ── Phone: P1, P2, P3 ─────────────────────────────────────────── */}
      <main className="screen pf-screen only-phone">
        <Link href="/profile/room" className="pf-cover" aria-label={roomLabel}>
          <Room room={room} H={300} F={198} mylo="cover" className="pf-cover-room" />
        </Link>
        <div className="pf-cover-top">
          {!signedIn ? <Link href="/signin" className="pf-chip">Sign in</Link> : <span />}
          <Link href="/settings" className="pf-round" aria-label="Settings"><Icon name="profile/settings" size={24} /></Link>
        </div>
        <Link href="/profile/room?edit=1" className="pf-chip pf-edit-room"><Icon name="profile/pencil" size={16} />Edit room</Link>
        <div className="pf-photo">
          <button type="button" className="pf-photo-btn" onClick={() => setPhotoOpen(true)} aria-label="Change photo">
            <Avatar photo={p.photo} mylo={p.myloLook} name={p.name} size={96} className="pf-photo-ring" />
          </button>
          <button type="button" className="pf-photo-cam" onClick={() => setPhotoOpen(true)} aria-label="Change photo"><Icon name="profile/camera" size={18} /></button>
        </div>

        <section className="pf-id">
          <h1 className="pf-name">
            {p.name ? <span>{p.name}</span> : <Link href="/profile/edit" className="c-3">Add your name</Link>}
            {seal}
          </h1>
          {p.username && <p className="pf-handle">@{p.username}</p>}
          {p.bio ? <p className="t-body pf-bio">{p.bio}</p> : <Link href="/profile/edit" className="t-body c-3 pf-bio">Add a short bio</Link>}
        </section>

        <div className="pf-actions">
          <Link href="/profile/edit" className="pf-btn"><Icon name="profile/pencil" size={22} />Edit profile</Link>
          <Link href="/profile/share" className="pf-btn"><Icon name="profile/share" size={22} />Share profile</Link>
        </div>

        <Stats days={days} level={{ ...lvl.level, number: lvl.number }} xp={xp} />

        <Tabs tabs={TABS} value={tab} onChange={setTab} label="Profile" />

        <div className={pane} key={tab} role="tabpanel">
        {tab === 'overview' ? <>
          {doneSteps < steps.length && (
            <section className="pf-finish" aria-label="Finish your profile">
              <div className="section-head"><h2 className="t-title-s">Finish your profile</h2><span className="t-body-s c-2">{doneSteps} of {steps.length}</span></div>
              <ul className="pf-steps">
                {steps.map(s => {
                  const body = <><span className={`pf-step-check${s.done ? ' is-done' : ''}`}>{s.done && <Icon name="check" size={16} />}</span><span className={s.done ? 'c-3' : ''}>{s.label}</span></>;
                  return (
                    <li key={s.label}>
                      {s.done ? <span className="pf-step">{body}</span>
                        : s.href ? <Link href={s.href} className="pf-step">{body}</Link>
                        : <button type="button" className="pf-step" onClick={s.onClick}>{body}</button>}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="pf-sec">
            <div className="section-head"><h2 className="pf-sec-title">Showcase</h2></div>
            <div className="pf-slots">
              {[0, 1, 2].map(i => cards[i]
                ? <Link key={cards[i].id} href={`/rewards/card/${cards[i].id}`} className="pf-slot is-card is-filled" aria-label={cards[i].name}><img src={cardArt(cards[i].id)} alt="" /></Link>
                : <Link key={i} href="/rewards/collection" className="pf-slot is-card" aria-label="Add a card"><Icon name="profile/plus" size={22} /></Link>)}
            </div>
            <p className="t-body-s c-2">Cards come from your Sunday chest. Pick up to 5 to show here.</p>
          </section>

          <section className="pf-sec">
            <div className="section-head"><h2 className="pf-sec-title">Badges</h2></div>
            <Link href="/badges" className="pf-badges" aria-label="Badges">
              {shownBadges.map(b => <img key={b.id} src={b.src} alt={b.earned ? b.name : `${b.name}, locked`} width={52} height={52} className="pf-badge" />)}
            </Link>
            <p className="t-body-s c-2">{badgeLine}</p>
          </section>

          <section className="pf-sec">
            <div className="section-head"><h2 className="pf-sec-title">Pets</h2></div>
            <div className="pf-slots">
              {pets.map(pet => <Link key={pet.id} href="/pets" className="pf-slot is-pet is-filled" aria-label={petName(pet)}><img src={petArt(pet.kind)} alt="" /></Link>)}
              <Link href="/eggs" className="pf-slot is-pet" aria-label="Hatch an egg"><Icon name="profile/plus" size={22} /></Link>
            </div>
            <p className="t-body-s c-2">{pets.length ? `${pets.length} ${pets.length === 1 ? 'pet' : 'pets'} so far. Hatch another egg for more.` : 'Hatch an egg to get your first pet.'}</p>
          </section>
        </> : <>
          <p className="t-body-s c-2">Friends only see the goals you share. Private goals stay here.</p>
          {goals.length > 0 && <div className="pf-goals">{goals.map(g => <GoalCard key={g.id} g={g} />)}</div>}
          <Link href="/goals/new" className="pf-new-goal"><Icon name="profile/plus" size={24} />New goal</Link>
        </>}
        </div>
      </main>

      {/* ── Desktop: DT7 ──────────────────────────────────────────────── */}
      <main className="desk pf-desk only-desk">
        <section className="pf-head">
          <button type="button" className="pf-head-photo" onClick={() => setPhotoOpen(true)} aria-label="Change photo">
            <Avatar photo={p.photo} mylo={p.myloLook} name={p.name} size={96} mode="initial" />
          </button>
          <div className="pf-head-text">
            <h1 className="pf-head-name">{p.name || <Link href="/profile/edit" className="c-3">Add your name</Link>}{seal}</h1>
            <p className="t-body c-2">{[p.username && `@${p.username}`, p.bio].filter(Boolean).join(' · ') || <Link href="/profile/edit">Add a short bio</Link>}</p>
            <p className="pf-head-chips">
              <Link href="/level" className="pf-pill is-level">{lvl.level.name}</Link>
              <Link href="/xp" className="pf-pill">{xp.toLocaleString('en-GB')} XP</Link>
              <Link href="/streak" className="pf-pill">{days} day streak</Link>
            </p>
          </div>
          {!signedIn && <Link href="/signin" className="pf-head-btn">Sign in</Link>}
          <Link href="/profile/edit" className="pf-head-btn"><Icon name="profile/pencil" size={18} />Edit profile</Link>
          <Link href="/profile/share" className="pf-head-btn is-dark"><Icon name="profile/share" size={18} />Share</Link>
        </section>

        <div className="pf-desk-cols">
          <section className="pf-desk-card">
            <div className="section-head"><h2 className="t-title-s">Badges</h2><span className="t-body-s c-2">{earnedCount} of {rw.badges.length}</span></div>
            <div className="pf-tiles">
              {shownBadges.map(b => (
                <Link key={b.id} href="/badges" className="pf-tile">
                  <img src={b.src} alt="" width={44} height={44} className="pf-badge" />
                  <span className="t-body-s">{b.name}</span>
                </Link>
              ))}
            </div>
            <p className="t-body-s c-2">{badgeLine}</p>
          </section>
          <section className="pf-desk-card">
            <div className="section-head"><h2 className="t-title-s">Showcase</h2><span className="t-body-s c-2">{cards.length} of 5</span></div>
            <div className="pf-tiles">
              {[0, 1, 2].map(i => cards[i]
                ? <Link key={cards[i].id} href={`/rewards/card/${cards[i].id}`} className="pf-tile is-filled" aria-label={cards[i].name}><img src={cardArt(cards[i].id)} alt="" width={44} height={60} /></Link>
                : <Link key={i} href="/rewards/collection" className="pf-tile is-empty" aria-label="Add a card"><Icon name="profile/plus" size={22} /></Link>)}
            </div>
            <p className="t-body-s c-2">Cards come from your Sunday chest. Pick up to 5 to show here.</p>
          </section>
        </div>

        <section className="pf-desk-card">
          <h2 className="t-title-s">Goals</h2>
          {goals.map(g => (
            <Link key={g.id} href={`/goals/${g.id}`} className="pf-goal-row">
              <span className="task-text"><span className="pf-goal-row-title">{g.title}</span><span className="t-body-s c-2">{g.tag?.label ?? 'Private'}</span></span>
              <span className="pf-goal-row-track"><span style={{ width: g.done ? '100%' : '0%' }} /></span>
              <span className="pf-goal-row-pct">{g.done ? 100 : 0}%</span>
            </Link>
          ))}
          <Link href="/goals/new" className="pf-new-goal"><Icon name="profile/plus" size={24} />New goal</Link>
        </section>
      </main>

      <PhotoFlow open={photoOpen} onClose={() => setPhotoOpen(false)} hasPhoto={hasPhoto}
                 onPhoto={onPhoto}
                 onMylo={async () => { try { if (p.photo) await savePhoto(null); await save({ myloLook: true }); toast.show('Photo updated'); } catch { toast.show('Could not save that photo'); } }}
                 onRemove={async () => { try { await save({ myloLook: false }); await savePhoto(null); toast.show('Photo removed'); } catch { toast.show('Could not remove that photo'); } }} />
      {toast.node}
    </>
  );
}
