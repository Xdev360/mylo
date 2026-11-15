import Footer from './Footer';
import Reveal from './Reveal';
import type { TextPageCopy, TextSection } from '@/lib/content';

/* Questions, Safety, Privacy and Help share one shape in Figma
   ("Web · Questions" 1131:136496 and its siblings): a header, a 640 column
   of sections 36 apart, and a dark contact card 740 wide at the end. On a
   phone the column is 329, the gap 28 and the card stacks.

   The answer text is its own colour in the file, #4A4A52, #C9C9D1 in dark -
   darker than the lead and lighter than ink, so it gets its own token. */

export function TextSections({ sections }: { sections: TextSection[] }) {
  return (
    <>
      {sections.map(s => (
        <section key={s.title} className="tp-section">
          <h2 className="tp-q">{s.title}</h2>
          {s.body && <p className="tp-a">{s.body}</p>}
          {s.bullets && (
            <ul className="tp-bullets">
              {s.bullets.map(b => <li key={b} className="tp-a">{b}</li>)}
            </ul>
          )}
        </section>
      ))}
    </>
  );
}

export function ContactCard({ contact }: { contact: TextPageCopy['contact'] }) {
  return (
    <div className="tp-contact">
      <div className="tp-contact-text">
        <p className="tp-contact-title">{contact.title}</p>
        <p className="tp-contact-body">{contact.body}</p>
      </div>
      <a href={contact.href} className="tp-contact-cta">{contact.cta}</a>
    </div>
  );
}

/* `spaced` is the Questions and Help rhythm: Figma pads each answer 24
   below on those two, so consecutive questions sit further apart than the
   sections of Safety and Privacy do. */
export default function TextPage({
  copy, spaced = false, children
}: { copy: TextPageCopy; spaced?: boolean; children?: React.ReactNode }) {
  return (
    <>
      <div className="tp">
        <Reveal className="tp-head">
          <p className="tp-eyebrow">{copy.eyebrow}</p>
          <h1 className="tp-title">{copy.title}</h1>
          <p className="tp-lead">{copy.lead}</p>
        </Reveal>
        {children}
        <Reveal className={`tp-col${spaced ? ' tp-spaced' : ''}`}>
          <TextSections sections={copy.sections} />
        </Reveal>
        <Reveal><ContactCard contact={copy.contact} /></Reveal>
      </div>
      <Footer />
    </>
  );
}
