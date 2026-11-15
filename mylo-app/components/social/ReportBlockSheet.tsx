'use client';

import { useState } from 'react';
import Sheet from '@/components/Sheet';
import { SIcon } from './ui';
import { firstName, useBlocked, useFriends, useReports, type Person } from '@/lib/social';

/* FR3 · Report or block: why, in five rows, or block outright. Exported for
   any screen that shows a person (a friend's house, their profile). */
const REASONS = ['Spam or fake account', 'Mean or harassing', 'Inappropriate photo or vibe', 'Pretending to be someone', 'Something else'];

export default function ReportBlockSheet({ person, open, onClose, onBlocked }: {
  person: Person | null; open: boolean; onClose: () => void; onBlocked?: (p: Person) => void;
}) {
  const [, setReports] = useReports();
  const [, setBlocked] = useBlocked();
  const [, setFriends] = useFriends();
  const [sent, setSent] = useState(false);
  const close = () => { setSent(false); onClose(); };
  const name = person ? firstName(person.name) : '';
  return (
    <Sheet open={open} onClose={close} title={sent ? 'Thanks for telling us' : name} sub={sent ? 'Our safety team will look at it.' : 'What is going on?'} labelId="sx-report-person">
      {person && !sent && <>
        <div className="sx-reasons">
          {REASONS.map(r => (
            <button key={r} type="button" className="sx-reason" onClick={() => { setReports(x => [...x, { target: person.handle, kind: 'person', reason: r, at: Date.now() }]); setSent(true); }}>
              <span>{r}</span><SIcon name="fr-chevron" size={20} className="c-2" />
            </button>
          ))}
        </div>
        <button type="button" className="sx-btn-soft sx-wide" onClick={() => {
          setBlocked(b => [...new Set([...b, person.handle])]);
          setFriends(f => f.filter(x => x.handle !== person.handle));
          onBlocked?.(person); close();
        }}><SIcon name="fr-shield" size={20} />Block {name}</button>
        <p className="sx-foot">{name} will not know you reported. Blocking removes them from your rooms and photos.</p>
      </>}
      {sent && <button type="button" className="btn-primary sx-wide" onClick={close}>Done</button>}
    </Sheet>
  );
}
