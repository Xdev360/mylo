'use client';

import { useSearchParams } from 'next/navigation';
import type { GameId } from '@/lib/apps';
import ChanceGame from './ChanceGame';
import ChessGame from './ChessGame';
import { InviteWaiting } from './Invites';
import RushGame from './RushGame';
import ScrabbleGame from './ScrabbleGame';

/* /games/[game]: the game itself, or G10 while an invite is out
   (?invite=<name>&room=<room name>). */
export default function GameScreen({ game }: { game: GameId }) {
  const params = useSearchParams();
  const invite = params.get('invite');
  if (invite) return <InviteWaiting game={game} who={invite} room={params.get('room') ?? ''} />;
  if (game === 'chess') return <ChessGame />;
  if (game === 'scrabble') return <ScrabbleGame />;
  if (game === 'rush') return <RushGame />;
  return <ChanceGame />;
}
