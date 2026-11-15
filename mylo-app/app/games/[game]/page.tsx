import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import GameScreen from '@/components/apps/GameScreen';
import type { GameId } from '@/lib/apps';

/* The page is a server component and lib/apps is client code, so the ids
   are listed here rather than read from it. */
const GAME_IDS: GameId[] = ['chess', 'scrabble', 'rush', 'chance'];

export const metadata = { title: 'Games · Mylo' };
export function generateStaticParams() { return GAME_IDS.map(game => ({ game })); }

export default async function Page({ params }: { params: Promise<{ game: string }> }) {
  const { game } = await params;
  if (!GAME_IDS.includes(game as GameId)) notFound();
  return <Suspense fallback={<main className="screen on-desk" aria-busy="true" />}><GameScreen game={game as GameId} /></Suspense>;
}
