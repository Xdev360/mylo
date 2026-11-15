'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

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
/* 'none' is a change inside the same screen (another day, another tab of a
   segmented control): the page holds still and only what changed moves. */
export function stampNav(dir: 'push' | 'pop' | 'tab' | 'none') {
  document.documentElement.dataset.nav = dir;
}

/* How deep into the app this tab is: every entry the app pushes carries its
   index in history.state, replacing keeps it, and going back restores the
   older entry's own index. A screen opened straight from a link or another
   site sits at 0, so its back button goes to a sensible screen instead of
   leaving the app. */
const IDX = '__myloIdx';
let patched = false;
function patchHistory() {
  if (patched || typeof window === 'undefined') return;
  patched = true;
  const idx = () => (history.state && typeof history.state[IDX] === 'number' ? history.state[IDX] as number : 0);
  const push = history.pushState.bind(history), replace = history.replaceState.bind(history);
  history.pushState = (state, unused, url) => push({ ...(state ?? {}), [IDX]: idx() + 1 }, unused, url);
  history.replaceState = (state, unused, url) => replace({ ...(state ?? {}), [IDX]: idx() }, unused, url);
}
patchHistory();
export function canGoBack() {
  return typeof window !== 'undefined' && !!history.state && (history.state[IDX] ?? 0) > 0;
}
/* Back if there is somewhere in the app to go back to, otherwise to `fallback`. */
export function backOr(router: { back: () => void; replace: (href: string) => void }, fallback: string) {
  if (canGoBack()) goBack(router);
  else { stampNav('pop'); router.replace(fallback); }
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
  const path = usePathname();
  // React drops the incoming page out of a transition it starts whenever it
  // thinks the root wasn't touched (it sets html's view-transition-name to
  // none, but only when nothing is set inline). Naming the root inline keeps
  // the new page in, so a pushed screen slides in rather than appearing
  // under the old one as it leaves.
  useEffect(() => { document.documentElement.style.viewTransitionName = 'root'; }, []);
  // Once a move has played, the next one starts from a quiet crossfade, so a
  // navigation nobody stamped never replays the last one's direction.
  useEffect(() => {
    const t = setTimeout(() => stampNav('tab'), 450);
    return () => clearTimeout(t);
  }, [path]);
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
      if (!a || a.target === '_blank' || a.origin !== location.origin) return;
      stampNav(a.pathname === location.pathname ? 'none' : navDirection(location.pathname, a.pathname));
    }
    // Back and forward from the browser or a swipe: treat as going back.
    const onPop = () => stampNav('pop');
    document.addEventListener('click', onClick, true);
    window.addEventListener('popstate', onPop, true);
    return () => { document.removeEventListener('click', onClick, true); window.removeEventListener('popstate', onPop, true); };
  }, []);
  return null;
}
