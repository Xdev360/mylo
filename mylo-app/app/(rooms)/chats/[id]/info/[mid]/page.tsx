import MessageInfo from '@/components/rooms/MessageInfo';

export default async function Page({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  return <MessageInfo id={id} mid={mid} />;
}
