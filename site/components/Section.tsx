import Reveal from './Reveal';

/* Section padding from the handoff: 62 left and right on desktop, 16 on
   mobile; 48 top and bottom on mobile, and a desktop band inside the 60–96 /
   30–80 range it gives. Individual frames vary, so each section can override
   once the Figma values are read. */
export default function Section({
  id, className = '', children
}: { id: string; className?: string; children: React.ReactNode }) {
  return (
    <section
      id={id}
      className={`scroll-mt-topbar px-4 py-12 tablet:px-10 desktop:px-section desktop:py-[76px] ${className}`}
    >
      {children}
    </section>
  );
}

export function SectionHead({
  eyebrow, title, lead
}: { eyebrow?: string; title?: string; lead?: string }) {
  if (!eyebrow && !title && !lead) return null;
  return (
    <Reveal className="max-w-lead">
      {eyebrow && <p className="t-eyebrow text-text-2">{eyebrow}</p>}
      {title && <h2 className="t-display-l mt-3">{title}</h2>}
      {lead && <p className="t-lead mt-4 text-text-2">{lead}</p>}
    </Reveal>
  );
}
