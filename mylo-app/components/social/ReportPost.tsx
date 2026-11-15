'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import ScreenHeader from '@/components/ScreenHeader';
import { ActionRow, SIcon } from './ui';
import { firstName, useBlocked, useHidden, useMuted, usePosts, useReports } from '@/lib/social';
import { useHydrated } from '@/lib/local';

/* VF13a · Report post, and VF13b · Report sent. */
const REASONS = ['Bullying or harassment', 'Hate or abuse', 'Someone may be at risk', 'Nudity or sexual content', 'Spam or scam', 'Pretending to be someone', 'Something else'];

function useAuthor() {
  const { id } = useParams<{ id: string }>();
  const [posts] = usePosts();
  const post = posts.find(p => p.id === id);
  return { id, post, who: post ? firstName(post.by.name) : '' };
}

export function ReportPost() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { id, post, who } = useAuthor();
  const [reason, setReason] = useState(REASONS[0]);
  const [, setReports] = useReports();
  const [, setHidden] = useHidden();
  const submit = () => {
    setReports(r => [...r, { target: id, kind: 'post', reason, at: Date.now() }]);
    setHidden(h => [...new Set([...h, id])]);
    router.replace(`/feed/${id}/report/sent`);
  };
  return (
    <main className="screen on-desk sx-full sx-report">
      <ScreenHeader title="Report post" fallback={`/feed/${id}`} />
      <div className="sx-report-head">
        <h2 className="sx-h2">Why are you reporting this?</h2>
        {hydrated && post && <p className="t-body-s c-2">{who} will not know you reported it.</p>}
      </div>
      <div className="sx-radios" role="radiogroup" aria-label="Why are you reporting this?">
        {REASONS.map(r => (
          <button key={r} type="button" role="radio" aria-checked={reason === r} className="sx-radio" onClick={() => setReason(r)}>
            <span>{r}</span><span className="sx-radio-dot" />
          </button>
        ))}
      </div>
      <div className="sx-bottom"><button type="button" className="btn-primary sx-wide" onClick={submit}>Submit report</button></div>
    </main>
  );
}

export function ReportSent() {
  const router = useRouter();
  const hydrated = useHydrated();
  const { post, who } = useAuthor();
  const [muted, setMuted] = useMuted();
  const [blocked, setBlocked] = useBlocked();
  const handle = post?.by.handle;
  const isMuted = !!handle && muted.includes(handle);
  const isBlocked = !!handle && blocked.includes(handle);
  return (
    <main className="screen on-desk sx-full sx-sent-screen">
      <ScreenHeader fallback="/feed" />
      <section className="sx-sent-main">
        <span className="sx-sent-badge"><SIcon name="shield-ok" size={40} /></span>
        <h2 className="sx-sent-title">Thanks for telling us</h2>
        <p className="sx-sent-text">Our safety team will look at it. You will not see this post again.</p>
      </section>
      {hydrated && handle && (
        <div className="sx-rows">
          <ActionRow icon="minus" label={isMuted ? `${who} is muted` : `Mute ${who}`} sub="Hide their posts. They will not know." chevron
                     onClick={() => setMuted(m => isMuted ? m.filter(h => h !== handle) : [...m, handle])} />
          <ActionRow icon="ban" label={isBlocked ? `${who} is blocked` : `Block ${who}`} sub="They cannot see you or message you" danger chevron
                     onClick={() => setBlocked(b => isBlocked ? b.filter(h => h !== handle) : [...b, handle])} />
        </div>
      )}
      <div className="sx-bottom"><button type="button" className="btn-primary sx-wide" onClick={() => router.replace('/feed')}>Done</button></div>
    </main>
  );
}
