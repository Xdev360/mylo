import { PhotoDone } from '@/components/world/Photo';

export const metadata = { title: 'Photo · Mylo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PhotoDone id={id} />;
}
