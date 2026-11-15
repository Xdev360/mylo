/* The room that is the profile cover, from the room editor frames P10-P15
   (879:178538 ...) and the cover picker P21 (879:180746). Every piece is a
   flat shape, so the whole room is drawn here rather than exported. */

export type Wall = 'plain' | 'sage' | 'navy' | 'brick' | 'panels' | 'tiles' | 'stripes' | 'concrete';
export type Win = 'wide' | 'double' | 'arch' | 'round' | 'none';
export type Floor = 'oak' | 'walnut' | 'checker' | 'concrete' | 'carpet' | 'herringbone' | 'terrazzo';
export type Rug = 'round' | 'striped' | 'shaggy' | 'none';
export type Light = 'day' | 'sunset' | 'night' | 'neon';
export type DecorKind = 'plant' | 'lamp' | 'shelf' | 'poster' | 'sofa' | 'desk' | 'weights';
export type Decor = { id: string; kind: DecorKind; dx: number; dy: number; s: number; flip?: boolean };

export type RoomState = { wall: Wall; window: Win; floor: Floor; rug: Rug; light: Light; decor: Decor[] };

/* A new account's room, as P3 draws it: a plain wall, the wide window, oak. */
export const DEFAULT_ROOM: RoomState = { wall: 'plain', window: 'wide', floor: 'oak', rug: 'none', light: 'day', decor: [] };

export type Category = 'walls' | 'windows' | 'floors' | 'rugs' | 'decor' | 'lighting';
export type Option = { id: string; label: string; locked?: { from: string; rarity: 'Rare' | 'Epic'; title: string; body: string } };

const SILVER = (title: string) => ({ from: 'Silver chest, wk 3', rarity: 'Rare' as const, title, body: 'Comes from a Silver chest. Silver unlocks in week 3 of showing up.' });
const GOLD = (title: string) => ({ from: 'Gold chest, wk 4', rarity: 'Rare' as const, title, body: 'Comes from a Gold chest. Gold unlocks in week 4 of showing up.' });

export const CATEGORIES: { id: Category; label: string; icon: string; title: string; sub: string; options: Option[] }[] = [
  { id: 'walls', label: 'Walls', icon: 'profile/home', title: 'Walls', sub: 'Tap to try it on. Locked ones show where they come from.', options: [
    { id: 'plain', label: 'Plain' }, { id: 'sage', label: 'Sage' }, { id: 'navy', label: 'Navy' },
    { id: 'brick', label: 'Brick', locked: SILVER('Brick wall') }, { id: 'panels', label: 'Panels' }, { id: 'tiles', label: 'Tiles' },
    { id: 'stripes', label: 'Stripes' }, { id: 'concrete', label: 'Concrete', locked: GOLD('Concrete wall') }
  ] },
  { id: 'windows', label: 'Windows', icon: 'profile/sun', title: 'Windows', sub: 'Tap to try it on. Locked ones show where they come from.', options: [
    { id: 'wide', label: 'Wide' }, { id: 'double', label: 'Double' }, { id: 'arch', label: 'Arch' },
    { id: 'round', label: 'Round', locked: SILVER('Round window') }, { id: 'none', label: 'None' }
  ] },
  { id: 'floors', label: 'Floors', icon: 'profile/layers', title: 'Floors', sub: 'Tap to try it on. Locked ones show where they come from.', options: [
    { id: 'oak', label: 'Oak' }, { id: 'walnut', label: 'Walnut' }, { id: 'checker', label: 'Checker' },
    { id: 'concrete', label: 'Concrete' }, { id: 'carpet', label: 'Carpet' }, { id: 'herringbone', label: 'Herringbone', locked: GOLD('Herringbone floor') },
    { id: 'terrazzo', label: 'Terrazzo', locked: { from: 'Reach Flame', rarity: 'Epic', title: 'Terrazzo floor', body: 'Unlocks when you reach Flame.' } }
  ] },
  { id: 'rugs', label: 'Rugs', icon: 'profile/circle', title: 'Rugs', sub: 'Tap to try it on. Locked ones show where they come from.', options: [
    { id: 'round', label: 'Round' }, { id: 'striped', label: 'Striped' }, { id: 'shaggy', label: 'Shaggy' }, { id: 'none', label: 'None' }
  ] },
  { id: 'decor', label: 'Decor', icon: 'profile/sprout', title: 'Decor', sub: 'Tap to add or remove. Drag in the room to move it.', options: [
    { id: 'plant', label: 'Plant' }, { id: 'lamp', label: 'Lamp' }, { id: 'shelf', label: 'Shelf' },
    { id: 'poster', label: 'Poster' }, { id: 'sofa', label: 'Sofa' }, { id: 'desk', label: 'Desk' },
    { id: 'weights', label: 'Weights', locked: { from: 'Gym badge', rarity: 'Rare', title: 'Weights', body: 'Comes with the Gym badge.' } }
  ] },
  { id: 'lighting', label: 'Lighting', icon: 'profile/bolt', title: 'Lighting', sub: 'Tap to try it on. Locked ones show where they come from.', options: [
    { id: 'day', label: 'Day' }, { id: 'sunset', label: 'Sunset' }, { id: 'night', label: 'Night' },
    { id: 'neon', label: 'Neon', locked: { from: 'Epic card bonus', rarity: 'Epic', title: 'Neon light', body: 'A bonus that comes with an Epic card.' } }
  ] }
];

