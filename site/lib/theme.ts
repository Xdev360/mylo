/* Light or dark. Nothing stored means "follow the system"; picking one in
   the switch stores it and stamps data-theme on <html>, which the tokens in
   globals.css read. */
import { SIDE_KEY } from './side';

export type Theme = 'light' | 'dark';
export const THEME_KEY = 'mylo.theme';
export const PAGE_GROUND: Record<Theme, string> = { light: '#F5F5F7', dark: '#0B0B0D' };

/* The hero's four drawings, by width and scheme. */
export const HERO_ART = {
  phone: { light: '/figma/hero-phone.svg', dark: '/figma/hero-phone-dark.svg' },
  wide: { light: '/figma/hero-wide.svg', dark: '/figma/hero-wide-dark.svg' }
} as const;

/* Runs before the first paint, from the top of <body>: stamps a stored
   choice so the page never flashes the other scheme, and a folded sidebar so
   the sheet never jumps, points the browser chrome at the right ground, and
   asks for the one hero drawing this visitor will see before the stylesheet
   has even arrived. */
export const THEME_BOOT = `(function(){try{var d=document.documentElement,t=localStorage.getItem('${THEME_KEY}');if(localStorage.getItem('${SIDE_KEY}')==='rail')d.dataset.side='rail';if(t==='light'||t==='dark'){d.dataset.theme=t;document.querySelectorAll('meta[name=theme-color]').forEach(function(m){m.content=t==='dark'?'${PAGE_GROUND.dark}':'${PAGE_GROUND.light}'})}var dark=t?t==='dark':matchMedia('(prefers-color-scheme: dark)').matches,a=${JSON.stringify(HERO_ART)},w=innerWidth<768?a.phone:a.wide;if(location.pathname==='/'){var l=document.createElement('link');l.rel='preload';l.as='image';l.href=dark?w.dark:w.light;l.setAttribute('fetchpriority','high');document.head.appendChild(l)}}catch(e){}})()`;

export function storedTheme(): Theme | null {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : null;
  } catch { return null; }
}

export function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(t: Theme) {
  try { localStorage.setItem(THEME_KEY, t); } catch { /* storage blocked: it still applies for this visit */ }
  const apply = () => {
    document.documentElement.dataset.theme = t;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => { m.content = PAGE_GROUND[t]; });
    window.dispatchEvent(new Event('mylo-theme'));
  };
  // The whole page crossfades to the other scheme rather than cutting to it.
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(apply);
  else apply();
}
