'use client';

import { useLayoutEffect, useRef } from 'react';

/* A highlight that slides to the chosen item instead of jumping: segmented
   controls, the tab bar, the sidebar, a day strip. Put the ref on the row,
   a <SlidePill /> inside it, and give the row the `slide-track` class; the
   chosen child is whichever carries aria-selected, aria-checked,
   aria-pressed or aria-current. The row's CSS paints the pill (`.x
   .slide-pill{ background:… }`) and leaves the chosen child's own background
   to it. `dep` is whatever decides the choice, so it moves when that does.

   const track = useSlidePill<HTMLDivElement>(tab);
   <div ref={track} className="g-seg slide-track"><SlidePill />…</div>      */
const CHOSEN = ':scope > [aria-selected="true"], :scope > [aria-checked="true"], :scope > [aria-pressed="true"], :scope > [aria-current="page"], :scope > [aria-current="date"], :scope > [aria-current="true"]';

export function useSlidePill<T extends HTMLElement>(dep: unknown) {
  const ref = useRef<T>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = () => {
      const on = el.querySelector<HTMLElement>(CHOSEN);
      if (!on || !on.offsetWidth) { el.style.setProperty('--pill-o', '0'); return; }
      el.style.setProperty('--pill-x', `${on.offsetLeft}px`);
      el.style.setProperty('--pill-y', `${on.offsetTop}px`);
      el.style.setProperty('--pill-w', `${on.offsetWidth}px`);
      el.style.setProperty('--pill-h', `${on.offsetHeight}px`);
      el.style.setProperty('--pill-o', '1');
    };
    place();
    // Placed once without motion; from then on it slides.
    const raf = requestAnimationFrame(() => { el.dataset.pill = 'on'; });
    const ro = new ResizeObserver(place);
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [dep]);
  return ref;
}

export function SlidePill() {
  return <span className="slide-pill" aria-hidden />;
}
