'use client';
import { useEffect, useRef } from 'react';

/* Fade up 16px, 400ms ease-out, once per section, the handoff's only
   scroll motion. The class does the animating; this just decides when.
   Reduced motion is handled in CSS, so nothing here has to know about it.

   On the first load the inline script in the layout (lib/reveal-boot.ts) does
   this job before React has hydrated, so nothing on screen waits for the
   JavaScript bundle to appear. It only ever adds `is-in`, which is why the
   element tolerates the class differing from the server's HTML. After a
   client-side navigation, this effect does it. */

export default function Reveal({
  as: Tag = 'div', className = '', delay = 0, children, ...rest
}: {
  as?: React.ElementType; className?: string; delay?: number; children: React.ReactNode;
} & Omit<React.HTMLAttributes<HTMLElement>, 'className' | 'children'>) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || el.classList.contains('is-in')) return;
    // Already past it on load (a deep link, a refresh mid-page): show it now.
    if (el.getBoundingClientRect().top < window.innerHeight) {
      const t = setTimeout(() => el.classList.add('is-in'), delay);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      setTimeout(() => el.classList.add('is-in'), delay);
      io.disconnect();                       // once per section
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, [delay]);
  return <Tag ref={ref} className={`reveal ${className}`} suppressHydrationWarning {...rest}>{children}</Tag>;
}
