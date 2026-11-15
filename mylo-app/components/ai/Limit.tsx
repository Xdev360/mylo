'use client';

import Icon from '../Icon';
import { useStore } from '@/lib/store';
import { DAILY, untilMidnight, useNow } from '@/lib/ai';

/* AI8 · Daily AI limit reached. Ten a day, counted on this device; the
   count comes back at the person's midnight. Adding by hand still works. */
export default function Limit({ used, onBack }: { used: number; onBack: () => void }) {
  const { openCapture } = useStore();
  const now = useNow();
  return (
    <main className="ai-limit">
      <header className="ai-limit-top">
        <button type="button" className="back-btn" aria-label="Back" onClick={onBack}><Icon name="chevron-right" size={20} className="flip" /></button>
      </header>
      <div className="ai-limit-body">
        <span className="ai-limit-disc"><img src="/figma/ai/mylo-limit.svg" alt="" width={103} height={130} /></span>
        <p className="t-label c-2 ai-limit-count">{Math.min(used, DAILY)} of {DAILY} today</p>
        <h1 className="ai-limit-title">That&rsquo;s all my thinking for today.</h1>
        <p className="ai-limit-sub">I&rsquo;m back at midnight. Add things by hand till then.</p>
        <span className="ai-limit-dashes" aria-hidden>
          {Array.from({ length: DAILY }, (_, i) => <span key={i} className={i < used ? 'is-used' : ''} />)}
        </span>
        {now > 0 && <p className="ai-limit-reset">Resets in {untilMidnight(now)}</p>}
        <button type="button" className="btn-primary ai-limit-btn" onClick={openCapture}>
          <Icon name="ai/plus" size={20} />Add a goal myself
        </button>
      </div>
    </main>
  );
}
