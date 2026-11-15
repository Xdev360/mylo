'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Icon from '@/components/Icon';
import RwCard from './Card';
import { BackBtn, CloseBtn, Confetti, Sparkles } from './bits';
import { FriendsEmpty } from './EmptyStates';
import { CARDS, RARITY, cardById, since, useRewards, type Card } from '@/lib/rewards';
import { firstName, initial, solidFor, useFriends } from '@/lib/social';

/* U4 · Gift a card (879:190581) and U5 · Gift sent (879:191135). A spare
   card goes to a friend who has been around for 7 days; one gift a week.
   Friends are the social area's list. */

const DAY = 86400000;

export default function GiftView({ cardId }: { cardId?: string }) {
  const r = useRewards();
  const router = useRouter();
  const [friends] = useFriends();
  const [to, setTo] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState<{ name: string; card: Card } | null>(null);
  const [now] = useState(() => Date.now());
  if (!r.ready) return <main className="screen" aria-busy="true" />;

  if (sent) return <GiftSent name={sent.name} card={sent.card} onDone={() => router.push('/rewards')} />;

  const spare = CARDS.find(c => (r.state.cards[c.id] ?? 0) > 1);
  const card = (cardId && cardById(cardId)) || spare || r.owned[0] || null;
  const have = card ? r.state.cards[card.id] ?? 0 : 0;
  const last = r.state.gifts.at(-1);
  const wait = last ? Math.max(0, Math.ceil((new Date(last.at).getTime() + 7 * DAY - now) / DAY)) : 0;
  const chosen = friends.find(f => f.handle === to) ?? null;
  const canSend = !!card && have > 1 && !!chosen && wait === 0;

  return (
    <main className="screen rw on-desk rw-has-foot">
      <header className="rw-top rw-top-left">
        <BackBtn fallback="/rewards/collection" />
        <h1 className="rw-left-title">Gift a card</h1>
      </header>

      {card ? (
        <section className="rw-gift-card">
          <RwCard card={card} className="rw-gift-thumb" />
          <div className="rw-gift-info">
            <h2 className="rw-gift-name">{card.name}</h2>
            <p className="rw-gift-meta">{RARITY[card.rarity].label} · you have {have}</p>
            <p className="rw-gift-hint">You keep one. The other goes to your friend.</p>
          </div>
        </section>
      ) : (
        <p className="t-body c-2">You keep one. The other goes to your friend.</p>
      )}

      <h2 className="rw-h">Pick a friend</h2>
      {friends.length === 0 ? <FriendsEmpty compact /> : (
        <div className="rw-friends" role="radiogroup" aria-label="Pick a friend">
          {friends.map(f => {
            const days = Math.ceil((f.addedAt + 7 * DAY - now) / DAY);
            const ok = days <= 0;
            const on = to === f.handle;
            return (
              <button key={f.handle} type="button" role="radio" aria-checked={on} disabled={!ok}
                      className={`rw-friend${on ? ' is-on' : ''}`} onClick={() => setTo(f.handle)}>
                <span className="avatar rw-friend-av" style={{ background: solidFor(f.handle) }}>{initial(f.name)}</span>
                <span className="rw-friend-text">
                  <span className="rw-friend-name">{f.name}</span>
                  <span className="rw-friend-sub">{ok ? since(f.addedAt, now) : `Can receive gifts in ${days === 1 ? '1 day' : `${days} days`}`}</span>
                </span>
                <span className="rw-radio">{on && <Icon name="rewards/i-check" size={16} />}</span>
              </button>
            );
          })}
        </div>
      )}

      {friends.length > 0 && (
        <label className="rw-note">
          <span className="sr-only">Note</span>
          <input value={note} maxLength={80} onChange={e => setNote(e.target.value)} placeholder={chosen ? `Enjoy this one, ${firstName(chosen.name)}!` : ''} />
        </label>
      )}
      <p className="rw-fine">{wait > 0 ? `You can send the next gift in ${wait === 1 ? '1 day' : `${wait} days`}.` : '1 gift a week. Only friends who have been in a room with you for 7 days.'}</p>

      <div className="rw-foot">
        <button type="button" className="btn-primary rw-wide" disabled={!canSend}
                onClick={() => {
                  if (!canSend || !card || !chosen) return;
                  r.sendGift(card.id, chosen.handle, note.trim() || `Enjoy this one, ${firstName(chosen.name)}!`);
                  setSent({ name: firstName(chosen.name), card });
                }}>Send gift</button>
      </div>
    </main>
  );
}

function GiftSent({ name, card, onDone }: { name: string; card: Card; onDone: () => void }) {
  return (
    <main className="screen rw on-desk rw-sent">
      <header className="rw-top"><span className="rw-top-gap" /><span /><CloseBtn onClick={onDone} /></header>
      <div className="rw-sent-art" aria-hidden>
        <span className="rw-sent-disc" />
        <RwCard card={card} className="rw-sent-card" />
        <span className="rw-box-body" /><span className="rw-box-lid" /><span className="rw-box-ribbon" />
        <Confetti thin />
      </div>
      <h1 className="rw-sent-title">On its way to {name}</h1>
      <p className="rw-sent-sub">They get a little gift box in their rewards. You can send the next gift in 7 days.</p>
      <span className="spacer" />
      <button type="button" className="btn-primary rw-wide" onClick={onDone}>Done</button>
    </main>
  );
}

/* U6 · A friend gets the gift (879:191686). Shown to the person a gift was
   sent to, once gifts travel through the server; nothing on this device can
   receive one yet. */
export function GiftReceived({ from, card, note, onWear, onThanks, onClose }: {
  from: string; card: Card; note?: string; onWear: () => void; onThanks: () => void; onClose: () => void;
}) {
  return (
    <main className="rw-reveal is-gift" aria-labelledby="rw-gift-title">
      <div className="rw-reveal-col">
        <span className="rw-reveal-close"><CloseBtn onClick={onClose} /></span>
        <span className="avatar rw-gift-from" style={{ background: solidFor(from) }}>{initial(from)}</span>
        <h1 id="rw-gift-title" className="rw-reveal-title is-24">{firstName(from)} sent you a gift</h1>
        <div className="rw-reveal-stage is-gift">
          <span className="rw-reveal-glow is-warm" />
          <Sparkles />
          <RwCard card={card} className={`rw-reveal-card is-${card.rarity}`} />
        </div>
        {note && <p className="rw-gift-note">“{note}”</p>}
        <span className="spacer" />
        <button type="button" className="rw-btn-white rw-wide" onClick={onWear}>Wear it now</button>
        <button type="button" className="rw-btn-ghost rw-wide" onClick={onThanks}>Say thanks</button>
      </div>
    </main>
  );
}

