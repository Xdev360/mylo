import Reveal from './Reveal';
import WaitlistForm from './WaitlistForm';
import { JOIN, LAUNCHED, SITE, HERO } from '@/lib/content';

/* Figma frames "09 Waitlist" (887:4645) and 887:189327: one panel, centred,
   with a crowd of Mylos along the bottom edge. Two of the five and both
   pets are wide-screen only, which is what the phone frame shows.

   The crowd is placed as a percentage of the panel's width so it keeps its
   arrangement at any size, and the panel clips, they stand on its edge. */
export default function JoinPanel() {
  return (
    <Reveal className="join-panel">
      {/* The faint arcs Figma draws behind the panel: two rings, far wider
          than the panel, clipped by it. */}
      <span className="join-rings" aria-hidden />
      <img src="/brand/mylo-logo-192.webp" alt="" aria-hidden className="join-icon" />
      <h2 className="join-title">
        {JOIN.titleParts.map((part, i) => (
          <span key={i} className={part.dim ? 'text-text-3' : undefined}
                style={{ whiteSpace: 'pre-wrap' }}>
            {part.text}
          </span>
        ))}
      </h2>
      <p className="join-lead">
        {LAUNCHED ? JOIN.launchLead : <>
          <span className="join-phone">{JOIN.leadPhone}</span>
          <span className="join-wide">{JOIN.leadWide}</span>
        </>}
      </p>

      <div className="join-form">
        {LAUNCHED
          ? <>
              <a href={SITE.appUrl} className="btn-primary" data-cta="closing-open">
                <img src="/figma/icon-sparkle.svg" alt="" width={23} height={23} />
                {HERO.cta}
              </a>
              <p className="join-note">{JOIN.launchNote}</p>
            </>
          : <WaitlistForm />}
      </div>

      <div className="join-crowd" aria-hidden>
        {JOIN.crowd.map(m => (
          <img loading="lazy" decoding="async"
            key={m.shot}
            src={`/figma/${m.shot}.svg`}
            alt=""
            className={m.m ? 'join-mylo' : 'join-mylo join-wide-only'}
            style={{
              '--dx': m.d[0], '--dy': m.d[1], '--dw': m.d[2],
              '--mx': (m.m ?? m.d)[0], '--my': (m.m ?? m.d)[1], '--mw': (m.m ?? m.d)[2]
            } as React.CSSProperties}
          />
        ))}
      </div>
    </Reveal>
  );
}
