/* The sidebar, open or folded to its icons. Wide screens only; below 1280
   the top bar and the menu take over and this has no effect. Open is the
   default, so only the fold is stored, and the boot script in lib/theme.ts
   stamps it on <html> before the first paint so the page never jumps. */
export type Side = 'open' | 'rail';
export const SIDE_KEY = 'mylo.side';
const OPEN_W = 300;
const RAIL_W = 100;

export function currentSide(): Side {
  return document.documentElement.dataset.side === 'rail' ? 'rail' : 'open';
}

/* The sheet changes width, so everything in it changes height. Hold on to
   the section at the top of the window and how far through it we are, and
   put it back: otherwise folding the sidebar drops you somewhere else. */
function holdPlace(change: () => void) {
  const anchor = [...(document.querySelector('main')?.children ?? [])]
    .find(s => s.getBoundingClientRect().bottom > 0);
  const before = anchor?.getBoundingClientRect();
  const through = before && before.top < 0 ? -before.top / before.height : null;
  change();
  if (anchor && through !== null) {
    const after = anchor.getBoundingClientRect();
    window.scrollTo({ top: window.scrollY + after.top + through * after.height, behavior: 'instant' });
  }
}

export function setSide(side: Side) {
  const root = document.documentElement;
  const apply = () => {
    holdPlace(() => {
      if (side === 'rail') root.dataset.side = 'rail';
      else delete root.dataset.side;
    });
    window.dispatchEvent(new Event('mylo-side'));
  };
  try {
    if (side === 'rail') localStorage.setItem(SIDE_KEY, side);
    else localStorage.removeItem(SIDE_KEY);
  } catch { /* storage blocked: it still folds for this visit */ }

  // The sheet is a long page of drawings, too heavy to resize frame by frame,
  // so the browser slides pictures of the two layouts instead. No support, or
  // reduced motion, and it simply changes.
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return; }
  root.style.setProperty('--fold', `${side === 'rail' ? RAIL_W - OPEN_W : OPEN_W - RAIL_W}px`);
  root.dataset.folding = '';
  document.startViewTransition(apply).finished.finally(() => { delete root.dataset.folding; });
}
