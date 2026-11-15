import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import { HowSection, PlanSection, JoinSection } from '@/components/Sections';

export const metadata: Metadata = { title: 'How it works · Mylo', alternates: { canonical: '/how-it-works' } };

/* Figma "Web · How it works" (1131:113152): sections 03 and 04, then the waitlist. */
export default function Page() {
  return (
    <>
      <HowSection eager />
      <PlanSection />
      <JoinSection />
      <Footer />
    </>
  );
}
