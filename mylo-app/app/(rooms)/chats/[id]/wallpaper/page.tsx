import Wallpaper from '@/components/rooms/Wallpaper';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Wallpaper id={id} />;
}
