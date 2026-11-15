'use client';

import { useEffect, useState, useSyncExternalStore, ViewTransition } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import FigIcon from './FigIcon';
import ThemeSwitch from './ThemeSwitch';
import WaitlistCount from './WaitlistCount';
import { NAV, GET_IN, ALREADY_IN, LAUNCHED, SITE } from '@/lib/content';
import { currentSide, setSide, type Side } from '@/lib/side';

/* ──────────────────────────────────────────────────────────────────────────
   The shell, from Figma: "Sidebar" (887:5340), the mobile "Top bar"
   (887:189904) and the open menu (893:113059, "Menu sheet" 893:117878).

   Desktop, 1280 and up: a 300-wide sidebar on the page ground and the white
   sheet beside it, 16 from the top, right and bottom, radius 28, with the
   frame's own soft shadow and no border.

   Below 1280: a 68-high top bar with the app icon, the wordmark and a white
   round menu button. The menu opens as a white sheet dropped from the top,
   8 from each edge, over the page dimmed to 35%.

   The nav goes to pages. The current page is the active item: a white pill
   with the two-layer shadow and an arrow in the sidebar, a grey pill in the
   menu.

   Light and Dark sit at the foot of the sidebar, above "Already in", and
   above the button in the menu: always one step away, never in the way.

   The sidebar folds to its icons, for the wider view. No frame draws this:
   the icons never move, the labels go and the sheet takes the room, and the
   round button on the seam brings it all back. The choice is remembered. A
   folded item keeps its label for screen readers and shows it on hover.
   ────────────────────────────────────────────────────────────────────────── */

function AppIcon({ size }: { size: number }) {
  return <img src="/brand/mylo-logo-192.webp" alt="" width={size} height={size} className="shrink-0" />;
}

function isCurrent(path: string, href: string) {
  return href === '/' ? path === '/' : path === href || path.startsWith(href + '/');
}

function subscribeSide(cb: () => void) {
  window.addEventListener('mylo-side', cb);
  return () => window.removeEventListener('mylo-side', cb);
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname() ?? '/';
  const side = useSyncExternalStore<Side>(subscribeSide, currentSide, () => 'open');
  const folded = side === 'rail';
  // One label at a time beside a folded icon. It lives outside the sidebar,
  // which scrolls on a short window and would clip it.
  const [tip, setTip] = useState<{ label: string; top: number } | null>(null);
  const showTip = (e: React.SyntheticEvent) => {
    const el = (e.target as Element).closest<HTMLElement>('[data-tip]');
    if (!el || !folded) { setTip(null); return; }
    const r = el.getBoundingClientRect();
    setTip({ label: el.dataset.tip!, top: r.top + r.height / 2 });
  };

  // The menu belongs to the page it was opened on: follow a link, by click
  // or by the back button, and it is closed on arrival.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const setOpen = (v: boolean) => setOpenOn(v ? path : null);

  // The page behind the menu holds still, and Escape closes it.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenOn(null); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', onKey); };
  }, [open]);

  const join = LAUNCHED ? { ...GET_IN.join, label: 'Open Mylo', href: SITE.appUrl } : GET_IN.join;

  return (
    <div className="min-h-dvh">
      <a href="#main" className="shell-skip">Skip to content</a>
      {/* Marks the route change, so the page crossfades and the current-page
          pill slides on every navigation, even between pages with no pill. */}
      <ViewTransition key={path}><span className="shell-tick" aria-hidden /></ViewTransition>

      {/* ── Sidebar · 1280 and up ─────────────────────────────────────── */}
      <aside className="shell-side" aria-label="Site" onMouseOver={showTip} onFocus={showTip}
             onMouseLeave={() => setTip(null)} onBlur={() => setTip(null)}>
        <Link href="/" className="shell-brand" data-tip="Mylo" aria-label="Mylo">
          <AppIcon size={40} />
          <span className="shell-word">Mylo</span>
        </Link>
        <span className="shell-divider" aria-hidden />

        <nav className="shell-nav" aria-label="Pages">
          {NAV.map(item => {
            const on = isCurrent(path, item.href);
            const link = (
              <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined}
                    data-tip={item.label} className={`shell-item${on ? ' is-on' : ''}`}>
                <FigIcon name={item.icon} />
                <span className="shell-label">{item.label}</span>
                {on && <FigIcon name="nav-arrow" className="shell-item-arrow" />}
              </Link>
            );
            return on ? <ViewTransition key={item.href} name="shell-pill">{link}</ViewTransition> : link;
          })}
        </nav>

        <p className="shell-eyebrow">{GET_IN.label}</p>
        <div className="shell-nav shell-nav-get">
          {[join, GET_IN.message].map(item => (
            <a key={item.label} href={item.href} data-tip={item.label} className="shell-item shell-item-ink"
               data-cta={item === join ? 'sidebar-join' : undefined}>
              <FigIcon name={item.icon} />
              <span className="shell-label">{item.label}</span>
            </a>
          ))}
        </div>

        <ThemeSwitch className="theme-switch-side" />

        {!LAUNCHED && (
          <div className="shell-already">
            <WaitlistCount />
            <p className="shell-made">{ALREADY_IN.madeBy}</p>
          </div>
        )}
      </aside>

      {/* The fold, on the seam between the sidebar and the sheet. */}
      <button type="button" className="shell-fold" onClick={() => { setTip(null); setSide(folded ? 'open' : 'rail'); }}
              aria-label={folded ? 'Open sidebar' : 'Fold sidebar'} aria-expanded={!folded}>
        <FigIcon name="nav-arrow" />
      </button>
      {tip && <span className="shell-tip" style={{ top: tip.top }} aria-hidden>{tip.label}</span>}

      {/* ── Top bar · below 1280 ──────────────────────────────────────── */}
      <header className="shell-top">
        <Link href="/" className="shell-brand shell-brand-sm">
          <AppIcon size={32} />
          <span className="shell-word">Mylo</span>
        </Link>
        <button type="button" className="shell-menu-btn" onClick={() => setOpen(true)}
                aria-label="Open menu" aria-expanded={open} aria-controls="shell-menu">
          <FigIcon name="menu" />
        </button>
      </header>

      {/* ── The open menu ─────────────────────────────────────────────── */}
      <div className={`shell-dim${open ? ' is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden />
      <div id="shell-menu" role="dialog" aria-modal="true" aria-label="Menu"
           className={`shell-menu${open ? ' is-open' : ''}`} inert={!open}>
        <div className="shell-menu-head">
          <Link href="/" className="shell-brand shell-brand-sm">
            <AppIcon size={32} />
            <span className="shell-word">Mylo</span>
          </Link>
          <button type="button" className="shell-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <FigIcon name="close-20" />
          </button>
        </div>
        <nav className="shell-menu-nav" aria-label="Pages">
          {NAV.map((item, i) => {
            const on = isCurrent(path, item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={on ? 'page' : undefined}
                    className={`shell-menu-item${on ? ' is-on' : ''}`}
                    style={{ '--i': i } as React.CSSProperties}
                    onClick={() => setOpen(false)}>
                <FigIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <ThemeSwitch className="theme-switch-menu" />
        <a href={join.href} className="shell-menu-join" data-cta="menu-join" onClick={() => setOpen(false)}>
          <FigIcon name="sparkle" />{join.label}
        </a>
      </div>

      {/* ── The sheet everything sits on ──────────────────────────────── */}
      <main id="main" tabIndex={-1} className="shell-sheet">{children}</main>
    </div>
  );
}
