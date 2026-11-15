import { HERO, LAUNCHED, SITE } from '@/lib/content';
import { HERO_ART } from '@/lib/theme';

/* Figma "01 Hero": wide 887:4, phone 887:185097, dark 893:199229 and
   893:204659, launch day 1109:2473.

   Wide: left-aligned at 92. The headline is 68/600, 1.12 leading, -2.5%
   tracking, in two lines 12 apart: "The [70px icon] goal app for people"
   (a row, 14 apart) and "who do better together.".

   Phone: centred. 40/600 in two lines 7 apart: "The [42px icon] goal app"
   (a row, 8 apart) and "for people who do better together." wrapping in
   329. Full-width buttons, 52 high.

   The words are the same; which runs are grey and where the line breaks
   are not, so the few runs that differ are swapped by breakpoint.

   The showcase is one composed scene (rings, three tilted phones, two
   Mylos, a chip) and differs per width and scheme, so it ships as the four
   exports, with the radius and soft shadow drawn here. They are vector
   (SVG), so they stay sharp at any zoom. The exports are each panel's
   "Stage", without the panel's 8px white frame around it (887:23, 887:185116,
   893:199248, 893:204678). One picture per scheme; the theme script has
   already asked for the one that will show (lib/theme.ts).

   It fades up like every section, but in CSS on load rather than on a
   scroll observer, so it paints before any JavaScript has run. */
export default function Hero() {
  const h = HERO.h1;
  return (
    <section id="hero" className="hero">
      <div className="hero-copy hero-in">
        <p className="hero-eyebrow">
          <span className="text-text-3">{HERO.eyebrow[0]}</span>
          {HERO.eyebrow[1] && <span className="text-ink">{HERO.eyebrow[1]}</span>}
        </p>

        <h1 className="hero-h1">
          <span className="hero-l1">
            <span>{h.first}</span>
            <img src="/brand/mylo-logo-192.webp" alt="" width={70} height={70} className="hero-icon" />
            <span>{h.afterIcon}<span className="hero-wide text-text-3"> {h.forPeople}</span></span>
          </span>
          <span className="hero-l2">
            <span className="hero-phone text-text-3">{h.forPeople} </span>
            <span className="text-text-3">{h.whoDo} </span>
            <span className="hero-better">{h.better} </span>
            {h.together}
          </span>
        </h1>

        <p className="hero-lead">{HERO.lead}</p>

        {/* Launch day keeps both buttons; only the first one changes, to
            "Open Mylo" and the app. */}
        <div className="hero-ctas">
          <a href={LAUNCHED ? SITE.appUrl : '#join'} className="btn-primary" data-cta="hero-primary">
            <img src="/figma/icon-sparkle.svg" alt="" width={23} height={23} />
            {HERO.cta}
          </a>
          <a href="#how" className="btn-secondary" data-cta="hero-how">
            <img src="/figma/icon-arrow.svg" alt="" width={23} height={23} />
            {HERO.secondaryCta}
          </a>
        </div>
      </div>

      <div className="hero-panel hero-in" style={{ animationDelay: '120ms' }}>
        {(['light', 'dark'] as const).map(scheme => (
          <picture key={scheme} className={`theme-${scheme}-only`}>
            <source media="(max-width: 767px)" srcSet={HERO_ART.phone[scheme]} width={341} height={458} />
            <img
              src={HERO_ART.wide[scheme]}
              alt={HERO.panelAlt}
              width={984}
              height={584}
              loading="lazy"
              fetchPriority="high"
            />
          </picture>
        ))}
      </div>
    </section>
  );
}
