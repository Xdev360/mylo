'use client';

import { useEffect } from 'react';

/* Which way a navigation goes, for the page transition in globals.css:
   opening something deeper slides it in from the right (push), going back
   slides it away (pop), and moving between the main tabs crossfades (tab).
   It is decided as the click or the back gesture happens, before the page
   changes, by stamping data-nav on <html>. */
const ROOTS = ['/today', '/goals', '/chats', '/apps', '/ai', '/rewards', '/profile', '/welcome', '/'];
const depth = (p: string) => (ROOTS.includes(p) ? 0 : p.split('/').filter(Boolean).length);

export function navDirection(from: string, to: string): 'push' | 'pop' | 'tab' {
  const a = depth(from), b = depth(to);
  if (a === 0 && b === 0) return 'tab';
  return b > a ? 'push' : b < a ? 'pop' : 'tab';
}
export function stampNav(dir: 'push' | 'pop' | 'tab') {
  document.documentElement.dataset.nav = dir;
}

/* Going back with the app's own back buttons. The router's back is not a
   transition React can animate, so the browser is asked to: it pictures the
   screen, the route changes, and it slides the old picture away once the
   new screen has drawn. */
export function goBack(router: { back: () => void }) {
  stampNav('pop');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition || reduce) { router.back(); return; }
  // While a transition is being set up the browser holds back animation
  // frames, so this waits with timers: for the route to change, then for the
  // new screen to land in the page.
  document.startViewTransition(() => new Promise<void>(resolve => {
    const from = location.pathname + location.search;
    const main = document.querySelector('.app-main');
    const before = main?.firstElementChild;
    const started = Date.now();
    router.back();
    const wait = () => {
      const moved = location.pathname + location.search !== from;
      const drawn = moved && main?.firstElementChild !== before;
      if (drawn || Date.now() - started > 700) setTimeout(resolve, 16);
      else setTimeout(wait, 16);
    };
    setTimeout(wait, 16);
  }));
}

export default function NavMotion() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== location.origin) return;
      stampNav(navDirection(location.pathname, a.pathname));
    }
    // Back and forward from the browser or a swipe: treat as going back.
    const onPop = () => stampNav('pop');
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop, true);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('popstate', onPop, true); };
  }, []);
  return null;
}
