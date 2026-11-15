'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Sheet from '@/components/Sheet';
import { canGoBack, goBack } from '@/components/NavMotion';

/* L6 · Report a bug (368:72964): where, what happened, send. Posts to the
   website's live endpoint, which files it with the tester's username when
   there is one. The site does not answer cross-origin requests yet, so from
   another origin the browser blocks the call; that shows as a failure here,
   never as a pretend success. */

export const BUG_AREAS = ['Today', 'Goals', 'Calendar', 'Chat', 'Rooms', 'Apps & games', 'Mylo AI', 'Stories', 'Signing in', 'Something else'];
const ENDPOINT = 'https://www.staymylo.com/api/bug';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'slow';

export default function ReportBug({ username }: { username?: string }) {
  const router = useRouter();
  const [area, setArea] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const close = () => (canGoBack() ? goBack(router) : router.push('/settings'));
  const text = detail.trim();
  const ok = !!area && text.length >= 15 && text.length <= 2000 && status !== 'sending';

  async function send() {
    if (!ok) return;
    setStatus('sending');
    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ area, detail: text, ...(username ? { username } : {}) })
      });
      if (res.status === 429) { setStatus('slow'); return; }
      if (!res.ok) { setStatus('error'); return; }
      setStatus('sent');
      window.setTimeout(close, 1400);
    } catch {
      setStatus('error');
    }
  }

  return (
    <main className="screen rw on-desk" aria-label="Report a bug">
      <Sheet open onClose={close} title="Report a bug" sub="Found something broken? Tell us where and what happened.">
        <p className="rw-bug-label">Where</p>
        <div className="rw-bug-chips" role="radiogroup" aria-label="Where">
          {BUG_AREAS.map(a => (
            <button key={a} type="button" role="radio" aria-checked={area === a} className={`rw-bug-chip${area === a ? ' is-on' : ''}`} onClick={() => setArea(a)}>{a}</button>
          ))}
        </div>
        <label className="rw-bug-field">
          <span className="rw-bug-label">What happened</span>
          <textarea value={detail} maxLength={2000} rows={4} onChange={e => { setDetail(e.target.value); if (status !== 'sending') setStatus('idle'); }} />
        </label>
        <p className="rw-bug-label" role={status === 'error' || status === 'slow' ? 'alert' : undefined}>
          {status === 'error' ? 'Could not send. Check your connection and try again.'
            : status === 'slow' ? 'A lot of reports right now. Try again in a bit.'
            : text.length > 0 && text.length < 15 ? `${15 - text.length} more characters`
            : 'Device info is attached for you.'}
        </p>
        <button type="button" className="btn-primary rw-wide" disabled={!ok || status === 'sent'} onClick={send}>
          {status === 'sending' ? 'Sending' : status === 'sent' ? 'Sent' : 'Send report'}
        </button>
      </Sheet>
    </main>
  );
}
