'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import PostCard from './PostCard';
import { usePostSheets } from './PostSheets';
import { Avatar, SIcon, useToast } from './ui';
import {
  K, refreshShared, ROOMS_KEY, toneOf, useBlocked, useFriends, useHidden, useMe, useMuted, usePosts, type Post
} from '@/lib/social';
import { useHydrated } from '@/lib/local';

/* Vibe, the feed: For you (VF1), Thoughts (VF2), Quotes (VF3), Friends (VF4),
   empty (VF14), posting and posted (VF10a/b) and pull to refresh (VF17). */
const TABS = ['For you', 'Thoughts', 'Quotes', 'Friends'] as const;
type Tab = typeof TABS[number];
const TAB_KEY: Record<string, Tab> = { foryou: 'For you', thoughts: 'Thoughts', quotes: 'Quotes', friends: 'Friends' };

function EmptyFeed() {
  return (
    <section className="sx-empty" aria-label="Quiet in here">
      <img className="sx-empty-mylo" src="/figma/social/mylo-empty.svg" alt="" width={125} height={150} />
      <h2 className="sx-empty-title">Quiet in here</h2>
      <p className="sx-empty-text">Your friends have not posted yet. Add a few, or be the first one.</p>
      <Link href="/friends/add" className="btn-primary sx-empty-btn"><SIcon name="user-plus" />Find friends</Link>
      <Link href="/feed/new" className="sx-btn-soft sx-empty-btn"><SIcon name="pencil" />Write a thought</Link>
    </section>
  );
}

function Posting({ post, onDone }: { post: Post; onDone: () => void }) {
  const [p, setP] = useState(8);
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => {
    const steps = [[60, 38], [420, 65], [900, 88], [1250, 100]] as const;
    const ts = steps.map(([t, v]) => setTimeout(() => setP(v), t));
    const end = setTimeout(() => done.current(), 1500);
    return () => { ts.forEach(clearTimeout); clearTimeout(end); };
  }, [post.id]);
  const thumb = post.photos?.[0];
  return (
    <div className="sx-posting" role="status" aria-label={`Posting to Friends, ${p}%`}>
      <span className="sx-posting-thumb" style={!thumb ? { background: post.kind === 'quote' ? toneOf(post.tone).bg : 'var(--surface-2)' } : undefined}>
        {thumb ? <img src={thumb} alt="" /> : <SIcon name={post.kind === 'quote' ? 'quote' : 'pencil'} size={20} />}
      </span>
      <span className="sx-posting-main">
        <span className="t-body-s sx-name">Posting to Friends</span>
        <span className="sx-posting-bar"><span style={{ width: `${p}%` }} /></span>
      </span>
      <span className="t-caption c-2 sx-posting-n">{p}%</span>
    </div>
  );
}

function QuoteTile({ post, onLove, loved }: { post: Post; onLove: () => void; loved: boolean }) {
  const t = toneOf(post.tone);
  return (
    <div className="sx-qtile" style={{ background: post.tone === 'grey' ? 'var(--surface)' : t.bg, color: t.ink }}>
      <Link href={`/feed/${post.id}`} className="sx-qtile-link">
        <SIcon name="quote" size={22} className="sx-quote-mark" />
        <span className="sx-qtile-text">{post.text}</span>
      </Link>
      <div className="sx-qtile-foot">
        <span className="t-caption" style={{ color: t.sub }}>{post.saidBy || post.by.name}</span>
        <button type="button" className={`sx-qtile-heart${loved ? ' is-on' : ''}`} aria-pressed={loved} aria-label="Love" onClick={onLove}><SIcon name="heart" /></button>
      </div>
    </div>
  );
}

