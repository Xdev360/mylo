'use client';

import Link from 'next/link';
import Icon from '@/components/Icon';
import { GATES, type Feature } from '@/lib/apps';
import { Confetti, MomentSheet } from './ui';

/* LX2 · Locked feature (878:114347): level too low. The XP line under the
   words is the server's to fill (XP to go, this level and the next); until it
   sends them the card is left out rather than guessed. */
const LOCKED_WORDS: Partial<Record<Feature, string>> = {
  games: 'Play Chess and Chance with your room. Keep ticking, you are close.',
  challenges: 'Dare a friend, or run one together. Keep ticking, you are close.'
};
export function LockedSheet({ feature, onClose, xp }: { feature: Feature | null; onClose: () => void; xp?: { toGo: number; now: number; next: number } }) {
  const g = feature ? GATES[feature] : null;
  return (
    <MomentSheet open={!!feature} onClose={onClose} labelId="lx2-title">
      {g && <>
        <img className={`ax-badge-100${g.level === 'Blaze' ? ' is-blaze' : ''}`} src={g.level === 'Blaze' ? '/figma/apps/badge-blaze.svg' : '/figma/apps/badge-flame-100.svg'} alt="" width={100} height={100} />
        <h2 id="lx2-title" className="ax-moment-title">{g.name} {g.plural ? 'open' : 'opens'} at {g.level}</h2>
        <p className="ax-moment-body">{LOCKED_WORDS[feature!] ?? 'Keep ticking, you are close.'}</p>
        {xp && (
          <div className="ax-xp">
            <p className="ax-xp-row"><span className="t-body ax-600">{xp.toGo.toLocaleString('en-GB')} XP to {g.level}</span><span className="t-body-s c-2">{xp.now.toLocaleString('en-GB')} / {xp.next.toLocaleString('en-GB')}</span></p>
            <span className="ax-xp-track"><span style={{ width: `${Math.min(100, (xp.now / xp.next) * 100)}%` }} /></span>
          </div>
        )}
        <div className="ax-moment-btns">
          <Link href="/levels" className="ax-btn ax-btn-soft">See all levels</Link>
          <button type="button" className="ax-btn" onClick={onClose}>Got it</button>
        </div>
      </>}
    </MomentSheet>
  );
}

/* LX6 · Coming in a later update (884:117539): the release is not on yet. */
export function LaterSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <MomentSheet open={open} onClose={onClose} labelId="lx6-title">
      <img className="ax-later-mylo" src="/figma/apps/mylo-later.svg" alt="" width={92} height={110} />
      <h2 id="lx6-title" className="ax-moment-title">Coming in a later update</h2>
      <p className="ax-moment-body">Mylo starts small on purpose. This one opens once the daily loop is part of your day.</p>
      <div className="ax-tip"><Icon name="apps/i-bolt" size={24} className="c-amber" /><span className="t-body-s ax-14">Keep ticking. Levels open new things.</span></div>
      <div className="ax-moment-btns is-one">
        <button type="button" className="ax-btn" onClick={onClose}>Got it</button>
      </div>
    </MomentSheet>
  );
}

/* LX4 · Streak freeze saved you (878:114514). The streak and the freezes
   come from the server; this draws what it is given. */
