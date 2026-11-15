import type { Metadata } from 'next';
import BugForm from '@/components/BugForm';
import Footer from '@/components/Footer';
import Reveal from '@/components/Reveal';
import { BUG_PAGE } from '@/lib/content';

export const metadata: Metadata = {
  title: 'Report a bug · Mylo',
  description: BUG_PAGE.lead,
  alternates: { canonical: '/report-a-bug' }
};

/* A page of its own for testers, reached from the footer and Help rather than
   the navigation. The text-page heading over BugForm's two halves. */
export default function Page() {
  return (
    <>
      <div className="tp">
        <Reveal className="tp-head">
          <p className="tp-eyebrow">{BUG_PAGE.eyebrow}</p>
          <h1 className="tp-title">{BUG_PAGE.title}</h1>
          <p className="tp-lead">{BUG_PAGE.lead}</p>
        </Reveal>
        <Reveal><BugForm /></Reveal>
      </div>
      <Footer />
    </>
  );
}
