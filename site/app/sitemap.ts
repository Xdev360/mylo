import type { MetadataRoute } from 'next';

const BASE = 'https://www.staymylo.com';
const ROUTES = ['/', '/how-it-works', '/rewards', '/playground', '/questions', '/roadmap', '/safety', '/privacy', '/terms', '/help', '/report-a-bug'];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map(path => ({
    url: `${BASE}${path === '/' ? '' : path}`,
    changeFrequency: 'weekly',
    priority: path === '/' ? 1 : 0.7
  }));
}
