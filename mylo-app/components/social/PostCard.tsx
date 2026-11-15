'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Avatar, SIcon } from './ui';
import {
  ago, CROPS, FILTERS, firstName, isMe, KIND_LABEL, REACTIONS, reactionArt, toneOf, usePosts, useMe,
  type Post, type ReactionKey
} from '@/lib/social';

/* A post in the feed (VF1 to VF4) and at the top of its page (VF5): who, when
   and what kind, then the thought, the quote card or the photos, then heart,
   comments, repost and share. A tap on the heart is Love; holding it lifts the
   post and opens the reaction bar (VF11): slide to a Mylo and let go. */
const QUOTE_SIZE = { Small: 17, Medium: 20, Large: 22 } as const;

export function QuoteCard({ post, big = false }: { post: Pick<Post, 'text' | 'saidBy' | 'tone' | 'size'>; big?: boolean }) {
  const t = toneOf(post.tone);
  const fs = big ? { Small: 20, Medium: 24, Large: 28 }[post.size ?? 'Large'] : QUOTE_SIZE[post.size ?? 'Large'];
  return (
    <div className={`sx-quote${big ? ' is-big' : ''}`} style={{ background: t.bg, color: t.ink }}>
      <SIcon name="quote" size={big ? 36 : 28} className="sx-quote-mark" />
      <p className="sx-quote-text" style={{ fontSize: fs, lineHeight: 1.25 }}>{post.text}</p>
      {post.saidBy && <p className="sx-quote-by" style={{ color: t.sub }}>{post.saidBy}</p>}
    </div>
  );
}

export function Photos({ post }: { post: Post }) {
  const [at, setAt] = useState(0);
  const photos = post.photos ?? [];
  const ratio = CROPS[post.crop ?? 'Original'] ?? 321 / 220;
  return (
    <div className="sx-photos" style={{ aspectRatio: String(ratio) }}>
      <div className="sx-photos-track" onScroll={e => { const el = e.currentTarget; setAt(Math.round(el.scrollLeft / el.clientWidth)); }}>
        {photos.map((src, i) => (
          <img key={i} src={src} alt={post.text ? `${post.text}, photo ${i + 1}` : `Photo ${i + 1}`} style={{ filter: FILTERS[post.filter ?? 'Normal'] }} />
        ))}
      </div>
      {photos.length > 1 && <span className="sx-count">{at + 1}/{photos.length}</span>}
      {post.sticker && <img className="sx-photo-sticker" src={reactionArt(post.sticker)} alt="" />}
    </div>
  );
}

