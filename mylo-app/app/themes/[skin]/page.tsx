import { notFound } from 'next/navigation';
import { SkinPreview } from '@/components/world/Themes';

export const metadata = { title: 'Theme preview · Mylo' };

export default async function Page({ params }: { params: Promise<{ skin: string }> }) {
  const { skin } = await params;
  if (skin !== 'blush' && skin !== 'gym') notFound();
  return <SkinPreview skin={skin} />;
}
