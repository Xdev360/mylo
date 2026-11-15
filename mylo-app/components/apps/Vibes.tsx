'use client';

import Link from 'next/link';
import { useState } from 'react';
import Icon from '@/components/Icon';
import Sheet from '@/components/Sheet';
import { useHydrated } from '@/lib/local';
import { usePosts, useSaved } from '@/lib/social';
import { VIBE_STYLES, useVibes, type VibeStyle } from '@/lib/apps';
import { Head, useToast } from './ui';

/* V6 · Saved vibes (528:102752). The quotes you saved from the vibe feed,
   and any saved with saveVibe(), each on one of the six drawn patterns. Tap
   one to share it, open its post, or let it go. */
const BG: Record<VibeStyle, string> = { dots: '#F3EFE7', sunburst: '#FFE9D6', halftone: '#ECE7F7', waves: '#E8F4FF', stars: '#1F2550', blobs: '#E6F6EC' };
type Card = { id: string; text: string; style: VibeStyle; post?: string };

export default function Vibes() {
  const ready = useHydrated();
  const [own, setOwn] = useVibes();
  const [posts] = usePosts();
  const [saved, setSaved] = useSaved();
  const [open, setOpen] = useState<Card | null>(null);
  const [toast, showToast] = useToast();
  if (!ready) return <main className="screen on-desk" aria-busy="true" />;

  const fromFeed: Card[] = posts.filter(p => saved.includes(p.id) && p.kind === 'quote' && p.text)
    .map((p, i) => ({ id: p.id, text: p.text, style: VIBE_STYLES[i % VIBE_STYLES.length], post: p.id }));
  const cards: Card[] = [...fromFeed, ...own.map(v => ({ id: v.id, text: v.text, style: v.style }))];

  const share = async (c: Card) => {
    try {
      if (navigator.share) await navigator.share({ text: c.text });
      else { await navigator.clipboard.writeText(c.text); showToast('Copied'); }
    } catch { /* closed */ }
  };
  const remove = (c: Card) => {
    if (c.post) setSaved(s => s.filter(x => x !== c.post));
    else setOwn(o => o.filter(x => x.id !== c.id));
    setOpen(null);
  };

  return (
    <main className="screen on-desk ax-vibes">
      <Head title="Saved" fallback="/apps" />
      <div className="ax-vibe-grid">
        {cards.map(c => (
          <button key={c.id} type="button" className={`ax-vibe is-${c.style}`} style={{ background: BG[c.style] }} onClick={() => setOpen(c)}>
            <img src={`/figma/apps/vibe-${c.style}.svg`} alt="" className="ax-vibe-pattern" />
            <span className="ax-vibe-text">{c.text}</span>
          </button>
        ))}
      </div>
      <Sheet open={!!open} onClose={() => setOpen(null)} title="Saved">
        {open && <>
          <div className={`ax-vibe is-big is-${open.style}`} style={{ background: BG[open.style] }}>
            <img src={`/figma/apps/vibe-${open.style}.svg`} alt="" className="ax-vibe-pattern" />
            <span className="ax-vibe-text">{open.text}</span>
          </div>
          <button type="button" className="ax-btn" onClick={() => share(open)}><Icon name="apps/i-share" size={22} />Share</button>
          {open.post && <Link href={`/feed/${open.post}`} className="ax-btn ax-btn-soft">Open post</Link>}
          <button type="button" className="ax-btn ax-btn-soft" onClick={() => remove(open)}>Remove from saved</button>
        </>}
      </Sheet>
      {toast}
    </main>
  );
}
