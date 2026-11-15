/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The site is static apart from one API route, so images are plain <img>
  // with assets committed under /public, no loader, no remote patterns.
  images: { unoptimized: true },
  // Launch day is one env change: LAUNCHED=true, then redeploy. Inlined so
  // the sidebar and the hero, which render on the client too, agree.
  env: { LAUNCHED: process.env.LAUNCHED === 'true' ? 'true' : 'false' },
  // The stylesheet is about 16 KB: inlined, the first paint does not wait
  // for a second request.
  experimental: { inlineCss: true },
  // The previous site had a Community page; its links land on the home page.
  async redirects() {
    return [{ source: '/community', destination: '/', permanent: false }];
  }
};
export default nextConfig;
