import '@/styles/profile.css';
import FriendView from '@/components/profile/FriendView';

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return { title: `@${decodeURIComponent(name)} · Mylo` };
}

export default async function Page({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return <FriendView username={decodeURIComponent(name)} />;
}
