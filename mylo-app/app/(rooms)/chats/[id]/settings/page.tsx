import ChatSettings from '@/components/rooms/ChatSettings';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChatSettings id={id} />;
}
