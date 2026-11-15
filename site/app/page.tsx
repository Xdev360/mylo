import Hero from '@/components/Hero';
import Footer from '@/components/Footer';
import {
  WhySection, HowSection, PlanSection, PlaySection, PlaygroundSection,
  SafetySection, QuestionsSection, RoadmapSection, JoinSection
} from '@/components/Sections';

/* Figma "Web · Home (Launch 1)" (887:2): every section, top to bottom. */
export default function Home() {
  return (
    <>
      <Hero />
      <WhySection />
      <HowSection />
      <PlanSection />
      <PlaySection />
      <PlaygroundSection />
      <SafetySection />
      <QuestionsSection />
      <RoadmapSection />
      <JoinSection />
      <Footer />
    </>
  );
}
