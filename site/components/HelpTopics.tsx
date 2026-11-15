'use client';
import { useMemo, useState } from 'react';
import Link from 'next/link';
import Reveal from './Reveal';
import FigIcon from './FigIcon';
import { TextSections } from './TextPage';
import { HELP_PAGE } from '@/lib/content';

/* Figma "Web · Help" (1107:91836): the search field, six topic cards and
   the popular questions. Typing filters both, on the client. With nothing
   left, the page says what its own lead says: message us. */
export default function HelpTopics() {
  const [q, setQ] = useState('');
  const { topics, shown } = useMemo(() => {
    const t = q.trim().toLowerCase();
    const has = (...parts: (string | undefined)[]) => !t || parts.join(' ').toLowerCase().includes(t);
    return {
      topics: HELP_PAGE.topics.filter(x => has(x.title, x.body)),
      shown: HELP_PAGE.sections.filter(x => has(x.title, x.body))
    };
  }, [q]);

  return (
    <>
      <Reveal>
        <label className="tp-search">
          <FigIcon name="search" />
          <span className="sr-only">{HELP_PAGE.search}</span>
          <input type="search" value={q} onChange={e => setQ(e.target.value)}
                 placeholder={HELP_PAGE.search} />
        </label>
      </Reveal>
      <Reveal className="tp-topics">
        {topics.map(t => {
          const body = (
            <>
              <span className="tp-topic-tile"><FigIcon name={t.icon} /></span>
              <h2 className="tp-topic-title">{t.title}</h2>
              <p className="tp-topic-body">{t.body}</p>
            </>
          );
          return t.href
            ? <Link key={t.title} href={t.href} className="tp-topic tp-topic-link">{body}</Link>
            : <article key={t.title} className="tp-topic">{body}</article>;
        })}
      </Reveal>
      {shown.length > 0 && <h2 className="tp-popular">{HELP_PAGE.popular}</h2>}
      <div className="tp-col tp-spaced" aria-live="polite">
        {shown.length > 0 && <TextSections sections={shown} />}
        {!shown.length && !topics.length && <p className="tp-a">{HELP_PAGE.noMatch}</p>}
      </div>
    </>
  );
}
