'use client';

import { useState } from 'react';
import { referralLink } from '@/lib/waitlist-email';
import { WAITLIST } from '@/lib/content';
import FigIcon from './FigIcon';
import { track } from '@vercel/analytics';
import { OWN_CODE_KEY, readStored, REF_KEY } from './SiteEffects';

type State = 'idle' | 'invalid' | 'sending' | 'done' | 'already' | 'error';

/* The six states are the handoff's, word for word. The only one it does not
   name is a server failure, which has to say something rather than sit on a
   spinner, so it asks you to try again and keeps what you typed.

   The shape is the Figma panel's (887:4657, phone 887:189339): on a wide
   screen the field and the button share one 60-high white pill with a mail
   icon at its head; on a phone they are two stacked pills, the second one
   ink with a sparkle. Same markup, same states, different chrome.

   Getting in is a moment: the field folds away, the button opens into a green
   bar with a tick and a burst, the crowd cheers, and the share link from the
   previous site appears, because a friend who joins with it moves you up. */
const BURST = 22;
export default function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [trap, setTrap] = useState('');          // honeypot, per the handoff
  const [code, setCode] = useState('');
  const [emailed, setEmailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const done = state === 'done' || state === 'already';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === 'sending' || done) return;
    const value = email.trim().toLowerCase();
    // One check, the same one the server does, so the message matches.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) { setState('invalid'); return; }
    setState('sending');
    track('waitlist_submit');
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: value,
          ref: readStored(REF_KEY) || undefined,
          referrer: document.referrer || undefined,
          company: trap                        // a filled honeypot is a bot
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setState(res.status === 400 ? 'invalid' : 'error'); return; }
      // The list hands back the same code for an address it already has, so
      // getting our own code back again means this person was on it.
      const got = typeof data.code === 'string' ? data.code : '';
      // The server knows from the list's count; the stored code is the fallback.
      const already = data.joined ? data.joined === 'already' : !!got && got === readStored(OWN_CODE_KEY);
      if (got) { try { localStorage.setItem(OWN_CODE_KEY, got); } catch { /* storage blocked */ } }
      setCode(got);
      setEmailed(data.emailed === true);
      track('waitlist_success', { status: already ? 'already' : 'new' });
      setState(already ? 'already' : 'done');
      // The crowd at the end of the page cheers a new arrival.
      if (!already) document.querySelector('.join-panel')?.classList.add('is-joined');
    } catch { setState('error'); }
  }

  const message =
    state === 'invalid' ? WAITLIST.invalid
    : state === 'done' ? (emailed ? WAITLIST.doneEmailed : WAITLIST.done)
    : state === 'already' ? WAITLIST.already
    : state === 'error' ? 'That did not go through. Try again in a moment.'
    : WAITLIST.hint;

  const tone =
    state === 'invalid' || state === 'error' ? 'text-red' : done ? 'text-green' : 'text-text-2';

  const link = code ? referralLink(code) : '';
  async function copy() {
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { /* no clipboard: the link is on screen to select */ }
  }

  return (
    <form onSubmit={submit} noValidate className="wl">
      <div className={`wl-pill${state === 'invalid' ? ' is-invalid' : ''}${done ? ' is-done' : ''}`}>
        <FigIcon name="mail" className="wl-mail" />
        <label className="sr-only" htmlFor="waitlist-email">Email address</label>
        <input
          id="waitlist-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={WAITLIST.placeholder}
          value={email}
          disabled={done}
          onChange={e => { setEmail(e.target.value); if (state !== 'sending') setState('idle'); }}
          aria-invalid={state === 'invalid'}
          aria-describedby="waitlist-msg"
          className="wl-input"
        />
        {/* Not display:none, a bot reads the styles too. Off-screen and
            out of the tab order is enough, and screen readers skip it. */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" tabIndex={-1} autoComplete="off"
                 value={trap} onChange={e => setTrap(e.target.value)} />
        </div>
        <button
          type="submit"
          disabled={state === 'sending' || done}
          className={`wl-button${done ? ' is-done' : ''}${state === 'sending' ? ' is-sending' : ''}`}
        >
          {done
            ? <FigIcon name="done" className="wl-check" />
            : <img src="/figma/icon-sparkle.svg" alt="" width={22} height={22} className="wl-sparkle" />}
          {/* Keyed so each new word slides in rather than swapping. */}
          <span key={done ? 'done' : state === 'sending' ? 'sending' : 'idle'} className="wl-label">
            {state === 'sending' ? WAITLIST.sending : done ? WAITLIST.doneButton : WAITLIST.button}
          </span>
          {state === 'done' && (
            <span className="wl-burst" aria-hidden>
              {Array.from({ length: BURST }, (_, i) => (
                <i key={i} style={{
                  '--a': `${(i * 360) / BURST + (i % 3) * 7}deg`,
                  '--d': `${54 + ((i * 37) % 46)}px`,
                  animationDelay: `${80 + (i % 4) * 40}ms`
                } as React.CSSProperties} />
              ))}
            </span>
          )}
        </button>
      </div>
      <p id="waitlist-msg" role="status" aria-live="polite" className={`wl-msg ${tone}`}>
        {message}
      </p>
      {done && link && (
        <div className="wl-share">
          <p className="wl-share-title">{WAITLIST.shareTitle}</p>
          <p className="wl-share-body">{WAITLIST.shareBody}</p>
          <div className="wl-share-row">
            <span className="wl-share-link">{link.replace(/^https:\/\//, '')}</span>
            <button type="button" className="wl-share-btn wl-share-copy" onClick={copy} data-cta="waitlist-share-copy">
              <FigIcon name={copied ? 'done' : 'send'} />{copied ? WAITLIST.copied : WAITLIST.copy}
            </button>
            <a className="wl-share-btn" data-cta="waitlist-share-whatsapp" target="_blank" rel="noopener"
               href={`https://wa.me/?text=${encodeURIComponent(WAITLIST.shareText + link)}`}>WhatsApp</a>
            <a className="wl-share-btn" data-cta="waitlist-share-x" target="_blank" rel="noopener"
               href={`https://x.com/intent/post?text=${encodeURIComponent(WAITLIST.shareText + link)}`}>X</a>
          </div>
        </div>
      )}
    </form>
  );
}
