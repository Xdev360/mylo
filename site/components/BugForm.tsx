'use client';

import { useState, type FormEvent } from 'react';
import FigIcon from './FigIcon';
import { BUG_PAGE as B } from '@/lib/content';

/* The bug page's two halves: the form from Figma "L6 · Report a bug", with the
   username the previous site's Testers page asked for so a confirmed report
   can be paid, and Doctor Mylo beside it holding the reward. Mylo follows
   along: a nod when you pick a place, a bob while you type, a hop when the
   report lands. */
export default function BugForm() {
  const [area, setArea] = useState('');
  const [detail, setDetail] = useState('');
  const [username, setUsername] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');
  const [ref, setRef] = useState('');

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state === 'sending') return;
    if (!area) { setError(B.pickArea); return; }
    if (detail.trim().length < 15) { setError(B.tooShort); return; }
    setError('');
    setState('sending');
    const company = (new FormData(e.currentTarget).get('company') as string) || '';
    try {
      const res = await fetch('/api/bug', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ area, detail, username, company })
      });
      if (!res.ok) {
        setError(res.status === 429 ? B.slowDown : B.failed);
        setState('idle');
        return;
      }
      const data = await res.json();
      setRef(data.ref || '');
      setState('sent');
    } catch {
      setError(B.failed);
      setState('idle');
    }
  }

  const mood = state !== 'idle' ? state : detail ? 'typing' : area ? 'picked' : 'idle';

  return (
    <div className="bug-page" data-mood={mood}>
      <aside className="bug-side">
        {/* Keyed so the nod plays again each time the place changes. */}
        <span className="bug-mylo" key={area}>
          <img src="/figma/mylo-doctor.svg" alt="" width={159} height={190} />
        </span>
        <div className="bug-side-text">
          <p className="bug-amt">{B.amount}</p>
          <p className="bug-pay">{B.pay}</p>
          <p className="bug-dup">{B.duplicates}</p>
        </div>
      </aside>

      {state === 'sent' ? (
        <div className="bug-sent" role="status">
          <p className="bug-sent-title">{B.sentTitle}</p>
          {ref && <p className="bug-sent-body">{B.sentBody} <strong>{ref}</strong>.</p>}
          <button type="button" className="btn-secondary bug-again"
                  onClick={() => { setDetail(''); setArea(''); setRef(''); setState('idle'); }}>
            {B.again}
          </button>
        </div>
      ) : (
        <form className="bug-form" onSubmit={send} noValidate>
          <fieldset className="bug-field">
            <legend className="bug-label">{B.whereLabel}</legend>
            <div className="bug-chips">
              {B.areas.map(a => (
                <button key={a} type="button" aria-pressed={area === a}
                        className={`bug-chip${area === a ? ' is-on' : ''}`}
                        onClick={() => { setArea(a); setError(''); }}>
                  {a}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="bug-field">
            <span className="bug-label">{B.whatLabel}</span>
            <textarea className="bug-text" name="detail" rows={4} maxLength={2000}
                      placeholder={B.placeholder} value={detail}
                      onChange={e => { setDetail(e.target.value); setError(''); }} />
          </label>

          <label className="bug-field">
            <span className="bug-label">{B.userLabel}</span>
            <input className="bug-input" type="text" name="username" maxLength={21} autoComplete="off"
                   placeholder={B.userPlaceholder} value={username}
                   onChange={e => setUsername(e.target.value)} />
          </label>

          <input type="text" name="company" className="bug-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" />

          <p className="bug-fine">{B.fine}</p>
          {/* Keyed so a second, different problem shakes again. */}
          {error && <p className="bug-error" role="alert" key={error}>{error}</p>}
          <button type="submit" className="btn-primary bug-send" disabled={state === 'sending'}>
            {state === 'sending' ? B.sending : B.cta}
            <FigIcon name="arrow" />
          </button>
        </form>
      )}
    </div>
  );
}
