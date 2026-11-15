import JoinRoom from '@/components/rooms/JoinRoom';

export const metadata = { title: 'Join a room · Mylo' };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const { code } = await searchParams;
  return <JoinRoom code={typeof code === 'string' ? code : ''} />;
}
