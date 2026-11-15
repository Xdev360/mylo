import { notFound } from 'next/navigation';
import SettingsRoute from '@/components/system/SettingsRoute';
import { SETTINGS_PAGES, type SettingsSlug } from '@/components/system/pages';

/* ST2–ST13 and the pages they lead to. */
type Props = { params: Promise<{ page: string }> };

export function generateStaticParams() {
  return Object.keys(SETTINGS_PAGES).map(page => ({ page }));
}

export async function generateMetadata({ params }: Props) {
  const { page } = await params;
  const title = SETTINGS_PAGES[page as SettingsSlug];
  return { title: title ? `${title} · Mylo` : 'Mylo' };
}

export default async function SettingsPage({ params }: Props) {
  const { page } = await params;
  if (!(page in SETTINGS_PAGES)) notFound();
  return <SettingsRoute page={page as SettingsSlug} />;
}
