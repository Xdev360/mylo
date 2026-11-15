import '@/styles/rewards.css';
import Download from '@/components/rewards/Download';

export const metadata = { title: 'Download · Mylo' };

type Q = { kind?: string; id?: string; vs?: string; moves?: string };
export default async function Page({ searchParams }: { searchParams: Promise<Q> }) {
  const q = await searchParams;
  return <Download kind={q.kind ?? 'card'} id={q.id} vs={q.vs} moves={q.moves} />;
}
