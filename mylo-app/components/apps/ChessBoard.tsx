'use client';

import { useLayoutEffect, useRef } from 'react';
import type { Board } from './chess';
import { lessMotion } from './motion';

/* The board as drawn on G2 (879:115003): cream and walnut squares, ranks in
   the top corner of the a-file, files in the bottom corner of the first
   rank, soft dots for where the picked piece can go. The same board, smaller
   and still, sits in the G1 card, G4 and the invite screens.

   On the live board a move glides: the piece travels from its old square to
   the new one (the rook too, when castling) and a taken piece shrinks away.
   `name` gives the board a view-transition-name, so the G1 card grows into
   the game and the game board settles into G4. */
const LIGHT = '#F0E5D1', DARK = '#A18769';
const EASE = 'cubic-bezier(.22,1,.36,1)';

export default function ChessBoard({ board, className = '', selected = null, targets = [], last = null, check = null, onSquare, label = 'Chess board', name }: {
  board: Board; className?: string; selected?: number | null; targets?: number[]; last?: [number, number] | null; check?: number | null;
  onSquare?: (i: number) => void; label?: string; name?: string;
}) {
  const live = !!onSquare;
  const ref = useRef<HTMLDivElement>(null);
  const seen = useRef<{ key: string | null; board: Board }>({ key: last ? `${last[0]}-${last[1]}` : null, board });

  useLayoutEffect(() => {
    const key = last ? `${last[0]}-${last[1]}` : null;
    const before = seen.current;
    seen.current = { key, board };
    const root = ref.current;
    if (!live || !root || !last || key === before.key || lessMotion()) return;
    const [from, to] = last;
    const glide = (a: number, b: number, ms = 280) => {
      const sq = root.children[b] as HTMLElement | undefined;
      const img = sq?.querySelector('img');
      if (!sq || !img) return;
      const w = sq.offsetWidth;
      const dx = ((a % 8) - (b % 8)) * w, dy = (Math.floor(a / 8) - Math.floor(b / 8)) * w;
      sq.style.zIndex = '3';
      const anim = img.animate([{ transform: `translate(${dx}px, ${dy}px) scale(1.06)` }, { transform: 'none' }], { duration: ms, easing: EASE });
      anim.finished.catch(() => {}).finally(() => { sq.style.zIndex = ''; });
    };
    // A taken piece: a copy of it shrinks away under the one arriving.
    const taken = before.board[to];
    if (taken && taken[0] !== board[to]?.[0]) {
      const sq = root.children[to] as HTMLElement | undefined;
      if (sq) {
        const ghost = document.createElement('img');
        ghost.src = `/figma/apps/piece-${taken}.svg`; ghost.alt = ''; ghost.className = 'ax-ghost';
        sq.appendChild(ghost);
        ghost.animate([{ opacity: 1, scale: 1 }, { opacity: 0, scale: 0.4 }], { duration: 260, delay: 120, easing: 'ease-in', fill: 'both' })
          .finished.catch(() => {}).finally(() => ghost.remove());
      }
    }
    glide(from, to);
    // Castling: the king went two files, so the rook comes round too.
    if (board[to]?.[1] === 'K' && Math.abs((to % 8) - (from % 8)) === 2) {
      const right = to > from;
      glide(right ? from + 3 : from - 4, right ? from + 1 : from - 1, 320);
    }
  }, [last, board, live]);

  return (
    <div ref={ref} className={`ax-board ${className}`} role={live ? 'grid' : 'img'} aria-label={label}
         style={name ? { viewTransitionName: name } : undefined}>
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