const d = (kind: DecorKind): Decor => ({ id: kind, kind, dx: 0, dy: 0, s: 1 });

/* P21's covers: each is a whole room. */
export const COVERS: { id: string; label: string; room: RoomState; locked?: string }[] = [
  { id: 'bedroom', label: 'Bedroom', room: { wall: 'sage', window: 'wide', floor: 'oak', rug: 'round', light: 'day', decor: [d('plant'), d('shelf')] } },
  { id: 'living', label: 'Living room', room: { wall: 'brick', window: 'arch', floor: 'concrete', rug: 'striped', light: 'sunset', decor: [d('sofa'), d('lamp')] } },
  { id: 'gym', label: 'Gym', room: { wall: 'panels', window: 'double', floor: 'herringbone', rug: 'none', light: 'neon', decor: [d('weights')] } },
  { id: 'study', label: 'Study', room: { wall: 'navy', window: 'round', floor: 'walnut', rug: 'shaggy', light: 'night', decor: [d('poster'), d('desk')] } },
  { id: 'kitchen', label: 'Kitchen', locked: 'Gold chest, wk 4', room: { wall: 'tiles', window: 'wide', floor: 'terrazzo', rug: 'none', light: 'day', decor: [d('plant')] } },
  { id: 'night', label: 'Night in', locked: 'Epic card', room: { wall: 'stripes', window: 'arch', floor: 'carpet', rug: 'round', light: 'night', decor: [d('lamp')] } }
];

export const sameRoom = (a: RoomState, b: RoomState) =>
  a.wall === b.wall && a.window === b.window && a.floor === b.floor && a.rug === b.rug && a.light === b.light &&
  a.decor.map(x => x.kind).sort().join() === b.decor.map(x => x.kind).sort().join();

/* Where each piece of decor sits before it is moved, in the room's own units:
   393 wide, the floor starting at F. */
export function decorBox(kind: DecorKind, F: number) {
  switch (kind) {
    case 'plant': return { x: -3, y: F - 60, w: 87, h: 80 };
    case 'lamp': return { x: 340, y: F - 86, w: 30, h: 88 };
    case 'shelf': return { x: 31, y: F * 0.3 - 26, w: 118, h: 32 };
    case 'poster': return { x: 40, y: F * 0.14, w: 70, h: 60 };
    case 'sofa': return { x: 40, y: F - 58, w: 150, h: 64 };
    case 'desk': return { x: 244, y: F - 44, w: 118, h: 48 };
    case 'weights': return { x: 140, y: F + 26, w: 120, h: 34 };
  }
}
