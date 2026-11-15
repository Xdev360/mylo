'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { BackBtn, Chest, DAY_LETTERS, KeyPill, LockDot } from './bits';
import BadgeWatcher from './BadgeWatcher';
import { CARDS, CARD_TOTAL, CHEST_HOLDS, LEGENDARY_WITHIN, RARITY, TIERS, cardArt, useRewards, type Tier, type Week } from '@/lib/rewards';

/* U1 · Rewards hub (877:123316), and XT9 · week 1 (877:123108) before the
   first chest. Desktop: DT10 (948:28133). Keys, the week and the chest come
   from the person's own ticks; cards, pets and eggs from what chests gave. */

const TIER_ORDER: Tier[] = ['wood', 'silver', 'gold'];

export function chestLine(week: Week, everEarned: boolean) {
  if (week.dropped) return 'You missed last week, so it dropped one level.';
  if (week.weekNo === 1) return everEarned ? 'Week 1 of showing up.' : 'Week 1. Show up 5 days to earn your first key.';
  if (week.weekNo === 2) return 'Week 2 of showing up. Silver unlocks next week.';
  if (week.weekNo === 3) return 'Week 3 of showing up. Gold unlocks next week.';
  return `Week ${week.weekNo} of showing up.`;
}
export const keyLine = (toKey: number) => toKey === 0 ? 'Key earned this week' : toKey === 1 ? '1 more day for a key' : `${toKey} more days for a key`;

