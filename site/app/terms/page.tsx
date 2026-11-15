import type { Metadata } from 'next';
import TextPage from '@/components/TextPage';
import { TERMS_PAGE } from '@/lib/content';

export const metadata: Metadata = { title: 'Terms · Mylo', alternates: { canonical: '/terms' } };

/* No Figma frame: laid out as "Web · Privacy" (1107:91594). */
export default function Page() {
  return <TextPage copy={TERMS_PAGE} />;
}
