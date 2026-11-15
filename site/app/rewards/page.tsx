import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import { PlaySection, JoinSection } from '@/components/Sections';

export const metadata: Metadata = { title: 'Rewards · Mylo', alternates: { canonical: '/rewards' } };

/* Figma "Web · Rewards" (1131:123578): section 05, then the waitlist. */
export default function Page() {
  return (
    <>
      <PlaySection />
      <JoinSection />
      <Footer />
    </>
  );
}
