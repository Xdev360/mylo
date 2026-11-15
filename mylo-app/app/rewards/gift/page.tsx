import '@/styles/rewards.css';
import GiftView from '@/components/rewards/Gift';

export const metadata = { title: 'Gift a card · Mylo' };

export default async function Page({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const { card } = await searchParams;
  return <GiftView cardId={card} />;
}
