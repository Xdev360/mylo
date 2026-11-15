import { UseKey } from '@/components/world/House';

export const metadata = { title: 'Use a key · Mylo' };

export default async function Page({ params }: { params: Promise<{ style: string }> }) {
  const { style } = await params;
  return <UseKey style={style} />;
}
