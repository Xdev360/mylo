'use client';
import { useEffect, useRef, useState } from 'react';

/* The phone turns the tiles after the first one into a swipe row with dots
   (Figma 887:187667). From the tablet width the row is display:contents and
   the tiles go straight into the section's grid, so nothing is rendered
   twice and no picture is downloaded for a layout nobody is looking at.

   The dots follow the scroller rather than drive it: the design shows them
   as an indicator, and a scroll-snap row already reads as swipeable. */
export default function Scroller({
  dots, className = '', children
}: { dots: number; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => {
      // display:contents on wide screens leaves no scroll box to read.
      const step = el.scrollWidth / Math.max(dots, 1);
      if (!step) return;
      setAt(Math.min(dots - 1, Math.round(el.scrollLeft / step)));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [dots]);

  return (
    <>
      <div ref={ref} className={`scroller ${className}`}>{children}</div>
      {dots > 0 && (
        <div className="scroller-dots" aria-hidden>
          {Array.from({ length: dots }, (_, i) => (
            <span key={i} className={i === at ? 'is-at' : undefined} />
          ))}
        </div>
      )}
    </>
  );
}
