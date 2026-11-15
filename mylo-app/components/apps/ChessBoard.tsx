'use client';

import type { Board } from './chess';

/* The board as drawn on G2 (879:115003): cream and walnut squares, ranks in
   the top corner of the a-file, files in the bottom corner of the first
   rank, soft dots for where the picked piece can go. The same board, smaller
   and still, sits in the G1 card, G4 and the invite screens. */
const LIGHT = '#F0E5D1', DARK = '#A18769';

export default function ChessBoard({ board, className = '', selected = null, targets = [], last = null, check = null, onSquare, label = 'Chess board' }: {
  board: Board; className?: string; selected?: number | null; targets?: number[]; last?: [number, number] | null; check?: number | null;
  onSquare?: (i: number) => void; label?: string;
}) {
  const live = !!onSquare;
  return (
    <div className={`ax-board ${className}`} role={live ? 'grid' : 'img'} aria-label={label}>
      {board.map((p, i) => {
        const f = i % 8, r = 8 - Math.floor(i / 8);
        const dark = (f + r) % 2 === 1;
        const cls = ['ax-sq', selected === i && 'is-sel', last && (last[0] === i || last[1] === i) && 'is-last', check === i && 'is-check', targets.includes(i) && (p ? 'is-take' : 'is-to')].filter(Boolean).join(' ');
        const inner = (
          <>
            {f === 0 && <span className="ax-rank">{r}</span>}
            {r === 1 && <span className="ax-file">{'abcdefgh'[f]}</span>}
            {p && <img src={`/figma/apps/piece-${p}.svg`} alt="" draggable={false} />}
          </>
        );
        const style = { background: dark ? DARK : LIGHT, color: dark ? '#1C1C20' : '#3A3A40' };
        return live
          ? <button key={i} type="button" className={cls} style={style} onClick={() => onSquare!(i)}
                    aria-label={`${'abcdefgh'[f]}${r}${p ? ` ${p[0] === 'w' ? 'white' : 'black'} ${NAMES[p[1]]}` : ''}`}>{inner}</button>
          : <span key={i} className={cls} style={style}>{inner}</span>;
      })}
    </div>
  );
}
const NAMES: Record<string, string> = { P: 'pawn', N: 'knight', B: 'bishop', R: 'rook', Q: 'queen', K: 'king' };
