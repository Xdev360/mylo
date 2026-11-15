import { Back } from '@/components/goals/Moments';

export const metadata = { title: 'Welcome back · Mylo' };

export default async function Page({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const { days } = await searchParams;
  return <Back days={Number(days) || undefined} />;
}
