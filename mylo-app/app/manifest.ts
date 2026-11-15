import type { MetadataRoute } from 'next';

/* Installable from the browser: the handoff's S10 and S11 explain how. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mylo',
    short_name: 'Mylo',
    description: 'Goals with your people.',
    start_url: '/today',
    display: 'standalone',
    background_color: '#FFFFFF',
    theme_color: '#FFFFFF',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
