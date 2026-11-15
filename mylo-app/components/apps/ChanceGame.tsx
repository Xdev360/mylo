'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated, useLocal } from '@/lib/local';
import { uid, useResults } from '@/lib/apps';
import { Avatar, Head } from './ui';

/* G7 · Chance (879:115344) and G8 · Chance · result (879:115378): rock,
   paper, scissors, best of three, against Mylo. A drawn round is played
   again. */
type Pick = 'rock' | 'paper' | 'scissors';
const PICKS: { id: Pick; label: string }[] = [{ id: 'rock', label: 'Rock' }, { id: 'paper', label: 'Paper' }, { id: 'scissors', label: 'Scissors' }];
const BEATS: Record<Pick, Pick> = { rock: 'scissors', paper: 'rock', scissors: 'paper' };
type Save = { id: string; round: number; you: number; them: number; shown?: { you: Pick; them: Pick } };
const VS = 'Mylo';
const fresh = (): Save => ({ id: uid(), round: 1, you: 0, them: 0 });

export default function ChanceGame() {
  const ready = useHydrated();
  const [save, setSave] = useLocal<Save>('mylo.apps.chance.v1', fresh());
  const [, setResults] = useResults();
  const [pick, setPick] = useState<Pick | null>(null);
  const [menu, setMenu] = useState(false);
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const lock = () => {
    if (!pick) return;
    const them = PICKS[Math.floor(Math.random() * 3)].id;
    const win = BEATS[pick] === them, lose = BEATS[them] === pick;
    const next = { ...save, you: save.you + (win ? 1 : 0), them: save.them + (lose ? 1 : 0), shown: { you: pick, them } };
    setSave(next);
    if (next.you === 2 || next.them === 2) {
      setResults(r => [{ id: save.id, game: 'chance', vs: VS, outcome: next.you === 2 ? 'won' : 'lost', at: new Date().toISOString(), how: `${next.you} to ${next.them}` }, ...r]);
    }
    setPick(null);
  };

  const more = <button type="button" className="ax-more" aria-label="More" onClick={() => setMenu(true)}><Icon name="apps/i-more" size={22} /></button>;
  const menuSheet = (
    <Sheet open={menu} onClose={() => setMenu(false)} title="Chance · best of 3">
      <div className="ax-menu">
        <button type="button" className="ax-menu-row" onClick={() => { setMenu(false); setSave(fresh()); setPick(null); }}><Icon name="apps/i-repeat" size={22} />Start again</button>
        <Link href="/games" className="ax-menu-row"><Icon name="apps/i-more" size={22} />All games</Link>
      </div>
    </Sheet>
  );

  if (save.shown) {
    const { you, them } = save.shown;
    const won = BEATS[you] === them, lost = BEATS[them] === you;
    const over = save.you === 2 || save.them === 2;
    const title = won ? `You take round ${save.round}` : lost ? `${VS} takes round ${save.round}` : `Round ${save.round} is even`;
    const score = `You ${save.you}, ${VS} ${save.them}.`;
    const tail = over ? (save.you === 2 ? ' You wear the crown today.' : ` ${VS} wears the crown today.`)
      : !won && !lost ? ' Pick again.'
      : save.you === 1 && save.them === 1 ? ' One round decides it.'
      : won && save.you === 1 ? ' Match point is yours.' : lost && save.them === 1 ? ` Match point to ${VS}.` : '';
    const next = () => setSave(over ? fresh() : { ...save, shown: undefined, round: won || lost ? save.round + 1 : save.round });
    return (
      <main className="screen on-desk ax-no-tabs no-tabs ax-chance">
        <Head title="Chance · best of 3" fallback="/games" right={more} />
        <div className="ax-reveal">
          <div className={`ax-picked${won ? ' is-win' : ''}`}><Icon name={`apps/i-${you}`} size={64} /><span className="t-body ax-600">You</span></div>
          <span className="ax-beats">{won || lost ? 'beats' : 'vs'}</span>
          <div className={`ax-picked${lost ? ' is-win' : ''}`}><Icon name={`apps/i-${them}`} size={64} /><span className="t-body ax-600">{VS}</span></div>
        </div>
        {lost && <p className="sr-only">{VS}&rsquo;s pick beats yours</p>}
        <img className="ax-sticker" src={won ? '/figma/apps/mylo-laugh.svg' : lost ? '/figma/apps/mylo-sad.svg' : '/figma/apps/mylo-even.svg'} alt="" width={124} height={124} />
        <h1 className="ax-moment-title is-24">{title}</h1>
        <p className="ax-14 c-2 ax-center">{score}{tail}</p>
        <span className="spacer" />
        <button type="button" className="ax-btn ax-cta" onClick={next}>{over ? 'Rematch' : 'Next round'}</button>
        {menuSheet}
      </main>
    );
  }

  return (
    <main className="screen on-desk ax-no-tabs no-tabs ax-chance">
      <Head title="Chance · best of 3" fallback="/games" right={more} />
      <div className="ax-versus">
        <Avatar name="You" size={48} me />
        <span className="ax-versus-side"><span className="t-body ax-600">You</span><span className="ax-score">{save.you}</span></span>
        <span className="ax-14 c-3">vs</span>
        <span className="ax-versus-side is-right"><span className="t-body ax-600">{VS}</span><span className="ax-score">{save.them}</span></span>
        <Avatar name={VS} size={48} tint="var(--tint-green)" />
      </div>
      <p className="ax-how">Round {save.round}</p>
      <h1 className="ax-moment-title is-24">Make your pick</h1>
      <div className="ax-picks" role="radiogroup" aria-label="Your pick">
        {PICKS.map(p => (
          <button key={p.id} type="button" role="radio" aria-checked={pick === p.id} className={`ax-pick${pick === p.id ? ' is-on' : ''}`} onClick={() => setPick(p.id)}>
            <Icon name={`apps/i-${p.id}`} size={52} />
            <span className="t-body ax-600">{p.label}</span>
          </button>
        ))}
      </div>
      <button type="button" className="ax-btn" disabled={!pick} onClick={lock}><img src="/figma/apps/i-lock.svg" alt="" width={22} height={22} className="ax-on-ink" />Lock it in</button>
      <p className="ax-note ax-center">Winner wears the crown on their profile for a day.</p>
      {menuSheet}
    </main>
  );
}
