import Link from 'next/link';
import Icon from '@/components/Icon';

/* EM1 · Rewards · empty (528:103886), EM2 · Friends · empty (528:103947),
   EM3 · Journal · empty (528:104008): Mylo in a disc, a line, one button.
   Exported for the screens that own those lists: the friends list and the
   journal render EM2 and EM3 when they are empty, the treats list EM1.
   `compact` drops the outer padding to sit inside another screen. */

function Empty({ art, title, sub, cta, icon, href, onClick, compact }: {
  art: string; title: string; sub: string; cta: string; icon: string; href?: string; onClick?: () => void; compact?: boolean;
}) {
  const btn = <><Icon name={icon} size={20} />{cta}</>;
  return (
    <section className={`rw-empty${compact ? ' is-compact' : ''}`}>
      <span className="rw-empty-disc"><img src={art} alt="" width={126} height={151} /></span>
      <h2 className="rw-empty-title">{title}</h2>
      <p className="rw-empty-sub">{sub}</p>
      {href ? <Link href={href} className="btn-primary rw-empty-btn">{btn}</Link>
        : <button type="button" className="btn-primary rw-empty-btn" onClick={onClick}>{btn}</button>}
    </section>
  );
}

export function RewardsEmpty({ href = '/milestones', onClick, compact }: { href?: string; onClick?: () => void; compact?: boolean }) {
  return <Empty art="/figma/rewards/mylo-starry.svg" title="Pick your first treat" sub="Netflix, a nap, a call. Mylo holds it until you finish."
                cta="Add a reward" icon="rewards/i-gift" href={onClick ? undefined : href} onClick={onClick} compact={compact} />;
}

export function FriendsEmpty({ href = '/friends/add', onClick, compact }: { href?: string; onClick?: () => void; compact?: boolean }) {
  return <Empty art="/figma/rewards/mylo-love.svg" title="Mylo is better with friends" sub="Add 2 friends to unlock the Photo studio."
                cta="Invite a friend" icon="rewards/i-user-plus" href={onClick ? undefined : href} onClick={onClick} compact={compact} />;
}

export function JournalEmpty({ href = '/journal', onClick, compact }: { href?: string; onClick?: () => void; compact?: boolean }) {
  return <Empty art="/figma/rewards/mylo-calm.svg" title="One line a day" sub="Write what made today good. Takes 30 seconds."
                cta="Write the first one" icon="rewards/i-pencil" href={onClick ? undefined : href} onClick={onClick} compact={compact} />;
}
