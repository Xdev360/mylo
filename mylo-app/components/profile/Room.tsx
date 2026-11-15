'use client';

import { forwardRef, useId } from 'react';
import { decorBox, type Decor, type DecorKind, type RoomState } from './room-data';

/* The room, drawn the way P3/P9/P10 draw it: 393 units wide, the floor from
   F down to H. The same drawing is the profile cover (300 high), the room
   screen, the editor and every little option preview. */
export type RoomLayers = { window?: boolean; rug?: boolean; decor?: DecorKind | 'all' | 'none'; light?: boolean };
type Props = {
  room: RoomState; H: number; F: number;
  mylo?: 'cover' | 'room' | false;
  layers?: RoomLayers;
  fit?: 'slice' | 'meet';
  className?: string;
  label?: string;
  selected?: string | null;
  onDecorDown?: (e: React.PointerEvent, d: Decor) => void;
  onHandleDown?: (e: React.PointerEvent, d: Decor) => void;
};

const SKY = {
  day: ['#BFE3FF', '#E8F5FF'], sunset: ['#FFB37A', '#FF7E6B'], night: ['#1B2350', '#33407A'], neon: ['#BFE3FF', '#E8F5FF']
} as const;
const WALL = {
  plain: '#EDEAE4', sage: '#DDE7DA', navy: '#2E3A5C', brick: '#C9785A', panels: '#D9C2A1', tiles: '#E8EEF2', stripes: '#E9E3F0', concrete: '#C9C9CC'
} as const;
const FLOOR = {
  oak: '#C99A63', walnut: '#7A5233', checker: '#F2F2F2', concrete: '#A9A9AE', carpet: '#8A93A6', herringbone: '#D2A877', terrazzo: '#E7E2DA'
} as const;
const LIGHT = { sunset: ['#FF8A4C', 0.16], night: ['#1A1F45', 0.32], neon: ['#5A2DC0', 0.16] } as const;

function Window({ room, F }: { room: RoomState; F: number }) {
  if (room.window === 'none') return null;
  const y = F * 0.12, h = F * 0.48, x = 220, w = 118;
  const [top, bottom] = SKY[room.light];
  const gid = `sky-${room.light}`;
  const night = room.light === 'night';
  const round = room.window === 'round';
  const shape = round
    ? <circle cx={x + w / 2} cy={y + h / 2} r={Math.min(w, h) / 2 - 3} />
    : room.window === 'arch'
      ? <path d={`M${x + 3} ${y + h - 3} V${y + w / 2} a${w / 2 - 3} ${w / 2 - 3} 0 0 1 ${w - 6} 0 V${y + h - 3} Z`} />
      : <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={5} />;
  return (
    <g>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={top} /><stop offset="1" stopColor={bottom} /></linearGradient>
      </defs>
      <g fill={`url(#${gid})`} stroke="#FFFFFF" strokeWidth={6}>{shape}</g>
      {night ? <>
        <circle cx={x + 26} cy={y + 24} r={7} fill="#FFF3C4" />
        {[[x + 20, y + 52], [x + 60, y + 30], [x + 84, y + 60], [x + 46, y + 74], [x + 92, y + 22]].map(([cx, cy]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.5} fill="#FFFFFF" />)}
      </> : <circle cx={round ? x + w / 2 + 22 : x + 101} cy={round ? y + h / 2 - 18 : y + 19} r={9} fill={room.light === 'sunset' ? '#FFE08A' : '#FFF6CF'} />}
      {(room.window === 'wide' || room.window === 'double') && <rect x={x + w / 2 - 3} y={y} width={6} height={h} fill="#FFFFFF" />}
      {room.window === 'wide' && <rect x={x} y={y + h * 0.36} width={w} height={5} fill="#FFFFFF" />}
      {!round && <rect x={212} y={y + h} width={134} height={7} rx={3} fill="#FFFFFF" />}
    </g>
  );
}

