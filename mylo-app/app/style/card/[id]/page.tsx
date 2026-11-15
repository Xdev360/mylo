import { BackdropCard } from '@/components/world/Customise';

export const metadata = { title: 'New background · Mylo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BackdropCard id={id} />;
}
