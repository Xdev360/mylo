import '@/styles/rewards.css';
import CardDetail from '@/components/rewards/CardDetail';

export const metadata = { title: 'Card · Mylo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CardDetail id={id} />;
}
