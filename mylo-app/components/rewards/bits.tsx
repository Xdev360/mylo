'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { badgeArt, chestArt, levelArt, type Tier } from '@/lib/rewards';
import { canGoBack, goBack } from '@/components/NavMotion';

/* Small pieces shared by the rewards screens. */

/* "Nav · Back", 40 round on the surface grey. Back to the last screen, or to
   `fallback` when there is none. */
export function BackBtn({ fallback = '/rewards', light = false }: { fallback?: string; light?: boolean }) {
  const router = useRouter();
  return (
    <button type="button" className={`back-btn${light ? ' rw-on-dark' : ''}`} aria-label="Back"
            onClick={() => (canGoBack() ? goBack(router) : router.push(fallback))}>
      <Icon name="chevron-right" size={20} className="flip" />
    </button>
  );
}

/* "Nav · Close", top right on the celebration screens. */
export function CloseBtn({ onClick, href, light = false }: { onClick?: () => void; href?: string; light?: boolean }) {
  const cls = `back-btn rw-close${light ? ' rw-on-dark' : ''}`;
  if (href) return <Link href={href} className={cls} aria-label="Close" onClick={onClick}><Icon name="close" size={20} /></Link>;
  return <button type="button" className={cls} aria-label="Close" onClick={onClick}><Icon name="close" size={20} /></button>;
}

/* The gold key pill (XT9 "Keys", U11 "Cost"). */
export function KeyPill({ children, href, className = '' }: { children: React.ReactNode; href?: string; className?: string }) {
  const inner = <><img src="/figma/rewards/key.svg" alt="" width={24} height={24} /><span>{children}</span></>;
  return href ? <Link href={href} className={`rw-keys ${className}`}>{inner}</Link> : <span className={`rw-keys ${className}`}>{inner}</span>;
}

export function Chest({ tier, size }: { tier: Tier; size: number }) {
  return <img className="rw-chest" src={chestArt(tier)} alt="" width={size} height={size} draggable={false} />;
}

export function LevelBadge({ id, earned = true, size, glow }: { id: string; earned?: boolean; size: number; glow?: string }) {
  return (
    <img className="rw-hex" src={levelArt(id, earned)} alt="" width={size} height={size} draggable={false}
         style={{ '--glow': earned && glow ? glow : 'rgba(138,138,153,.28)', '--hs': `${size}px` } as React.CSSProperties} />
  );
}

export function AchBadge({ id, earned = true, size, glow }: { id: string; earned?: boolean; size: number; glow?: string }) {
  return (
    <img className="rw-hex" src={badgeArt(id, earned)} alt="" width={size} height={size} draggable={false}
         style={{ '--glow': earned && glow ? glow : 'rgba(138,138,153,.28)', '--hs': `${size}px` } as React.CSSProperties} />
  );
}

/* The little white lock disc on a locked badge or chest. */
export function LockDot({ size = 26 }: { size?: number }) {
  return (
    <span className="rw-lockdot" style={{ width: size, height: size }}>
      <img src="/figma/rewards/i-lock.svg" alt="" width={Math.round(size * 0.6)} height={Math.round(size * 0.6)} />
    </span>
  );
}

/* Confetti, the rectangles the frames scatter (L4, U5, U12, XT3 to XT5).
   Positions are the frame's, falling once when the screen opens. */
const BITS: [number, number, number, number, string, number][] = [
  [8, 12, 6, 10, '#F5A524', 20], [14, 30, 14, 15, '#F472B6', -15], [27, 50, 18, 14, '#3E7BFA', 35], [40, 70, 20, 12, '#2DD4BF', -30],
  [52, 88, 12, 13, '#FFFFFF', 12], [67, 22, 11, 14, '#F5A524', 40], [81, 40, 15, 16, '#F472B6', -20], [94, 60, 20, 11, '#3E7BFA', 15],
  [10, 78, 13, 13, '#2DD4BF', 45], [23, 6, 11, 14, '#FFFFFF', -35], [38, 32, 11, 17, '#F5A524', 25], [52, 52, 21, 20, '#F472B6', -10],
  [65, 72, 11, 7, '#3E7BFA', 30], [78, 90, 15, 14, '#2DD4BF', -40], [90, 16, 15, 19, '#FFFFFF', 18], [9, 42, 11, 20, '#F5A524', -25],
  [22, 62, 13, 12, '#F472B6', 38], [36, 82, 13, 10, '#3E7BFA', -12], [48, 6, 16, 14, '#2DD4BF', 28], [61, 28, 13, 21, '#FFFFFF', -32],
  [76, 52, 13, 13, '#F5A524', 22], [90, 72, 14, 12, '#F472B6', -18], [6, 92, 17, 9, '#3E7BFA', 42], [18, 18, 21, 20, '#2DD4BF', -8],
  [32, 40, 8, 11, '#FFFFFF', 33], [47, 62, 13, 15, '#F5A524', -28], [60, 84, 19, 16, '#F472B6', 14], [74, 8, 20, 9, '#3E7BFA', -38]
];
export function Confetti({ thin = false }: { thin?: boolean }) {
  return (
    <span className={`rw-confetti${thin ? ' is-thin' : ''}`} aria-hidden>
      {BITS.map(([x, y, w, h, c, r], i) => (
        <span key={i} style={{ left: `${x}%`, top: `${y}%`, width: thin ? Math.max(5, w * 0.45) : w * 0.7, height: thin ? Math.max(10, h * 0.9) : h * 0.7,
          background: c, rotate: `${r}deg`, '--d': `${(i % 7) * 60}ms` } as React.CSSProperties} />
      ))}
    </span>
  );
}

/* The sparkles on the dark stages. */
const STARS: [number, number, number][] = [[24, 14, 6], [76, 9, 4], [88, 30, 8], [10, 38, 5], [92, 62, 5], [18, 72, 7], [70, 84, 4], [50, 4, 3], [84, 88, 6], [40, 92, 3]];
export function Sparkles() {
  return (
    <span className="rw-sparkles" aria-hidden>
      {STARS.map(([x, y, s], i) => <span key={i} style={{ left: `${x}%`, top: `${y}%`, width: s, height: s, animationDelay: `${i * 240}ms` }} />)}
    </span>
  );
}

/* The day row in "This week" and DT10's Keys: one disc per day. */
export const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
