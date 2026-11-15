import Section from './Section';
import Reveal from './Reveal';
import Faq from './Faq';
import dynamic from 'next/dynamic';

// The playground's code loads on its own, after the rest of the page.
const Playground = dynamic(() => import('./Playground'), {
  loading: () => <div className="pg-canvas" aria-hidden />
});
import Pinboard from './Pinboard';
import HowPanels from './HowPanels';
import PlanTiles from './PlanTiles';
import PlayBlocks from './PlayBlocks';
import SafetyCards from './SafetyCards';
import RoadmapTeaser from './RoadmapTeaser';
import JoinPanel from './JoinPanel';
import FigIcon from './FigIcon';
import { WHY, HOW, PLAN, PLAY, PLAYGROUND,
         SAFETY_SECTION, QUESTIONS, ROADMAP_TEASER } from '@/lib/content';

/* Every home section as its own component. The home page strings all of
   them together; How it works, Rewards and the rest are the same sections
   in a different order, which is how the Figma pages are built, so they
   share one definition and cannot drift apart. */

export function WhySection() {
  return (
    <>
    {/* ── Why we built it ──────────────────────────────────────────────
        Frame 887:1037. Centred, unlike the hero: an opening line at 28,
        the heading with the app icon set into it, then the pinboard. */}
    <Section id="why" className="desktop:!pt-20 desktop:!pb-[50px]">
      <Reveal className="mx-auto max-w-[800px] text-center">
        <p className="t-intro">
          {WHY.intro.map((run, i) => (
            <span key={i} className={run.dim ? 'text-text-3' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}>
              {run.text}
            </span>
          ))}
        </p>
      </Reveal>

      <Reveal delay={80} className="mt-14 text-center desktop:mt-[103px]">
        <h2 className="t-display-m inline-flex flex-wrap items-center justify-center gap-x-[.273em] gap-y-2">
          {WHY.headingBefore}
          <img src="/brand/mylo-logo-192.webp" alt="" width={48} height={48}
               className="h-[1.09em] w-[1.09em]" />
          {WHY.headingAfter}
        </h2>
      </Reveal>

      <Pinboard />
    </Section>
    </>
  );
}

export function HowSection({ eager = false }: { eager?: boolean }) {
  return (
    <>
    {/* ── How it works ──────────────────────────────────────────────────
        Frame 887:1648. The heading sits on the text gutter at 92 while
        the two panels run out to the section's own 62. */}
    <Section id="how" className="!py-8 desktop:!pt-10 desktop:!pb-[30px]">
      <Reveal className="ml-2 desktop:ml-[30px]">
        <p className="t-eyebrow text-text-3">{HOW.eyebrow}</p>
        <h2 className="t-display-l mt-[10px] max-w-[860px] desktop:mt-4">
          {HOW.titleParts.map((part, i) => (
            <span key={i} className={part.dim ? 'text-text-3' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}>
              {part.text}
            </span>
          ))}
        </h2>
      </Reveal>

      <div className="mt-[59px] desktop:mt-[62px]">
        <HowPanels eager={eager} />
      </div>
    </Section>
    </>
  );
}

export function PlanSection() {
  return (
    <>
    {/* ── Plan ──────────────────────────────────────────────────────────
        Frame 887:2482. Same shape as How it works: the text on the 88
        gutter, the tiles out to the section's own 62. */}
    <Section id="plan" className="!pt-8 !pb-[22px] desktop:!pt-[60px] desktop:!pb-[54px]">
      <Reveal className="ml-2 desktop:ml-[30px]">
        <p className="t-eyebrow text-text-3">{PLAN.eyebrow}</p>
        <h2 className="t-display-l mt-[10px] max-w-[900px] desktop:mt-4">
          {PLAN.titleParts.map((part, i) => (
            <span key={i} className={part.dim ? 'text-text-3' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}>
              {part.text}
            </span>
          ))}
        </h2>
        <p className="t-lead mt-5 max-w-[620px] text-text-2 desktop:mt-5">
          <span className="desktop:hidden">{PLAN.leadPhone}</span>
          <span className="hidden desktop:inline">{PLAN.leadWide}</span>
        </p>
      </Reveal>

      <div className="mt-[42px] desktop:mt-[60px]">
        <PlanTiles />
      </div>
    </Section>
    </>
  );
}

export function PlaySection() {
  return (
    <>
    {/* ── Play ──────────────────────────────────────────────────────────
        Frame 887:3041. Four blocks under one heading. */}
    <Section id="rewards" className="!pt-8 !pb-10 desktop:!pt-[60px] desktop:!pb-[30px]">
      <Reveal className="ml-2 desktop:ml-[30px]">
        <p className="t-eyebrow text-text-3">{PLAY.eyebrow}</p>
        <h2 className="t-display-l mt-[10px] max-w-[900px] desktop:mt-4">
          {PLAY.titleParts.map((part, i) => (
            <span key={i} className={part.dim ? 'text-text-3' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}>
              {part.text}
            </span>
          ))}
        </h2>
        <p className="t-lead mt-5 max-w-[620px] text-text-2">
          <span className="desktop:hidden">{PLAY.leadPhone}</span>
          <span className="hidden desktop:inline">{PLAY.leadWide}</span>
        </p>
      </Reveal>

      <div className="mt-[42px] desktop:mt-[60px]">
        <PlayBlocks />
      </div>
    </Section>
    </>
  );
}

