import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';

export const metadata: Metadata = { title: 'Page not found · Mylo' };

/* Figma "Web · 404" (1108:201), phone 1108:465. One centred column, 20
   apart: Mylo on a round backdrop, the code, the line, two buttons. */
export default function NotFound() {
  return (
    <>
      <div className="nf">
        <div className="nf-mylo">
          <img src="/figma/mylo-404.svg" alt="Mylo" width={167} height={200} />
        </div>
        <p className="nf-code">404</p>
        <h1 className="nf-title">This page wandered off.</h1>
        <p className="nf-lead">The link might be old, or the page moved. Everything else is right where you left it.</p>
        <div className="nf-ctas">
          <Link href="/" className="nf-btn nf-btn-ink">Back to home</Link>
          <Link href="/help" className="nf-btn nf-btn-line">Help centre</Link>
        </div>
      </div>
      <Footer />
    </>
  );
}
