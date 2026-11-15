import RoomSettings from '@/components/rooms/RoomSettings';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RoomSettings id={id} />;
}
