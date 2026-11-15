'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import Mylo from './Mylo';
import { KeysChip, Menu, Scene, WorldHeader, WorldPage, useBack, useNow, wi } from './ui';
import { todayIso } from '@/lib/dates';
import { DECOR, ROOMS, ROOM_STYLES, WALK_GOAL, roomArt, useHouse, useLook, useWalks, type House, type RoomId } from '@/lib/world';

/* Where Mylo stands in each room (left, top, width): on H1's tiles as
   fractions of the visible 173 x 104 picture, in a room as fractions of the
   drawing, read off H3's living room and H4's garden. */
const TILE_AT: Record<RoomId, [number, number, number]> = {
  bedroom: [0.347, 0.385, 0.312], kitchen: [0.4, 0.36, 0.3], living: [0.36, 0.33, 0.3], gym: [0.36, 0.33, 0.3], garden: [0.2, 0.36, 0.3], photo: [0.35, 0.36, 0.3]
};
const ROOM_AT: Record<RoomId, [number, number, number]> = {
  bedroom: [0.36, 0.42, 0.3], kitchen: [0.34, 0.42, 0.32], living: [0.255, 0.371, 0.34], gym: [0.33, 0.44, 0.32], garden: [0.425, 0.439, 0.34], photo: [0.34, 0.42, 0.32]
};
const TILE_ART: Partial<Record<RoomId, string>> = { bedroom: 'tile-bedroom', living: 'tile-living', gym: 'tile-gym', garden: 'tile-garden' };

/* Keys come from levelling up, and levels are the server's: until it gives
   one, everybody has none. The chip opens what H7 says about them. */
function KeysSheet({ open, onClose, keys }: { open: boolean; onClose: () => void; keys: number }) {
  return (
    <Sheet open={open} onClose={onClose} title={`You have ${keys} ${keys === 1 ? 'key' : 'keys'}`} sub="Next key at Flame">
      <p className="t-caption c-3 w-center">Keys only come from levelling up. They cannot be bought or sent.</p>
    </Sheet>
  );
}

