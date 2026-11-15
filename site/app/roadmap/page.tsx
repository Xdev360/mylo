import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Reveal from '@/components/Reveal';
import FigIcon from '@/components/FigIcon';
import { ROADMAP_PAGE } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Roadmap · Mylo',
  alternates: { canonical: '/roadmap' }
};

/* Figma "Web · Roadmap" (879:194528), phone 879:194815, dark 893:198951.
   A header, then six releases pinned to the paper board: two columns on a
   wide sheet, one on a phone. The board and its cards keep their paper
   colours in dark mode, as the dark frame does. Each card tilts about its
   top-left corner, which is where Figma turns it from. */
export default function Roadmap() {
  const p = ROADMAP_PAGE;
  return (
    <>
      <div className="rm">
        <Reveal className="tp-head rm-head">
          <p className="tp-eyebrow">{p.eyebrow}</p>
          <h1 className="tp-title rm-title">{p.title}</h1>
          <p className="tp-lead">{p.lead}</p>
        </Reveal>

        <Reveal className="rm-board">
          {p.releases.map((r, i) => (
            <article key={r.name} className="rm-card"
                     style={{ '--rd': `${r.rot[0]}deg`, '--rm': `${r.rot[1]}deg`, '--i': i } as React.CSSProperties}>
              <img loading="lazy" decoding="async" src={`/figma/rm-pin-${i + 1}.svg`} alt="" aria-hidden width={40} height={52} className="rm-pin" />
              <p className="rm-when">{r.when}</p>
              <h2 className="rm-name">{r.name}</h2>
              <img loading="lazy" decoding="async" src={`/figma/rm-badge-${i + 1}.svg`} alt="" aria-hidden width={62} height={62} className="rm-badge" />
              <ul className="rm-items">
                {r.items.map(item => (
                  <li key={item}><FigIcon name="done-fill" />{item}</li>
                ))}
              </ul>
            </article>
          ))}
        </Reveal>

        <Reveal className="rm-note">
          <p className="rm-note-title">{p.note.title}</p>
          <p className="rm-note-body">{p.note.body}</p>
        </Reveal>
      </div>
      <Footer />
    </>
  );
}
