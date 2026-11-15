import { notFound } from 'next/navigation';
import { StyleStudio, type STab } from '@/components/world/Customise';

export const metadata = { title: 'Mylo style · Mylo' };

const TABS = ['colour', 'face', 'outfit', 'extras', 'background'];

export default async function Page({ params }: { params: Promise<{ tab: string }> }) {
  const { tab } = await params;
  if (!TABS.includes(tab)) notFound();
  return <StyleStudio start={tab as STab} />;
}
