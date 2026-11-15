import Members from '@/components/rooms/Members';

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ invite?: string }> }) {
  const { id } = await params;
  const { invite } = await searchParams;
  return <Members id={id} invite={invite === '1'} />;
}
