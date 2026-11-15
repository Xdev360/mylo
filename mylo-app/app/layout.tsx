import type { Metadata, Viewport } from 'next';
import { Figtree } from 'next/font/google';
import './globals.css';
/* The goals pieces every screen can show: the tick toast (C3), the daily
   moments Today opens (C1, C9, C10) and the voice sheet D1 opens (D2). */
import '@/styles/goals.css';
import AppShell from '@/components/AppShell';

/* Figtree at 500 and 600 only, the handoff's two weights. */
const figtree = Figtree({ subsets: ['latin'], weight: ['500', '600'], display: 'swap', variable: '--font-figtree' });

export const metadata: Metadata = {
  title: 'Mylo',
  description: 'Goals with your people.',
  appleWebApp: { capable: true, title: 'Mylo', statusBarStyle: 'default' },
  icons: { icon: [{ url: '/favicon-48.png', sizes: '48x48', type: 'image/png' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/apple-touch-icon.png' }
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FFFFFF' },
    { media: '(prefers-color-scheme: dark)', color: '#161618' }
  ]
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={figtree.variable} suppressHydrationWarning>
      <body>
        {/* A folded sidebar and a chosen theme are stamped before the first paint, so nothing jumps. */}
        <script dangerouslySetInnerHTML={{ __html: "try{var d=document.documentElement;if(localStorage.getItem('mylo.side')==='rail')d.dataset.side='rail';var t=JSON.parse(localStorage.getItem('mylo.world.theme.v1')||'null');if(t==='light'||t==='dark')d.dataset.theme=t;var p=JSON.parse(localStorage.getItem('mylo.system.prefs.v1')||'null'),L={'English (US)':'en-US','Français':'fr','Español':'es','Português':'pt','Deutsch':'de','Italiano':'it','Türkçe':'tr','Kiswahili':'sw','Yorùbá':'yo'};if(p&&L[p.language])d.lang=L[p.language]}catch(e){}" }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