export default function PostCard({ post, detail = false, onReactions, onShare, onMenu }: {
  post: Post; detail?: boolean;
  onReactions: (p: Post) => void; onShare: (p: Post) => void; onMenu: (p: Post) => void;
}) {
  const router = useRouter();
  const me = useMe();
  const [, setPosts] = usePosts();
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<ReactionKey | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  // Counts reactions given here, so the heart pops for a tap and not on every load.
  const [bump, setBump] = useState(0);

  const mine = post.reactions[me.handle];
  const count = Object.keys(post.reactions).length;
  const reposted = post.reposts.includes(me.handle);

  const react = (k: ReactionKey | null) => { if (k) setBump(b => b + 1); setPosts(all => all.map(p => {
    if (p.id !== post.id) return p;
    const r = { ...p.reactions };
    if (k) r[me.handle] = k; else delete r[me.handle];
    return { ...p, reactions: r };
  })); };
  const repost = () => setPosts(all => all.map(p => p.id !== post.id ? p : {
    ...p, reposts: p.reposts.includes(me.handle) ? p.reposts.filter(h => h !== me.handle) : [...p.reposts, me.handle]
  }));

  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [picking]);

  const under = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest('[data-reaction]') as HTMLElement | null;
    return (el?.dataset.reaction as ReactionKey | undefined) ?? null;
  };
  const down = (e: React.PointerEvent) => {
    held.current = false;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    timer.current = setTimeout(() => { held.current = true; setPicking(true); navigator.vibrate?.(8); }, 380);
  };
  const move = (e: React.PointerEvent) => { if (held.current) setHover(under(e.clientX, e.clientY)); };
  const up = (e: React.PointerEvent) => {
    if (timer.current) clearTimeout(timer.current);
    if (held.current) {
      const k = under(e.clientX, e.clientY);
      if (k) { react(k); setPicking(false); }
      setHover(null);
    }
  };
  const tapHeart = () => { if (held.current) { held.current = false; return; } react(mine ? null : 'love'); };

  const open = () => { if (!detail) router.push(`/feed/${post.id}`); };
  const meta = [ago(post.at), KIND_LABEL[post.kind], detail ? post.audience : null].filter(Boolean).join(' · ');
  const name = isMe(post.by, me) ? me.name : post.by.name;

  return (
    <div className={`sx-post-wrap${picking ? ' is-picking' : ''}`}>
      {picking && <button type="button" className="sx-dim" aria-label="Close reactions" onClick={() => setPicking(false)} />}
      <article className="sx-post" aria-label={`${name}, ${KIND_LABEL[post.kind]}`}>
        <header className="sx-post-head">
          <Avatar name={name} me={isMe(post.by, me)} />
          <div className="sx-post-who">
            <span className="t-body sx-name">{name}</span>
            <span className="t-caption c-2">{meta}</span>
          </div>
          <button type="button" className="sx-more" aria-label="Post options" onClick={() => onMenu(post)}><SIcon name="more" size={24} /></button>
        </header>

        <div className={`sx-post-body${detail ? '' : ' is-link'}`} onClick={open} role={detail ? undefined : 'link'}
             tabIndex={detail ? undefined : 0} onKeyDown={e => { if (e.key === 'Enter') open(); }}>
          {post.kind === 'thought' && <p className="sx-thought">{post.text}</p>}
          {post.kind === 'thought' && post.sticker && <img className="sx-thought-sticker" src={reactionArt(post.sticker)} alt="" />}
          {post.kind === 'quote' && <QuoteCard post={post} />}
          {post.kind === 'photo' && <>
            <Photos post={post} />
            {post.text && <p className="t-body sx-caption">{post.text}</p>}
          </>}
        </div>

        <footer className="sx-actions">
          <span className="sx-act">
            <button type="button" className={`sx-act-btn sx-heart${mine ? ' is-on' : ''}${bump ? ' is-bumped' : ''}`}
                    aria-label={mine ? `Remove your reaction` : 'Love. Hold for more reactions'} aria-pressed={!!mine}
                    onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { if (timer.current) clearTimeout(timer.current); }}
                    onClick={tapHeart} onContextMenu={e => { e.preventDefault(); setPicking(true); }}>
              <SIcon key={bump} name="heart" />
            </button>
            <button type="button" className="sx-act-n" onClick={() => onReactions(post)} aria-label={`${count} reactions, see who`}>{count}</button>
          </span>
          <Link href={`/feed/${post.id}#comment`} className="sx-act" aria-label={`${post.comments.length} comments`}>
            <span className="sx-act-btn"><SIcon name="chat" /></span><span className="sx-act-n">{post.comments.length}</span>
          </Link>
          <button type="button" className={`sx-act${reposted ? ' is-reposted' : ''}`} onClick={repost} aria-pressed={reposted} aria-label={`Repost, ${post.reposts.length}`}>
            <span className="sx-act-btn"><SIcon name="repeat" /></span><span className="sx-act-n">{post.reposts.length}</span>
          </button>
          <span className="spacer" />
          <button type="button" className="sx-act-btn" aria-label="Share" onClick={() => onShare(post)}><SIcon name="share" /></button>
        </footer>
      </article>

      {picking && (
        <div className="sx-react-pop">
          <div className="sx-react-bar" role="menu" aria-label={`React to ${firstName(name)}’s post`}>
            {REACTIONS.map(r => (
              <button key={r.key} type="button" role="menuitem" data-reaction={r.key} aria-label={r.label}
                      className={`sx-react${hover === r.key ? ' is-hover' : ''}${mine === r.key ? ' is-mine' : ''}`}
                      onClick={() => { react(r.key); setPicking(false); }}>
                <img src={r.art} alt="" draggable={false} />
              </button>
            ))}
          </div>
          <p className="sx-react-hint">Hold and slide to pick. Let go to react.</p>
        </div>
      )}
    </div>
  );
}
