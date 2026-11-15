import { ChatTheme } from '@/components/world/Themes';

export const metadata = { title: 'Chat theme · Mylo' };

/* A room links here with ?name=<room name> to say who else sees the theme. */
export default async function Page({ searchParams }: { searchParams: Promise<{ name?: string }> }) {
  const { name } = await searchParams;
  return <ChatTheme room={name} />;
}
