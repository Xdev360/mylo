import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Reveal from '@/components/Reveal';
import dynamic from 'next/dynamic';

// The board's code loads on its own, after the rest of the page.
const PlaygroundBoard = dynamic(() => import('@/components/PlaygroundBoard'), {
  loading: () => <div className="pgp-board" aria-hidden />
});
import { JoinSection } from '@/components/Sections';
import { PLAYGROUND_PAGE as PP } from '@/lib/content';

export const metadata: Metadata = { title: 'Playground · Mylo', alternates: { canonical: '/playground' } };

/* Figma "Web · Playground" (1134:1037): a header, the board tools, the big
   playable board, "How it plays", then the waitlist. */
export default function Page() {
  return (
    <>
      <section className="pgp-page">
        <Reveal className="pgp-head">
          <p className="tp-eyebrow">{PP.eyebrow}</p>
          <h1 className="pgp-title">{PP.title}</h1>
          <p className="pgp-lead">
            <span className="desktop:hidden">{PP.leadPhone}</span>
            <span className="hidden desktop:inline">{PP.leadWide}</span>
          </p>
        </Reveal>
        <PlaygroundBoard />
        <h2 className="pgp-how-title">{PP.howTitle}</h2>
        <Reveal className="pgp-how">
          {PP.how.map((h, i) => (
            <article key={h.n} className="pgp-how-card">
              <img loading="lazy" decoding="async" src={`/figma/pgp-how-${i + 1}.svg`} alt="" width={182} height={120} className="pgp-how-art" />
              <span className="pgp-how-n">{h.n}</span>
              <h3 className="pgp-how-name">{h.title}</h3>
              <p className="pgp-how-body">{h.body}</p>
            </article>
          ))}
        </Reveal>
      </section>
      <JoinSection />
      <Footer />
    </>
  );
}