export default function FeedView() {
  const router = useRouter();
  const params = useSearchParams();
  const hydrated = useHydrated();
  const me = useMe();
  const [posts, setPosts] = usePosts();
  const [friends] = useFriends();
  const [hidden] = useHidden();
  const [muted] = useMuted();
  const [blocked] = useBlocked();
  const [tab, setTab] = useState<Tab>(TAB_KEY[params.get('tab') ?? ''] ?? 'For you');
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [toastNode, toast] = useToast();
  const sheets = usePostSheets(toast);
  const postingId = params.get('posting');
  const posting = posts.find(p => p.id === postingId) ?? null;

  /* Pull to refresh (VF17). */
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const start = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { start.current = window.scrollY <= 0 ? e.touches[0].clientY : null; };
  const onTouchMove = (e: React.TouchEvent) => {
    if (start.current === null || refreshing) return;
    const dy = e.touches[0].clientY - start.current;
    setPull(dy > 0 ? Math.min(130, dy * 0.5) : 0);
  };
  const onTouchEnd = () => {
    if (start.current === null) return;
    start.current = null;
    if (pull >= 80) {
      setRefreshing(true); setPull(130);
      setTimeout(() => { refreshShared(...Object.values(K), ROOMS_KEY); setRefreshing(false); setPull(0); }, 800);
    } else setPull(0);
  };

  const visible = useMemo(() => posts
    .filter(p => !hidden.includes(p.id) && !muted.includes(p.by.handle) && !blocked.includes(p.by.handle))
    .filter(p => !q || `${p.text} ${p.saidBy ?? ''} ${p.by.name}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => b.at - a.at), [posts, hidden, muted, blocked, q]);
  const friendHandles = new Set(friends.map(f => f.handle));
  const list = tab === 'Thoughts' ? visible.filter(p => p.kind === 'thought')
    : tab === 'Quotes' ? visible.filter(p => p.kind === 'quote')
    : tab === 'Friends' ? visible.filter(p => friendHandles.has(p.by.handle))
    : visible;

  const loveTile = (p: Post) => setPosts(all => all.map(x => {
    if (x.id !== p.id) return x;
    const r = { ...x.reactions };
    if (r[me.handle]) delete r[me.handle]; else r[me.handle] = 'love';
    return { ...x, reactions: r };
  }));
  const pick = (t: Tab) => {
    setTab(t);
    const key = Object.entries(TAB_KEY).find(([, v]) => v === t)![0];
    router.replace(key === 'foryou' ? '/feed' : `/feed?tab=${key}`, { scroll: false });
  };
  const postingDone = () => {
    const id = postingId;
    router.replace('/feed', { scroll: false });
    toast('Posted to Friends', { href: `/feed/${id}`, action: 'View' });
  };

  return (
    <main className="screen on-desk sx-feed" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <header className="sx-feed-head">
        <h1 className="sx-feed-title">Vibe</h1>
        <button type="button" className="sx-round" aria-label="Search" aria-expanded={searching}
                onClick={() => { setSearching(s => !s); if (searching) setQ(''); }}><SIcon name="search" /></button>
        <Link href="/feed/new" className="sx-round is-dark" aria-label="New post"><SIcon name="plus" /></Link>
      </header>

      {(pull > 0 || refreshing) && (
        <div className={`sx-pull${refreshing ? ' is-busy' : ''}`} style={{ height: pull }} aria-live="polite">
          <img src="/figma/social/mylo-refresh.svg" alt="" width={67} height={80} style={{ opacity: Math.min(1, pull / 80) }} />
          {pull >= 80 && <span className="t-body-s sx-pull-text">Release to refresh</span>}
        </div>
      )}

      {searching && (
        <label className="sx-search">
          <SIcon name="search" size={20} />
          <span className="sr-only">Search posts</span>
          <input autoFocus type="search" placeholder="Search posts" value={q} onChange={e => setQ(e.target.value)} />
        </label>
      )}

      <div className="sx-tabs" role="tablist" aria-label="Feed">
        {TABS.map(t => <button key={t} type="button" role="tab" aria-selected={t === tab} className="sx-tab" onClick={() => pick(t)}>{t}</button>)}
      </div>

      {!hydrated ? null : <>
        {posting && <Posting post={posting} onDone={postingDone} />}

        {tab === 'Thoughts' && (
          <div className="sx-prompt">
            <Avatar name={me.name} size={32} me />
            <Link href="/feed/new" className="sx-prompt-text">What is on your mind?</Link>
            <Link href="/feed/new?kind=photo" className="sx-prompt-photo" aria-label="New photo post"><SIcon name="photo" size={24} /></Link>
          </div>
        )}

        {tab === 'Friends' && friends.length > 0 && (
          <div className="sx-friends-row" aria-label="Your friends">
            {friends.map(f => (
              <Link key={f.handle} href={`/u/${f.handle}`} className="sx-friend-dot">
                <Avatar name={f.name} size={52} className={f.loved ? 'has-ring' : ''} />
                <span className="t-caption c-2">{f.name}</span>
              </Link>
            ))}
          </div>
        )}

        {tab === 'Quotes' && list.length > 0 ? (
          <div className="sx-qgrid">
            {list.map(p => <QuoteTile key={p.id} post={p} loved={!!p.reactions[me.handle]} onLove={() => loveTile(p)} />)}
          </div>
        ) : list.length > 0 ? (
          <div className="sx-list">
            {list.map(p => <PostCard key={p.id} post={p} {...sheets} />)}
          </div>
        ) : q ? (
          <p className="t-body c-2 sx-none">Nothing matches &ldquo;{q}&rdquo;.</p>
        ) : tab !== 'Thoughts' && !posting ? <EmptyFeed /> : null}
      </>}

      {sheets.node}
      {toastNode}
    </main>
  );
}