function DecorShape({ kind, F }: { kind: DecorKind; F: number }) {
  switch (kind) {
    case 'plant': return (
      <g>
        <rect x={24} y={F - 10} width={28} height={30} rx={6} fill="#C9785A" />
        <g fill="#4E9A3A">
          <ellipse cx={14} cy={F - 30.5} rx={17} ry={19.5} /><ellipse cx={28} cy={F - 21} rx={14} ry={19} />
          <ellipse cx={42} cy={F - 33} rx={10} ry={17} /><ellipse cx={55} cy={F - 26} rx={14} ry={19} />
          <ellipse cx={67} cy={F - 40.5} rx={17} ry={19.5} />
        </g>
      </g>
    );
    case 'lamp': return (
      <g><rect x={354} y={F - 70} width={3} height={72} fill="#2B2B30" /><ellipse cx={355} cy={F - 75} rx={15} ry={11} fill="#F5C64A" /></g>
    );
    case 'shelf': {
      const y = F * 0.3;
      return (
        <g>
          <rect x={31} y={y} width={118} height={6} rx={2} fill="#7A5233" />
          {['#E2594B', '#3E7BFA', '#F5C64A', '#2FA36B'].map((c, i) => <rect key={c} x={35 + i * 10} y={y - 26} width={8} height={26} rx={1} fill={c} />)}
        </g>
      );
    }
    case 'poster': {
      const y = F * 0.14;
      return <g><rect x={40} y={y} width={70} height={60} rx={6} fill="#FFFFFF" /><rect x={50} y={y + 10} width={50} height={40} rx={2} fill="#7FB4FF" /></g>;
    }
    case 'sofa': return (
      <g><rect x={40} y={F - 58} width={150} height={38} rx={14} fill="#4A5876" /><rect x={40} y={F - 34} width={150} height={40} rx={12} fill="#5B6B8C" /></g>
    );
    case 'desk': return (
      <g>
        <rect x={244} y={F - 30} width={118} height={8} rx={2} fill="#7A5233" />
        <rect x={252} y={F - 22} width={4} height={26} fill="#5A3A22" /><rect x={354} y={F - 22} width={4} height={26} fill="#5A3A22" />
        <rect x={275} y={F - 44} width={36} height={14} rx={3} fill="#2B2B30" />
      </g>
    );
    case 'weights': return (
      <g>
        <rect x={150} y={F + 40} width={100} height={6} rx={2} fill="#3A3A44" />
        <ellipse cx={150} cy={F + 43} rx={10} ry={17} fill="#2B2B30" /><ellipse cx={250} cy={F + 43} rx={10} ry={17} fill="#2B2B30" />
      </g>
    );
  }
}

