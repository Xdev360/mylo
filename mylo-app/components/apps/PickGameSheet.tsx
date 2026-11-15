'use client';

import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { GAMES, type GameId } from '@/lib/apps';

/* G9 · Pick a game (879:114648), opened from a room's chat. The room's
   people come in as `members`; pick who to invite, then a game. With no one
   picked, the game opens to play against Mylo. */
export default function PickGameSheet({ open, onClose, room, members, onPick }: {
  open: boolean; onClose: () => void; room: string; members: string[]; onPick: (game: GameId, invite: string | null) => void;
}) {
  const [who, setWho] = useState<string | null>(null);
  const invite = who ?? (members.length === 1 ? members[0] : null);
  return (
    <Sheet open={open} onClose={onClose} title={`Play in ${room}`}>
      <div className="ax-pick-list">
        {GAMES.map(g => (
          <button key={g.id} type="button" className="ax-pick-row" onClick={() => onPick(g.id, invite)}>
            <img src={`/figma/apps/${g.icon}.svg`} alt="" width={48} height={48} />
            <span className="ax-pick-text"><span className="ax-pick-t">{g.name}</span><span className="t-body-s c-2">{g.pick}</span></span>
            <Icon name="chevron-right" size={24} className="c-3" />
          </button>
        ))}
      </div>
      {members.length > 0 && (
        <div className="ax-invite">
          <p className="ax-13 ax-600 c-2">Invite</p>
          <div className="ax-chips">
            {members.map(m => (
              <button key={m} type="button" className={`ax-chip is-sm${invite === m ? ' is-on' : ''}`} aria-pressed={invite === m} onClick={() => setWho(who === m ? null : m)}>{m}</button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
