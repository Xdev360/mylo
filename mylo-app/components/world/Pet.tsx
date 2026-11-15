'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Icon from '@/components/Icon';
import { PETS, petArt, useRewards } from '@/lib/rewards';
import { WorldHeader, WorldPage, wi } from './ui';

/* PT2 · Play with Momo (879:178499). Momo is what the first egg hatches
   into; the buddy shown is the one out with your Mylo in the pet house
   (lib/rewards.ts), so every screen means the same pet. With none hatched
   yet it sends you to the egg. Tap it, hold to cuddle, and the four games
   each make it do something. */
type Act = 'idle' | 'tap' | 'cuddle' | 'pet' | 'dance' | 'hide';

export default function Pet() {
  return <WorldPage className="w-pet-screen"><PetBody /></WorldPage>;
}

function PetBody() {
  const router = useRouter();
  const r = useRewards();
  const pet = r.state.pets.find(p => p.id === r.state.out) ?? r.state.pets[0] ?? null;
  const hatched = !r.ready || !!pet;
  const name = pet ? pet.name || PETS[pet.kind].name.split(' · ')[0] : '';
  const [act, setAct] = useState<Act>('idle');
  const hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (!hatched) router.replace('/eggs'); }, [hatched, router]);
  useEffect(() => () => { if (reset.current) clearTimeout(reset.current); if (hold.current) clearTimeout(hold.current); }, []);
  if (!r.ready || !pet) return null;

  const play = (a: Act, ms = 1400) => {
    if (reset.current) clearTimeout(reset.current);
    setAct(a);
    if (a !== 'hide') reset.current = setTimeout(() => setAct('idle'), ms);
  };
  const down = () => { hold.current = setTimeout(() => { hold.current = null; setAct('cuddle'); }, 450); };
  const up = () => {
    if (hold.current) { clearTimeout(hold.current); hold.current = null; play('tap', 700); }
    else if (act === 'cuddle') play('idle', 0);
  };

  return (
    <>
      <WorldHeader fallback="/apps" />
      <div className="w-pet-stage">
        <span className="w-pet-halo" />
        <span className="w-pet-disc" />
        <img className="w-sticker w-sticker-a" src="/figma/world/sticker-love.svg" alt="" />
        <img className="w-sticker w-sticker-b" src="/figma/world/sticker-lol.svg" alt="" />
        <img className="w-sticker w-sticker-c" src="/figma/world/sticker-wow.svg" alt="" />
        <button type="button" className={`w-momo is-${act}`} aria-label={act === 'hide' ? `Find ${name}` : name}
                onPointerDown={down} onPointerUp={up} onPointerLeave={() => { if (hold.current) { clearTimeout(hold.current); hold.current = null; } if (act === 'cuddle') setAct('idle'); }}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play('tap', 700); } }}
                onContextMenu={e => e.preventDefault()}>
          <img src={pet.kind === 'momo-galaxy' ? '/figma/world/momo.svg' : petArt(pet.kind)} alt="" draggable={false} />
          {(act === 'tap' || act === 'cuddle' || act === 'pet') && <span className="w-momo-heart"><Icon name={wi('heart')} size={act === 'cuddle' ? 34 : 26} /></span>}
        </button>
      </div>
      <p className="t-body-s c-2 w-center">Tap {name}. Hold to cuddle.</p>
      <div className="w-pet-acts">
        <button type="button" className="w-act" style={{ background: 'var(--tint-amber)' }} onClick={() => play('pet')}>
          <Icon name={wi('hand')} size={24} className="w-amber" /><span className="t-body">Pet</span>
        </button>
        <Link href="/photo" className="w-act" style={{ background: 'var(--tint-red)' }}>
          <Icon name={wi('camera')} size={24} className="w-red" /><span className="t-body">Take a photo</span>
        </Link>
        <button type="button" className="w-act" style={{ background: 'var(--w-tint-purple)' }} onClick={() => play('dance', 2400)}>
          <Icon name={wi('music')} size={24} className="w-purple" /><span className="t-body">Dance</span>
        </button>
        <button type="button" className="w-act" style={{ background: 'var(--tint-blue)' }} aria-pressed={act === 'hide'}
                onClick={() => (act === 'hide' ? play('tap', 700) : play('hide'))}>
          <Icon name={wi('search')} size={24} className="w-blue" /><span className="t-body">Hide &amp; seek</span>
        </button>
      </div>
    </>
  );
}
