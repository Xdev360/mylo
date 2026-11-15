'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import { useHydrated } from '@/lib/local';
import { BADGE_COLOURS, badgeHex, useProfile, type BadgeColour as Colour } from '@/lib/profile';
import { useStore } from '@/lib/store';
import { flash, leave } from '@/lib/system';
import { Avatar, Seal } from './bits';

/* P28 · Badge colour (932:130089): your seal, how it looks next to your name
   in a chat, and the colours to pick from. */
export default function BadgeColour() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { profile: p, save } = useProfile();
  const { items } = useStore();
  const [pick, setPick] = useState<Colour | null>(null);
  if (!hydrated) return <main className="screen on-desk" aria-busy="true" />;
  const colour = pick ?? p.badge;
  const hex = badgeHex(colour);
  const line = [...items].reverse().find(i => i.kind === 'task')?.title ?? p.bio;
  const back = () => leave(router, '/profile');

  return (
    <main className="screen on-desk pf-badge-screen">
      <header className="screen-header">
        <button type="button" className="back-btn" aria-label="Close" onClick={back}><Icon name="close" size={19} /></button>
        <h1 className="screen-header-title">Your badge</h1>
        <span className="screen-header-actions" />
      </header>

      <section className="pf-badge-preview">
        <Avatar photo={p.photo} mylo={p.myloLook} name={p.name} size={72} mode="initial" />
        <p className="pf-badge-name">{p.name || 'You'}<Seal size={22} colour={hex} /></p>
        <p className="t-caption c-2">{[p.username && `@${p.username}`, p.premium && 'Premium'].filter(Boolean).join(' · ')}</p>
        <div className="pf-badge-chat">
          <Avatar photo={p.photo} mylo={p.myloLook} name={p.name} size={30} mode="initial" />
          <span className="pf-badge-chat-text">
            <span className="t-body-s c-ink pf-badge-chat-name">{p.name || 'You'}<Seal size={14} colour={hex} /></span>
            {line && <span className="t-caption c-2">{line}</span>}
          </span>
        </div>
      </section>

      <h2 className="t-title-s">Colour</h2>
      <div className="pf-swatches" role="radiogroup" aria-label="Badge colour">
        {BADGE_COLOURS.map(c => (
          <button key={c.id} type="button" role="radio" aria-checked={colour === c.id} className={`pf-swatch${colour === c.id ? ' is-on' : ''}`} onClick={() => setPick(c.id)}>
            <span className="pf-swatch-tile"><Seal size={32} colour={c.hex} /></span>
            <span className="t-caption c-2">{c.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="btn-primary pf-wide pf-badge-save" onClick={() => { if (colour !== p.badge) { save({ badge: colour }); flash('Badge saved'); } back(); }}>Save badge</button>
    </main>
  );
}
