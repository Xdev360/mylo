import type { MetadataRoute } from 'next';

/* The App icon from Figma at 192 and 512. Colours are the light page and
   the brand black. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mylo',
    short_name: 'Mylo',
    description: 'Goals with your people.',
    start_url: '/',
    display: 'browser',
    background_color: '#F5F5F7',
    theme_color: '#111114',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
    ]
  };
}
