import Media from '@/components/rooms/Media';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Media id={id} />;
}
