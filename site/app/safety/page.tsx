import type { Metadata } from 'next';
import TextPage from '@/components/TextPage';
import { SAFETY_PAGE } from '@/lib/content';

export const metadata: Metadata = { title: 'Safety · Mylo', alternates: { canonical: '/safety' } };

/* Figma "Web · Safety" (1107:91388). */
export default function Page() {
  return <TextPage copy={SAFETY_PAGE} />;
}