/* ── H1 House (879:186117) ─────────────────────────────────────────────── */
export function HouseHome() {
  return <WorldPage className="w-house" tabs><HouseBody /></WorldPage>;
}
function HouseBody() {
  const router = useRouter();
  const [house, setHouse] = useHouse();
  const [look] = useLook();
  const [keys, setKeys] = useState(false);
  const go = (id: RoomId) => {
    if (id === 'photo') { router.push('/photo'); return; }
    setHouse(h => ({ ...h, here: id }));
    router.push(`/house/${id}`);
  };
  const treats = house.treats.length;
  return (
    <>
      <header className="w-top">
        <h1 className="w-h1">Home</h1>
        <KeysChip keys={house.keys} onClick={() => setKeys(true)} />
      </header>
      <div className="w-house-grid">
        <img className="w-roof" src="/figma/world/roof.svg" alt="" />
        {ROOMS.map(r => {
          const art = r.id === 'bedroom' && house.bedroom !== 'classic' ? roomArt(house, 'bedroom') : TILE_ART[r.id] ?? r.art;
          const sub = r.id === 'living' ? (treats ? `${treats} treats to claim` : r.sub) : r.sub;
          return (
            <button key={r.id} type="button" className="w-room" onClick={() => go(r.id)} aria-label={`${r.label}. ${sub}`}>
              <span className="w-room-art">
                <img src={`/figma/world/room/${art}.svg`} alt="" />
                {r.id === 'photo' && <span className="w-room-lock"><Icon name={wi('key')} size={26} /></span>}
                {house.here === r.id && r.id !== 'photo' && (
                  <span className="w-room-mylo" style={{ left: `${TILE_AT[r.id][0] * 100}%`, top: `${TILE_AT[r.id][1] * 100}%`, width: `${TILE_AT[r.id][2] * 100}%` }}>
                    <Mylo look={look} />
                  </span>
                )}
              </span>
              <span className="w-room-label">
                <span className="t-body c-ink">{r.label}</span>
                <span className={`t-caption ${r.id === 'living' && treats ? 'w-red' : 'c-2'}`}>{sub}</span>
                {r.id === 'living' && treats > 0 && <span className="w-room-dot" />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="t-caption c-2">Mylo moves to the room you need. Tap a room to go there.</p>
      <KeysSheet open={keys} onClose={() => setKeys(false)} keys={house.keys} />
    </>
  );
}

/* ── H3 Living room, H4 Garden, and the other rooms the same way ───────── */
export function RoomView({ room }: { room: RoomId }) {
  return <WorldPage className="w-roomview" tabs={room !== 'garden'}><RoomBody room={room} /></WorldPage>;
}
function RoomBody({ room }: { room: RoomId }) {
  const router = useRouter();
  const back = useBack('/house');
  const [house, setHouse] = useHouse();
  const [look] = useLook();
  const [menu, setMenu] = useState(false);
  const [keys, setKeys] = useState(false);
  const r = ROOMS.find(x => x.id === room)!;
  useEffect(() => { if (house.here !== room) setHouse(h => ({ ...h, here: room })); }, [house.here, room, setHouse]);
  const move = (id: RoomId) => { setMenu(false); if (id === 'photo') router.push('/photo'); else router.replace(`/house/${id}`); };
  const art = room === 'living' ? 'living-day' : roomArt(house, room);
  return (
    <>
      <header className="w-roomhead">
        <button type="button" className="back-btn" aria-label="Back" onClick={back}><Icon name={wi('back')} size={20} /></button>
        <div className="w-menu-wrap">
          <button type="button" className="w-chip" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>
            <Icon name={wi('home')} size={20} /><span>{r.label}</span><Icon name={wi('chevron-down')} size={16} className="c-2" />
          </button>
          <Menu open={menu} onClose={() => setMenu(false)}>
            {ROOMS.map(x => (
              <button key={x.id} type="button" role="menuitem" className="w-menu-item" aria-current={x.id === room ? 'true' : undefined} onClick={() => move(x.id)}>{x.label}</button>
            ))}
          </Menu>
        </div>
        <span className="spacer" />
        <KeysChip keys={house.keys} onClick={() => setKeys(true)} />
      </header>
      <Scene art={art} look={look} at={ROOM_AT[room]} className="w-scene-room" mirror={room === 'bedroom' && house.flipped} label={`${look.name} in the ${r.label.toLowerCase()}`} />
      {room === 'living' && <Treats house={house} setHouse={setHouse} />}
      {room === 'garden' && <Walk />}
      {room === 'bedroom' && (
        <div className="card list w-links">
          <Link href="/house/decorate" className="w-link-row"><Icon name={wi('sparkle')} size={22} /><span className="t-body">Decorate Bedroom</span><Icon name="chevron-right" size={18} className="c-3" /></Link>
          <Link href="/house/styles" className="w-link-row"><Icon name={wi('home')} size={22} /><span className="t-body">Bedroom style</span><Icon name="chevron-right" size={18} className="c-3" /></Link>
        </div>
      )}
      <KeysSheet open={keys} onClose={() => setKeys(false)} keys={house.keys} />
    </>
  );
}

/* Treats are the rewards a person set for finishing things; they land
   here once earned. None yet means none shown. */
function Treats({ house, setHouse }: { house: House; setHouse: (f: (h: House) => House) => void }) {
  if (!house.treats.length) return null;
  return (
    <section className="w-section">
      <h2 className="t-title-s">Treats to claim</h2>
      {house.treats.map(t => (
        <div key={t.id} className="w-treat card">
          <span className="w-tile" style={{ background: 'var(--w-tint-purple)' }}><Icon name={wi('moon')} size={22} className="w-purple" /></span>
          <span className="w-grow"><span className="t-body c-ink">{t.title}</span><span className="t-caption c-2">Earned at {t.at}</span></span>
          <button type="button" className="w-claim" onClick={() => setHouse(h => ({ ...h, treats: h.treats.filter(x => x.id !== t.id) }))}>Claim</button>
        </div>
      ))}
    </section>
  );
}

/* H4: a real walk timer. Minutes add up for the day; every day with a walk
   grows a flower. */
function Walk() {
  const [walks, setWalks] = useWalks();
  const now = useNow(1000);
  const today = todayIso();
  const running = walks.startedAt ? Math.max(0, now.getTime() - new Date(walks.startedAt).getTime()) / 60000 : 0;
  const mins = Math.floor((walks.days[today] ?? 0) + running);
  const flowers = Object.values(walks.days).filter(m => m > 0).length + (running > 0 && !walks.days[today] ? 1 : 0);
  const toggle = () => setWalks(w => {
    if (!w.startedAt) return { ...w, startedAt: new Date().toISOString() };
    const add = (Date.now() - new Date(w.startedAt).getTime()) / 60000;
    return { startedAt: null, days: { ...w.days, [today]: (w.days[today] ?? 0) + add } };
  });
  const secs = Math.floor(running * 60);
  return (
    <>
      <div className="card w-walk">
        <div className="w-walk-head">
          <span className="w-tile" style={{ background: 'var(--tint-green)' }}><Icon name={wi('mountain')} size={20} className="w-green" /></span>
          <span className="w-grow"><span className="t-title-s">Walk {WALK_GOAL} minutes</span><span className="t-body-s c-2">{Math.min(mins, 999)} of {WALK_GOAL} min today</span></span>
        </div>
        <span className="w-bar"><span style={{ width: `${Math.min(1, mins / WALK_GOAL) * 100}%` }} /></span>
      </div>
      <p className="w-note"><Icon name={wi('sprout')} size={24} className="w-green" /><span className="t-body-s">A flower grows for every day you walk. {flowers} so far.</span></p>
      <button type="button" className="btn-primary w-wide" onClick={toggle} aria-pressed={!!walks.startedAt}>
        {walks.startedAt
          ? <><Icon name={wi('timer')} size={20} />{String(Math.floor(secs / 60)).padStart(2, '0')}:{String(secs % 60).padStart(2, '0')}</>
          : <><Icon name={wi('play')} size={20} />Start a walk</>}
      </button>
    </>
  );
}

/* ── H5 Decorate (879:187061) ──────────────────────────────────────────── */
export function Decorate() {
  return <WorldPage className="w-decorate"><DecorateBody /></WorldPage>;
}
function DecorateBody() {
  const back = useBack('/house/bedroom');
  const [house, setHouse] = useHouse();
  const [look] = useLook();
  const [cat, setCat] = useState<keyof typeof DECOR>('Furniture');
  const [sel, setSel] = useState<string | null>(null);
  const [flipped, setFlipped] = useState(house.flipped);
  const [box, setBox] = useState({ x: 0.538, y: 0.465 });
  const drag = useRef<{ x: number; y: number; bx: number; by: number } | null>(null);
  const [moving, setMoving] = useState(false);
  const save = () => { setHouse(h => ({ ...h, flipped })); back(); };
  const items = DECOR[cat];
  return (
    <>
      <WorldHeader kind="close" title="Decorate Bedroom" fallback="/house/bedroom"
                   actions={<button type="button" className="back-btn" aria-label="Save" onClick={save}><Icon name={wi('check')} size={20} /></button>} />
      <Scene art={roomArt(house, 'bedroom')} look={look} at={ROOM_AT.bedroom} mirror={flipped} className="w-scene-deco">
        {sel && (
          <div className={`w-select${moving ? ' is-moving' : ''}`} style={{ left: `${box.x * 100}%`, top: `${box.y * 100}%` }}
               onPointerDown={e => { if (!moving) return; drag.current = { x: e.clientX, y: e.clientY, bx: box.x, by: box.y }; (e.target as Element).setPointerCapture?.(e.pointerId); }}
               onPointerMove={e => {
                 const d = drag.current; const host = (e.currentTarget.parentElement as HTMLElement);
                 if (!d || !host) return;
                 const r = host.getBoundingClientRect();
                 setBox({ x: Math.max(0, Math.min(0.57, d.bx + (e.clientX - d.x) / r.width)), y: Math.max(0.05, Math.min(0.75, d.by + (e.clientY - d.y) / r.height)) });
               }}
               onPointerUp={() => { drag.current = null; }}>
            <div className="w-select-bar">
              <button type="button" aria-pressed={moving} onClick={() => setMoving(m => !m)}>Move</button>
              <button type="button" aria-pressed={flipped} onClick={() => setFlipped(f => !f)}>Flip</button>
              <button type="button" onClick={() => { setSel(null); setMoving(false); }}>Remove</button>
            </div>
          </div>
        )}
      </Scene>
      <div className="w-chips" role="tablist" aria-label="Decor">
        {(Object.keys(DECOR) as (keyof typeof DECOR)[]).map(c => (
          <button key={c} type="button" role="tab" aria-selected={cat === c} className={`w-tab${cat === c ? ' is-on' : ''}`} onClick={() => { setCat(c); setSel(null); }}>{c}</button>
        ))}
      </div>
      <div className="w-deco-grid">
        {items.map(i => (
          <button key={i.id} type="button" className={`w-deco${sel === i.id ? ' is-on' : ''}`} aria-pressed={sel === i.id} aria-disabled={!i.owned}
                  onClick={() => i.owned && setSel(s => (s === i.id ? null : i.id))}>
            <span className="w-tile" style={{ background: i.tint }}><Icon name={wi(i.icon)} size={20} className="" /></span>
            <span className="t-body-s c-ink">{i.label}</span>
            <span className={`t-caption ${i.owned ? 'c-3' : 'w-red'}`}>{i.owned ? 'Owned' : i.need}</span>
          </button>
        ))}
      </div>
    </>
  );
}

/* ── H6 Room styles (879:187205) ───────────────────────────────────────── */
export function Styles() {
  return <WorldPage className="w-styles"><StylesBody /></WorldPage>;
}
function StylesBody() {
  const router = useRouter();
  const [house, setHouse] = useHouse();
  return (
    <>
      <WorldHeader title="Bedroom style" fallback="/house/bedroom" />
      <p className="t-body c-2 w-center w-lede">Same room, new look. Your stuff stays.</p>
      <div className="w-style-list">
        {ROOM_STYLES.map(s => {
          const inUse = house.bedroom === s.id;
          const owned = house.owned.includes(s.id);
          const season = 'season' in s && s.season;
          const open = () => {
            if (inUse || season) return;
            if (owned) setHouse(h => ({ ...h, bedroom: s.id }));
            else router.push(`/house/styles/${s.id}`);
          };
          return (
            <button key={s.id} type="button" className={`w-style${inUse ? ' is-on' : ''}`} onClick={open} aria-disabled={season || undefined} aria-pressed={inUse}>
              <span className="w-style-art"><img src={`/figma/world/room/${s.art}.svg`} alt="" /></span>
              <span className="w-style-label">
                <span className="t-title-s">{s.label}</span>
                {inUse ? <span className="w-badge">In use</span>
                  : season ? <span className="w-badge">Season drop</span>
                  : owned ? null
                  : <span className="w-badge is-dark"><Icon name={wi('key')} size={16} />1 key</span>}
              </span>
            </button>
          );
        })}
      </div>
      <p className="t-caption c-3 w-center">Season drops come back every year.</p>
    </>
  );
}

/* ── H7 Use a key (879:187548) ─────────────────────────────────────────── */
export function UseKey({ style }: { style: string }) {
  return <WorldPage className="w-usekey"><UseKeyBody style={style} /></WorldPage>;
}
function UseKeyBody({ style }: { style: string }) {
  const router = useRouter();
  const back = useBack('/house/styles');
  const [house, setHouse] = useHouse();
  const [look] = useLook();
  const s = ROOM_STYLES.find(x => x.id === style && 'keys' in x);
  useEffect(() => { if (!s) router.replace('/house/styles'); }, [s, router]);
  if (!s || !('keys' in s)) return null;
  const can = house.keys >= s.keys;
  const use = () => {
    if (!can) return;
    setHouse(h => ({ ...h, keys: h.keys - s.keys, owned: [...h.owned, s.id], bedroom: s.id }));
    router.replace('/house/bedroom');
  };
  return (
    <>
      <Scene art={s.art} look={look} at={[0.36, 0.42, 0.3]} className="w-usekey-scene" />
      <span className="w-usekey-scrim" />
      <section className="w-usekey-sheet" aria-labelledby="usekey-title">
        <span className="grabber w-grabber" />
        <h1 id="usekey-title" className="w-title-l">Make it {s.short}?</h1>
        {'pitch' in s && <p className="t-body c-2">{s.pitch}</p>}
        <div className="w-keys-card">
          <span className="w-key-tile is-gold"><Icon name={wi('key')} size={24} /></span>
          <span className="w-key-tile"><Icon name={wi('key')} size={24} /></span>
          <span className="w-grow"><span className="t-title-s">You have {house.keys} {house.keys === 1 ? 'key' : 'keys'}</span><span className="t-caption c-2">Next key at Flame</span></span>
        </div>
        <button type="button" className="btn-primary w-wide" onClick={use} disabled={!can}><Icon name={wi('key')} size={20} />Use 1 key</button>
        <button type="button" className="w-text-btn" onClick={back}>Not now</button>
        <p className="t-caption c-3 w-center">Keys only come from levelling up. They cannot be bought or sent.</p>
      </section>
    </>
  );
}
