'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Icon from '@/components/Icon';
import { gameName, type GameId } from '@/lib/apps';
import * as C from './chess';
import ChessBoard from './ChessBoard';
import { Avatar, Head, useToast } from './ui';

const START = C.start().board;

/* G10 · Invite sent (879:114702). The invite stays open ten minutes; when
   it runs out, or is cancelled, it goes back to the games. Accepting happens
   on the other phone, through the room. */
export function InviteWaiting({ game, who, room }: { game: GameId; who: string; room: string }) {
  const router = useRouter();
  const [toast, showToast] = useToast();
  const [nudged, setNudged] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => router.replace('/games'), 10 * 60 * 1000);
    return () => clearTimeout(t);
  }, [router]);
  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-waiting">
      <Head title={`${gameName(game)} · ${who}`} fallback="/games" />
      <div className="ax-wait-art">
        {game === 'chess' ? <ChessBoard board={START} className="is-faded" /> : <img className="ax-wait-icon" src={`/figma/apps/app-${game === 'rush' ? 'rush' : game}.svg`} alt="" />}
        <span className="ax-pulse" />
        <span className="ax-wait-avatar"><Avatar name={who} size={88} tint="var(--tint-amber)" /></span>
      </div>
      <h1 className="ax-moment-title is-24">Waiting for {who}</h1>
      <p className="ax-14 c-2 ax-center ax-wait-sub">We sent the invite to {room || 'the room'}. It stays open for 10 minutes.</p>
      <span className="spacer" />
      <div className="ax-moment-btns">
        <button type="button" className="ax-btn" disabled={nudged} onClick={() => { setNudged(true); showToast(`Nudged ${who}`); }}>
          <Icon name="bell" size={22} />Nudge {who}
        </button>
        <button type="button" className="ax-btn ax-btn-soft" onClick={() => router.replace('/games')}>Cancel invite</button>
      </div>
      {toast}
    </main>
  );
}

/* G11 · Invite in chat (879:114833): the card a game invite makes in the
   room's chat. For the rooms screens to drop into the message list. */
export function GameInviteCard({ game, from, joined = [], minutesLeft = 10, mine = false }: {
  game: GameId; from: string; joined?: string[]; minutesLeft?: number; mine?: boolean;
}) {
  return (
    <article className="ax-invite-card">
      <div className="ax-invite-top">
        {game === 'chess' ? <ChessBoard board={START} className="is-invite" /> : <img src={`/figma/apps/app-${game}.svg`} alt="" width={96} height={96} className="ax-invite-icon" />}
        <div className="ax-invite-text">
          <p className="ax-12 ax-600 c-2">{gameName(game)}</p>
          <p className="ax-invite-t">{mine ? 'You want to play' : `${from} wants to play`}</p>
          <span className="spacer" />
          <p className="t-caption c-2">{minutesLeft > 0 ? `Open for ${minutesLeft} min` : 'Closed'}</p>
        </div>
      </div>
      {joined.length > 0 && <>
        <p className="ax-13 ax-600">{joined.length === 1 ? `${joined[0]} joined` : `${joined.length} joined`}</p>
        <div className="ax-joined">{joined.map(j => <Avatar key={j} name={j} size={28} tint="var(--tint-amber)" />)}</div>
      </>}
      <div className="ax-invite-btns">
        <Link href={`/games/${game}`} className="ax-small-btn is-40">Play now</Link>
        <Link href={`/games/${game}`} className="ax-small-btn is-40 is-light">Watch</Link>
      </div>
    </article>
  );
}
