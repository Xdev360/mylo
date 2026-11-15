'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated, useLocal } from '@/lib/local';
import { GAMES, gameName, when, useResults, type GameId } from '@/lib/apps';
import { ME, useRooms } from '@/lib/rooms';
import ChessBoard from './ChessBoard';
import { CHESS_KEY, clockText, replay, type ChessSave } from './ChessGame';
import PickGameSheet from './PickGameSheet';
import { Avatar } from './ui';

/* G1 · Games hub (879:114475). Starts with the four games; the "Your move"
   card shows once a chess game is under way, and Recent fills as games end.
   Opened with ?room=<room id> it shows G9, Pick a game, for that
   room (the chat's + menu links here, or uses <PickGameSheet> itself). */
export default function GamesHub() {
  const ready = useHydrated();
  const router = useRouter();
  const params = useSearchParams();
  const { rooms } = useRooms();
  const roomId = params.get('room');
  const theRoom = rooms.find(r => r.id === roomId);
  const room = roomId ? theRoom?.name ?? params.get('name') ?? '' : null;
  const members = theRoom ? theRoom.members.filter(m => m.id !== ME).map(m => m.name) : [];
  const [results] = useResults();
  const [chess] = useLocal<ChessSave | null>(CHESS_KEY, null);
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const live = useMemo(() => (chess && !chess.over && chess.line.length ? replay(chess.line) : null), [chess]);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const match = (s: string) => !q || s.toLowerCase().includes(q.toLowerCase());
  const games = GAMES.filter(g => match(g.name));
  const recent = results.filter(r => match(gameName(r.game)) || match(r.vs)).slice(0, 8);
  const yourMove = live?.pos.turn === 'w';

  return (
    <main className="screen on-desk ax-games">
      <header className="ax-title ax-title-row">
        <div>
          <h1 className="ax-h1">Games</h1>
          <p className="ax-14 c-2">Play with your room. One move at a time.</p>
        </div>
        <button type="button" className="ax-round" aria-label="Search" aria-expanded={searching} onClick={() => { setSearching(s => !s); setQ(''); }}>
          <Icon name="apps/i-search" size={22} />
        </button>
      </header>
      {searching && (
        <label className="ax-search">
          <Icon name="apps/i-search" size={18} className="c-3" />
          <span className="sr-only">Search games</span>
          <input autoFocus type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search" />
        </label>
      )}

      {live && chess && (
        <section className="ax-turn">
          <Link href="/games/chess" aria-label="Open chess"><ChessBoard board={live.pos.board} className="is-thumb" /></Link>
          <div className="ax-turn-text">
            <span className="ax-turn-chip"><span className={`ax-dot${yourMove ? '' : ' is-wait'}`} />{yourMove ? 'Your move' : 'Their move'}</span>
            <p className="ax-turn-title">Chess with Mylo</p>
            <p className="t-body-s c-2">{clockText(chess.clocks.w)} left on your clock</p>
            <Link href="/games/chess" className="ax-small-btn">Play</Link>
          </div>
        </section>
      )}

      <section className="ax-block">
        <h2 className="ax-h2">Start a game</h2>
        <div className="ax-grid">
          {games.map(g => (
            <Link key={g.id} href={`/games/${g.id}`} className="ax-tile is-game">
              <img className="ax-app-icon" src={`/figma/apps/${g.icon}.svg`} alt="" width={48} height={48} />
              <span className="ax-tile-text"><span className="ax-tile-title is-17">{g.name}</span><span className="ax-tile-sub is-13">{g.players}</span></span>
            </Link>
          ))}
        </div>
        {q && !games.length && !recent.length && <p className="t-body c-2">Nothing matches &ldquo;{q}&rdquo;.</p>}
      </section>

      {recent.length > 0 && (
        <section className="ax-block">
          <h2 className="ax-h2">Recent</h2>
          <div className="ax-recent">
            {recent.map(r => (
              <Link key={r.id} href={`/games/${r.game}`} className="ax-recent-row">
                <Avatar name={r.vs} size={40} tint="var(--tint-green)" />
                <span className="ax-recent-text">
                  <span className="ax-recent-t">{r.outcome === 'won' ? `You beat ${r.vs} at ${gameName(r.game)}` : r.outcome === 'lost' ? `${r.vs} beat you at ${gameName(r.game)}` : `You drew with ${r.vs} at ${gameName(r.game)}`}</span>
                  <span className="t-body-s c-2">{when(r.at)}{r.moves ? ` · ${r.moves} moves` : r.how ? ` · ${r.how}` : ''}</span>
                </span>
                <Icon name="chevron-right" size={22} className="c-3" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <PickGameSheet open={room !== null} room={room ?? ''} members={members} onClose={() => router.replace('/games', { scroll: false })}
                     onPick={(game: GameId, who) => router.push(who ? `/games/${game}?invite=${encodeURIComponent(who)}&room=${encodeURIComponent(room ?? '')}` : `/games/${game}`)} />
    </main>
  );
}
