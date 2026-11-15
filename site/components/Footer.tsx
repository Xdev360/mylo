import Link from 'next/link';
import { FOOTER_LINKS, SITE } from '@/lib/content';

/* Figma frames "10 Footer" (887:5333) and 887:189897: the links centred on
   one line, the credit centred under them. No rule above it, the waitlist
   panel it follows already ends the page. */
export default function Footer() {
  return (
    <footer className="px-4 pb-8 pt-5 text-center tablet:px-10 desktop:px-section">
      <nav className="flex flex-wrap justify-center gap-x-7 gap-y-2" aria-label="Footer">
        {FOOTER_LINKS.map(l => {
          const Tag = l.href.startsWith('/') ? Link : 'a';
          return (
            <Tag key={l.label} href={l.href} className="t-small text-text-2 transition-colors hover:text-ink">
              {l.label}
            </Tag>
          );
        })}
      </nav>
      <p className="mt-6 text-[13px] font-medium text-[var(--text-note)] tablet:text-[14px]">{SITE.madeBy}</p>
    </footer>
  );
}
