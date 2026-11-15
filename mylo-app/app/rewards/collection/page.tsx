import '@/styles/rewards.css';
import Collection from '@/components/rewards/Collection';

export const metadata = { title: 'Collection · Mylo' };

export default async function Page({ searchParams }: { searchParams: Promise<{ pick?: string }> }) {
  const { pick } = await searchParams;
  return <Collection pick={pick === '1'} />;
}
