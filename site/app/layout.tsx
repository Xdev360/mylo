import type { Metadata, Viewport } from 'next';
import { Caveat, Figtree } from 'next/font/google';
import './globals.css';
import { Analytics } from '@vercel/analytics/next';
import Shell from '@/components/Shell';
import SiteEffects from '@/components/SiteEffects';
import { THEME_BOOT } from '@/lib/theme';
import { REVEAL_BOOT } from '@/lib/reveal-boot';
import { SITE, HERO } from '@/lib/content';

/* Figtree at 500 and 600 only, the handoff allows no 400 and nothing
   heavier than 600, so the other weights are simply not downloaded. */
const figtree = Figtree({
  subsets: ['latin'],
  weight: ['500', '600'],
  display: 'swap',
  variable: '--font-figtree'
});

/* Caveat is the one exception to the two-weight rule: the polaroid captions
   on the pinboard are handwritten in the design, and nothing in Figtree
   stands in for that. Bold only, and nothing else on the site uses it. */
const caveat = Caveat({
  subsets: ['latin'],
  weight: ['700'],
  display: 'swap',
  variable: '--font-caveat'
});

export const metadata: Metadata = {
  // Needed so og:image and twitter:image resolve to absolute URLs.
  metadataBase: new URL('https://www.staymylo.com'),
  // Pages name themselves "Page · Mylo"; the home page keeps the full title.
  title: { default: SITE.title, template: '%s' },
  description: HERO.lead,
  alternates: { canonical: '/' },
  openGraph: {
    title: SITE.title,
    description: HERO.lead,
    url: 'https://www.staymylo.com',
    siteName: 'Mylo',
    images: [{ url: '/figma/share.png', width: 1200, height: 630, alt: 'Mylo · Goals with your people' }],
    type: 'website'
  },
  twitter: { card: 'summary_large_image', title: SITE.title, description: HERO.lead, images: ['/figma/share.png'] },
  icons: {
    icon: [{ url: '/favicon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: '/apple-touch-icon.png'
  }
};

// The page ground differs per scheme, so the browser chrome has to follow it.
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F5F5F7' },
    { media: '(prefers-color-scheme: dark)', color: '#0B0B0D' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script stamps data-theme on <html> before React arrives.
    <html lang="en" className={`${figtree.variable} ${caveat.variable}`} data-scroll-behavior="smooth" suppressHydrationWarning>
      <body style={{ fontFamily: 'var(--font-figtree), system-ui, sans-serif' }}>
        {/* Before anything paints: the stored scheme and the hero drawing. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <Shell>{children}</Shell>
        {/* Runs as soon as the page is parsed: see Reveal. */}
        <script dangerouslySetInnerHTML={{ __html: REVEAL_BOOT }} />
        <SiteEffects />
        {/* The analytics script is served by Vercel itself, so it only
            loads there; locally it would be a 404 on every page. */}
        {process.env.VERCEL && <Analytics />}
      </body>
    </html>
  );
}