export function FreezeSheet({ open, onClose, streak, freezes = { used: 1, of: 2 } }: { open: boolean; onClose: () => void; streak: number; freezes?: { used: number; of: number } }) {
  return (
    <MomentSheet open={open} onClose={onClose} labelId="lx4-title">
      <span className="ax-freeze">
        <img src="/figma/apps/lx-streak.svg" alt="" width={60} height={60} />
        <span className="ax-freeze-shield"><img src="/figma/apps/lx-shield.svg" alt="" width={24} height={24} /></span>
      </span>
      <h2 id="lx4-title" className="ax-moment-title is-24">Your streak is safe</h2>
      <p className="ax-moment-body">You missed yesterday. A freeze kept your {streak} day streak alive. Today counts double for Mylo.</p>
      <div className="ax-freezes">
        <div><p className="ax-14 ax-600">Freezes this week</p><p className="t-caption c-2">Next one arrives Monday</p></div>
        <span className="ax-slots">
          {Array.from({ length: freezes.of }, (_, i) => (
            <span key={i} className={`ax-slot${i < freezes.used ? ' is-used' : ''}`}><img src={`/figma/apps/${i < freezes.used ? 'lx-shield-on' : 'lx-shield-off'}.svg`} alt="" width={18} height={18} /></span>
          ))}
        </span>
      </div>
      <p className="ax-rule">Rule: never miss twice. Miss two days in a row and the streak starts again.</p>
      <div className="ax-moment-btns is-one">
        <Link href="/today" className="ax-btn" onClick={onClose}>Start today</Link>
      </div>
    </MomentSheet>
  );
}

/* LX3 · Flame unlocked (878:114447). A result moment: full screen, close at
   the top right, one main button. Shown when the server says Flame is
   reached. */
const LX3_CONFETTI: [number, number, string, number][] = [
  [60, 90, '#F5B83D', -30], [93, 127, '#FF6B6B', 20], [166, 165, '#4CD08A', -10], [239, 210, '#FFFFFF', 30], [312, 248, '#F5B83D', -20],
  [35, 94, '#FF6B6B', 15], [108, 131, '#4CD08A', -35], [181, 170, '#FFFFFF', 10], [254, 215, '#F5B83D', 40], [327, 253, '#FF6B6B', -15],
  [50, 99, '#4CD08A', 25], [123, 136, '#FFFFFF', -25], [196, 175, '#F5B83D', 35], [269, 219, '#FF6B6B', -40], [342, 258, '#4CD08A', 5],
  [65, 103, '#FFFFFF', -5], [138, 140, '#F5B83D', 45], [211, 180, '#FF6B6B', -45], [284, 224, '#4CD08A', 12], [357, 262, '#FFFFFF', -12],
  [80, 108, '#F5B83D', 28], [153, 145, '#FF6B6B', -28], [226, 192, '#4CD08A', 18], [299, 228, '#FFFFFF', -18]
];
export function FlameUnlocked({ open, onClose, level = 4 }: { open: boolean; onClose: () => void; level?: number }) {
  if (!open) return null;
  return (
    <div className="ax-flame" role="dialog" aria-modal="true" aria-labelledby="lx3-title">
      <div className="ax-flame-col">
        <button type="button" className="ax-flame-close" aria-label="Close" onClick={onClose}><Icon name="close" size={18} /></button>
        <Confetti pieces={LX3_CONFETTI} className="ax-flame-confetti" />
        <img className="ax-flame-badge" src="/figma/apps/badge-flame-200.svg" alt="" width={200} height={200} />
        <p className="ax-flame-level">Level {level}</p>
        <h2 id="lx3-title" className="ax-flame-title">Flame unlocked</h2>
        <p className="ax-flame-new">New for you</p>
        <div className="ax-flame-list">
          <Link href="/games" className="ax-flame-row" onClick={onClose}>
            <img src="/figma/apps/new-games.svg" alt="" width={32} height={32} />
            <span><span className="ax-flame-row-t">Games</span><span className="ax-flame-row-s">Chess and Chance with your room</span></span>
          </Link>
          <Link href="/challenges" className="ax-flame-row" onClick={onClose}>
            <img src="/figma/apps/new-swords.svg" alt="" width={32} height={32} />
            <span><span className="ax-flame-row-t">Challenges</span><span className="ax-flame-row-s">Dare a friend, or run one together</span></span>
          </Link>
        </div>
        <span className="spacer" />
        <Link href="/games" className="ax-btn ax-flame-try" onClick={onClose}>Try Games</Link>
        <button type="button" className="ax-btn ax-flame-later" onClick={onClose}>Later</button>
      </div>
    </div>
  );
}
