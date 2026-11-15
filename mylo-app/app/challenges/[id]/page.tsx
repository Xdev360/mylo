import { ChallengeDetail } from '@/components/apps/Challenges';

export const metadata = { title: 'Challenge · Mylo' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ChallengeDetail id={id} />;
}
