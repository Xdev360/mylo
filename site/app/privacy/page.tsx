import type { Metadata } from 'next';
import TextPage from '@/components/TextPage';
import { PRIVACY_PAGE } from '@/lib/content';

export const metadata: Metadata = { title: 'Privacy · Mylo', alternates: { canonical: '/privacy' } };

/* Figma "Web · Privacy" (1107:91594). */
export default function Page() {
  return <TextPage copy={PRIVACY_PAGE} />;
}
