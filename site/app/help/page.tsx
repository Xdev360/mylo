import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Reveal from '@/components/Reveal';
import HelpTopics from '@/components/HelpTopics';
import { ContactCard } from '@/components/TextPage';
import { HELP_PAGE } from '@/lib/content';

export const metadata: Metadata = { title: 'Help · Mylo', alternates: { canonical: '/help' } };

/* Figma "Web · Help" (1107:91836): the text-page shape with a search field
   and six topic cards between the header and the questions. */
export default function Page() {
  return (
    <>
      <div className="tp">
        <Reveal className="tp-head">
          <p className="tp-eyebrow">{HELP_PAGE.eyebrow}</p>
          <h1 className="tp-title">{HELP_PAGE.title}</h1>
          <p className="tp-lead">{HELP_PAGE.lead}</p>
        </Reveal>
        <HelpTopics />
        <Reveal><ContactCard contact={HELP_PAGE.contact} /></Reveal>
      </div>
      <Footer />
    </>
  );
}