export function PlaygroundSection() {
  return (
    <>
    {/* ── Playground ───────────────────────────────────────────────── */}
    <Section id="playground" className="!pt-8 !pb-6 desktop:!pt-[60px] desktop:!pb-10">
      <Reveal className="ml-2 desktop:ml-[30px]">
        <p className="t-eyebrow text-text-3">{PLAYGROUND.eyebrow}</p>
        <h2 className="t-display-l mt-[10px] max-w-[900px] desktop:mt-4">
          {PLAYGROUND.titleParts.map((part, i) => (
            <span key={i} className={part.dim ? 'text-text-3' : undefined}>{part.text}</span>
          ))}
        </h2>
        <p className="t-lead mt-4 max-w-[620px] text-text-2 desktop:mt-5">
          <span className="desktop:hidden">{PLAYGROUND.leadPhone}</span>
          <span className="hidden desktop:inline">{PLAYGROUND.leadWide}</span>
        </p>
      </Reveal>
      <div className="mt-8 desktop:mt-[46px]"><Playground /></div>
    </Section>
    </>
  );
}

export function SafetySection() {
  return (
    <>
    {/* ── Safety ───────────────────────────────────────────────────── */}
    <Section id="safety" className="!pt-8 !pb-6 desktop:!pt-[60px] desktop:!pb-[70px]">
      <Reveal className="ml-2 desktop:ml-[30px]">
        <p className="t-eyebrow text-text-3">{SAFETY_SECTION.eyebrow}</p>
        <h2 className="t-display-l mt-[10px] max-w-[900px] desktop:mt-4">{SAFETY_SECTION.title}</h2>
      </Reveal>
      <div className="mt-[30px] desktop:mt-[58px]"><SafetyCards /></div>
    </Section>
    </>
  );
}

export function QuestionsSection() {
  return (
    <>
    {/* ── Questions ─────────────────────────────────────────────────────
        Frame 887:4619. The heading and the way out sit on the left, the
        cards on the right; the phone stacks them with the button last. */}
    <Section id="questions" className="!pt-8 !pb-8 desktop:!pt-[60px] desktop:!pb-[60px]">
      <div className="desktop:grid desktop:grid-cols-[418px_1fr] desktop:gap-x-0">
        <Reveal className="ml-2 desktop:ml-[30px]">
          <p className="t-eyebrow text-text-3">{QUESTIONS.eyebrow}</p>
          <h2 className="t-display-l mt-[10px] desktop:mt-4">{QUESTIONS.title}</h2>
          <p className="t-lead mt-4 hidden max-w-[300px] text-text-2 desktop:block">{QUESTIONS.lead}</p>
          <a href={QUESTIONS.ctaHref} className="roadmap-cta mt-[18px] hidden desktop:inline-flex">
            <FigIcon name="send" />{QUESTIONS.cta}
          </a>
        </Reveal>

        <Reveal delay={60} className="mt-7 desktop:mt-0">
          <Faq />
          <a href={QUESTIONS.ctaHref} className="roadmap-cta mt-[20px] w-full justify-center desktop:hidden">
            <FigIcon name="send" />{QUESTIONS.cta}
          </a>
        </Reveal>
      </div>
    </Section>
    </>
  );
}

export function RoadmapSection() {
  return (
    <>
    {/* ── Roadmap teaser ────────────────────────────────────────────── */}
    <Section id="roadmap" className="!pt-6 !pb-8 desktop:!pt-20 desktop:!pb-[48px]">
      <Reveal className="ml-2 desktop:ml-[30px]">
        <p className="t-eyebrow text-text-3">{ROADMAP_TEASER.eyebrow}</p>
        <h2 className="t-display-l mt-[10px] max-w-[860px] desktop:mt-[14px]">
          {ROADMAP_TEASER.titleParts.map((part, i) => (
            <span key={i} className={part.dim ? 'text-text-3' : undefined}
                  style={{ whiteSpace: 'pre-wrap' }}>
              {part.text}
            </span>
          ))}
        </h2>
        <p className="t-lead mt-4 max-w-[640px] text-text-2 desktop:mt-5">{ROADMAP_TEASER.lead}</p>
      </Reveal>
      <div className="mt-8 desktop:mt-10"><RoadmapTeaser /></div>
    </Section>
    </>
  );
}

export function JoinSection() {
  return (
    <>
    {/* ── Waitlist ──────────────────────────────────────────────────── */}
    <Section id="join" className="!pt-5 !pb-5 desktop:!pt-10 desktop:!pb-10">
      <JoinPanel />
    </Section>
    </>
  );
}
