import Chats from '@/components/rooms/Chats';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Chats id={id} />;
}
