import { NewChallenge } from '@/components/apps/Challenges';

export const metadata = { title: 'New challenge · Mylo' };

export default async function Page({ searchParams }: { searchParams: Promise<{ dare?: string; kind?: string }> }) {
  const { dare, kind } = await searchParams;
  return <NewChallenge dareTo={dare} dare={kind === 'dare'} />;
}