const Room = forwardRef<SVGSVGElement, Props>(function Room(
  { room, H, F, mylo = false, layers, fit = 'slice', className, label, selected, onDecorDown, onHandleDown }, ref
) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const D = H - F;
  const show = { window: true, rug: true, decor: 'all' as RoomLayers['decor'], light: true, ...layers };
  const W0 = -400, WW = 1193;
  const id = (s: string) => `${uid}-${s}`;
  const dado = room.wall === 'sage' ? ['#C9D8C5', '#B9CBB4'] : room.wall === 'navy' ? ['#243049', '#3B4A72'] : null;
  const decor = room.decor.filter(x => show.decor === 'all' || x.kind === show.decor);
  const editing = Boolean(onDecorDown);
  const light = room.light !== 'day' && show.light ? LIGHT[room.light] : null;

  return (
    <svg ref={ref} className={className} viewBox={`0 0 393 ${H}`} preserveAspectRatio={`xMidYMid ${fit}`}
         role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <pattern id={id('brick')} width={36} height={32} patternUnits="userSpaceOnUse" x={1} y={1}>
          <rect width={34} height={14} rx={2} fill="#B5674B" x={-18} /><rect width={34} height={14} rx={2} fill="#B5674B" x={18} />
          <rect width={34} height={14} rx={2} fill="#B5674B" y={16} />
        </pattern>
        <pattern id={id('tiles')} width={22} height={22} patternUnits="userSpaceOnUse"><rect width={21} height={21} rx={1} fill="#D3DDE4" /></pattern>
        <pattern id={id('stripes')} width={28} height={10} patternUnits="userSpaceOnUse"><rect width={12} height={10} fill="#D9CFE6" /></pattern>
        <pattern id={id('speck')} width={30} height={19} patternUnits="userSpaceOnUse"><circle cx={2} cy={2} r={2} fill="#B8B8BC" /><circle cx={17} cy={12} r={2} fill="#B8B8BC" /></pattern>
        <pattern id={id('oak')} width={10} height={14} patternUnits="userSpaceOnUse" y={F + 12}><rect width={10} height={2} fill="#B58652" /></pattern>
        <pattern id={id('walnut')} width={10} height={14} patternUnits="userSpaceOnUse" y={F + 12}><rect width={10} height={2} fill="#6A4429" /></pattern>
        <pattern id={id('checker')} width={52} height={52} patternUnits="userSpaceOnUse" y={F}><rect width={26} height={26} fill="#2B2B30" /><rect x={26} y={26} width={26} height={26} fill="#2B2B30" /></pattern>
        <pattern id={id('carpet')} width={12} height={12} patternUnits="userSpaceOnUse" y={F}><rect width={12} height={6} fill="#7C8598" /></pattern>
        <pattern id={id('herring')} width={28} height={14} patternUnits="userSpaceOnUse" y={F - 2}><rect width={24} height={11} rx={2} fill="#BE935F" /></pattern>
        <pattern id={id('terrazzo')} width={48} height={22} patternUnits="userSpaceOnUse" y={F}>
          <ellipse cx={3} cy={3} rx={2.5} ry={2} fill="#C99A63" /><ellipse cx={20} cy={12} rx={2.5} ry={2} fill="#8FA6B8" /><ellipse cx={36} cy={6} rx={2.5} ry={2} fill="#D98B7A" /><ellipse cx={12} cy={18} rx={2.5} ry={2} fill="#D98B7A" /><ellipse cx={42} cy={17} rx={2.5} ry={2} fill="#C99A63" />
        </pattern>
      </defs>

      {/* Wall */}
      <rect x={W0} y={0} width={WW} height={F} fill={WALL[room.wall]} />
      {room.wall === 'brick' && <rect x={W0} y={0} width={WW} height={F} fill={`url(#${id('brick')})`} />}
      {room.wall === 'tiles' && <rect x={W0} y={0} width={WW} height={F} fill={`url(#${id('tiles')})`} />}
      {room.wall === 'stripes' && <rect x={W0} y={0} width={WW} height={F} fill={`url(#${id('stripes')})`} />}
      {room.wall === 'concrete' && <rect x={W0} y={0} width={WW} height={F} fill={`url(#${id('speck')})`} />}
      {room.wall === 'panels' && Array.from({ length: 14 }, (_, i) => <rect key={i} x={-228 + i * 88} y={F * 0.1} width={72} height={F * 0.8} rx={6} fill="#C7AD88" />)}
      {dado && <><rect x={W0} y={F * 0.62} width={WW} height={F * 0.38} fill={dado[0]} /><rect x={W0} y={F * 0.62 - 3} width={WW} height={5} fill={dado[1]} /></>}
      {show.window && <Window room={room} F={F} />}

      {/* Floor */}
      <rect x={W0} y={F} width={WW} height={D} fill={FLOOR[room.floor]} />
      {room.floor === 'oak' && <rect x={W0} y={F} width={WW} height={D} fill={`url(#${id('oak')})`} />}
      {room.floor === 'walnut' && <rect x={W0} y={F} width={WW} height={D} fill={`url(#${id('walnut')})`} />}
      {room.floor === 'checker' && <rect x={W0} y={F} width={WW} height={D} fill={`url(#${id('checker')})`} />}
      {room.floor === 'carpet' && <rect x={W0} y={F} width={WW} height={D} fill={`url(#${id('carpet')})`} opacity={0.6} />}
      {room.floor === 'herringbone' && <rect x={W0} y={F} width={WW} height={D} fill={`url(#${id('herring')})`} />}
      {room.floor === 'terrazzo' && <rect x={W0} y={F} width={WW} height={D} fill={`url(#${id('terrazzo')})`} />}
      <rect x={W0} y={F - 4} width={WW} height={6} fill="#FFFFFF" />

      {light && <rect x={W0} y={0} width={WW} height={H} fill={light[0]} opacity={light[1]} style={{ mixBlendMode: 'multiply' }} />}
      {room.light === 'neon' && show.light && <rect x={32} y={F * 0.07} width={141} height={8} rx={4} fill="#FF5AD1" style={{ filter: 'drop-shadow(0 0 6px #FF5AD1)' }} />}

      {/* Rug */}
      {show.rug && room.rug === 'round' && <ellipse cx={165.5} cy={F + 0.57 * D} rx={94.5} ry={0.25 * D} fill="#E2594B" />}
      {show.rug && room.rug === 'shaggy' && <ellipse cx={165.5} cy={F + 0.57 * D} rx={102} ry={0.25 * D} fill="#EDE6DA" />}
      {show.rug && room.rug === 'striped' && (
        <g>
          <rect x={55} y={F + 0.32 * D} width={220} height={0.46 * D} rx={8} fill="#F3E6CF" />
          {Array.from({ length: 5 }, (_, i) => <rect key={i} x={55} y={F + 0.32 * D + 4 + i * (0.46 * D - 8) / 4.4} width={220} height={4} fill="#2C3E70" />)}
        </g>
      )}

      {/* Decor, behind Mylo */}
      {decor.map(x => {
        const b = decorBox(x.kind, F);
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
        const t = `translate(${cx + x.dx} ${cy + x.dy}) scale(${x.flip ? -x.s : x.s} ${x.s}) translate(${-cx} ${-cy})`;
        return (
          <g key={x.id} transform={t} style={editing ? { cursor: 'grab', touchAction: 'none' } : undefined}
             onPointerDown={onDecorDown ? e => onDecorDown(e, x) : undefined}>
            {editing && <rect x={b.x - 6} y={b.y - 6} width={b.w + 12} height={b.h + 12} fill="transparent" />}
            <DecorShape kind={x.kind} F={F} />
          </g>
        );
      })}

      {mylo === 'cover' && <image href="/figma/profile/mylo-plain.svg" x={136} y={F + 18 - 120} width={100} height={120} />}
      {mylo === 'room' && <image href="/figma/profile/mylo-plain.svg" x={90} y={F + 0.55 * D - 181} width={151} height={181} style={{ pointerEvents: 'none' }} />}

      {/* P18 · the moved piece's frame and handles */}
      {selected && decor.filter(x => x.id === selected).map(x => {
        const b = decorBox(x.kind, F);
        const w = b.w * x.s + 16, h = b.h * x.s + 16;
        const left = b.x + b.w / 2 + x.dx - w / 2, top = b.y + b.h / 2 + x.dy - h / 2;
        return (
          <g key="sel">
            <rect x={left} y={top} width={w} height={h} rx={8} fill="none" stroke="#FFFFFF" strokeWidth={1.5} strokeDasharray="5 4" pointerEvents="none" />
            {[[left, top], [left + w, top], [left, top + h], [left + w, top + h]].map(([hx, hy]) => (
              <rect key={`${hx}-${hy}`} x={hx - 6} y={hy - 6} width={12} height={12} rx={3} fill="#FFFFFF"
                    style={{ cursor: 'nwse-resize', touchAction: 'none' }} onPointerDown={onHandleDown ? e => onHandleDown(e, x) : undefined} />
            ))}
          </g>
        );
      })}
    </svg>
  );
});

export default Room;

/* The selected piece's frame in the room's units, for placing the toolbar. */
export function selectionBox(x: Decor, F: number) {
  const b = decorBox(x.kind, F);
  const w = b.w * x.s + 16, h = b.h * x.s + 16;
  return { left: b.x + b.w / 2 + x.dx - w / 2, top: b.y + b.h / 2 + x.dy - h / 2, w, h };
}