export default function Hub() {
  const r = useRewards();
  if (!r.ready) return <main className="screen" aria-busy="true" />;
  const { week, keys, canOpen, owned, state, level } = r;
  const everEarned = week.keysEarned > 0 || state.opened.length > 0;
  const eggs = state.eggs.length + (state.nest ? 1 : 0);
  const tierName = TIERS[week.tier].name;
  const current = TIER_ORDER.indexOf(week.tier);

  return (
    <>
      <BadgeWatcher badges={r.badges} seen={state.seenBadges} onSeen={r.seeBadges} onPin={r.pin} />

      {/* ── Phone: U1, XT9 ──────────────────────────────────────────────── */}
      <main className="screen rw rw-hub no-tabs only-phone">
        <header className="rw-top">
          <BackBtn fallback="/today" />
          <h1 className="rw-top-title">Rewards</h1>
          <KeyPill href="/chest" className="rw-keys-top">{keys}</KeyPill>
        </header>

        <section className="rw-week" aria-label="This week">
          <p className="rw-week-label">This week</p>
          <h2 className="rw-week-title">{keyLine(week.toKey)}</h2>
          <div className="rw-week-days">
            {week.days.map((on, i) => <span key={i} className={`rw-week-day${on ? ' is-on' : ''}`}>{DAY_LETTERS[i]}</span>)}
          </div>
          <span className="rw-week-bar"><span style={{ width: `${Math.min(1, week.count / 5) * 100}%` }} /></span>
        </section>

        <section className="rw-sunday" aria-label="Sunday chest">
          <span className="rw-sunday-glow" />
          <span className="rw-sunday-chest"><Chest tier={week.tier} size={170} /></span>
          <div className="rw-sunday-text">
            <p className="rw-sunday-kicker">Sunday chest</p>
            <h2 className="rw-sunday-title">{tierName} chest</h2>
            <p className="rw-sunday-line">{chestLine(week, everEarned)}</p>
            <Link href="/chest" className="rw-sunday-btn">{canOpen ? 'Open chest' : 'Opens Sunday'}</Link>
          </div>
        </section>

        <h2 className="rw-h">Chest levels</h2>
        <div className="rw-tiles">
          {TIER_ORDER.map((t, i) => (
            <Link key={t} href="/chest" className="rw-tile rw-tier">
              <span className="rw-tier-art"><Chest tier={t} size={80} /></span>
              {i > current && <span className="rw-tier-lock"><LockDot /></span>}
              <span className="rw-tile-name">{TIERS[t].name}</span>
              <span className={`rw-tile-sub${i === current ? ' is-now' : ''}`}>{i === current ? 'Now' : t === 'wood' ? 'Week 1' : TIERS[t].week}</span>
            </Link>
          ))}
        </div>

        <h2 className="rw-h">{state.opened.length ? 'Your stuff' : 'Your stuff · starts this Sunday'}</h2>
        <div className="rw-tiles">
          <Link href="/rewards/collection" className="rw-tile rw-stat"><span className="rw-stat-n">{owned.length}/{CARD_TOTAL}</span><span className="rw-stat-l">Cards</span></Link>
          <Link href="/rewards/pets" className="rw-tile rw-stat"><span className="rw-stat-n">{state.pets.length}</span><span className="rw-stat-l">Pets</span></Link>
          <Link href="/rewards/nest" className="rw-tile rw-stat"><span className="rw-stat-n">{eggs}</span><span className="rw-stat-l">Eggs</span></Link>
        </div>
      </main>

      {/* ── Desktop: DT10 ───────────────────────────────────────────────── */}
      <main className="desk rw-desk only-desk">
        <header className="rw-desk-head">
          <div>
            <p className="t-body-s c-2">{level.level.name} · {keys === 1 ? '1 key' : `${keys} keys`}</p>
            <h1 className="rw-desk-title">Rewards</h1>
          </div>
          <span className="rw-odds">Odds shown · No buying</span>
        </header>
        <div className="rw-desk-row">
          <section className="rw-big" aria-label="Sunday chest">
            <p className="rw-big-kicker">SUNDAY CHEST</p>
            <h2 className="rw-big-title">{tierName} chest{canOpen ? ' ready' : ''}</h2>
            <p className="rw-big-line">Week {week.weekNo} · {week.count} of 7 days. {chestLine(week, everEarned).replace(/^Week \d+(\.| of showing up\.)\s*/, '')}</p>
            <div className="rw-big-art">
              <span className="rw-big-chest"><Icon name="rewards/i-gift" size={72} /></span>
              <img className="rw-big-mylo" src="/figma/rewards/mylo-plain.svg" alt="" width={117} height={140} />
            </div>
            <div className="rw-big-chips">{CHEST_HOLDS[week.tier].map(x => <span key={x} className="rw-big-chip">{RARITY[x].label}</span>)}</div>
            <Link href="/chest" className={`rw-big-btn${canOpen ? '' : ' is-wait'}`}>
              <Icon name="rewards/i-key" size={18} />{canOpen ? 'Open with 1 key' : 'Opens Sunday'}
            </Link>
          </section>
          <div className="rw-rail">
            <section className="rw-rail-card">
              <h2 className="rw-rail-title">Keys</h2>
              <div className="rw-rail-days">
                {week.days.map((on, i) => <span key={i} className={`rw-rail-day${on ? ' is-on' : ''}`}>{DAY_LETTERS[i]}</span>)}
              </div>
              <p className="t-body-s c-2">5 active days in a week earns 1 key. Level ups give 1 more.</p>
            </section>
            <section className="rw-rail-card">
              <h2 className="rw-rail-title">Legendary guarantee</h2>
              <p className="t-body-s c-2">Within {LEGENDARY_WITHIN} Gold chests. {state.goldSinceLegendary} opened so far.</p>
            </section>
          </div>
        </div>
        <h2 className="rw-desk-h">Your cards</h2>
        <div className="rw-desk-cards">
          {owned.map(c => (
            <Link key={c.id} href={`/rewards/card/${c.id}`} className={`rw-desk-card is-${c.rarity}`}>
              <img src={cardArt(c.id)} alt="" />
              <span className="rw-desk-card-name">{c.name}</span>
              <span className="rw-desk-card-r">{RARITY[c.rarity].label}</span>
            </Link>
          ))}
          {owned.length < CARDS.length && (
            <Link href="/rewards/collection" className="rw-desk-card is-not">
              <Icon name="rewards/i-lock" size={32} />
              <span className="rw-desk-card-r">Not yet</span>
            </Link>
          )}
        </div>
      </main>
    </>
  );
}
