import type { Metadata } from 'next';
import TextPage from '@/components/TextPage';
import { QUESTIONS_PAGE } from '@/lib/content';

export const metadata: Metadata = { title: 'Questions · Mylo', alternates: { canonical: '/questions' } };

/* Figma "Web · Questions" (1131:136496). */
export default function Page() {
  return <TextPage copy={QUESTIONS_PAGE} spaced />;
}
