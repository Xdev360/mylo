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

/* VF14, said for the tab you are on: an empty Quotes tab is not an empty feed. */
function EmptyFeed({ tab, any }: { tab: Tab; any: boolean }) {
  const quotes = tab === 'Quotes' && any;
  const friends = tab === 'Friends';
  return (
    <section className="sx-empty" aria-label="Quiet in here">
      <img className="sx-empty-mylo" src="/figma/social/mylo-empty.svg" alt="" width={125} height={150} />
      <h2 className="sx-empty-title">{quotes ? 'No quotes yet' : 'Quiet in here'}</h2>
      <p className="sx-empty-text">
        {quotes ? 'Share a line that stuck with you. It shows here as a card.'
          : friends ? 'Posts from your friends show here. Add a few to get started.'
          : 'Your friends have not posted yet. Add a few, or be the first one.'}
      </p>
      {!quotes && <Link href="/friends/add" className="btn-primary sx-empty-btn"><SIcon name="user-plus" />Find friends</Link>}
      {quotes
        ? <Link href="/feed/new?kind=quote" className="btn-primary sx-empty-btn"><SIcon name="quote" />Share a quote</Link>
        : <Link href="/feed/new" className="sx-btn-soft sx-empty-btn"><SIcon name="pencil" />Write a thought</Link>}
    </section>
  );
}

function Posting({ post, onDone, leaving }: { post: Post; onDone: () => void; leaving: boolean }) {
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
    <div className={`sx-posting${leaving ? ' is-leaving' : ''}`} role="status" aria-label={leaving ? 'Posted' : `Posting to Friends, ${p}%`}>
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
  const [bump, setBump] = useState(0);
  return (
    <div className="sx-qtile" style={{ background: post.tone === 'grey' ? 'var(--surface)' : t.bg, color: t.ink }}>
      <Link href={`/feed/${post.id}`} className="sx-qtile-link">
        <SIcon name="quote" size={22} className="sx-quote-mark" />
        <span className="sx-qtile-text">{post.text}</span>
      </Link>
      <div className="sx-qtile-foot">
        <span className="t-caption" style={{ color: t.sub }}>{post.saidBy || post.by.name}</span>
        <button type="button" className={`sx-qtile-heart${loved ? ' is-on' : ''}${bump ? ' is-bumped' : ''}`} aria-pressed={loved} aria-label="Love"
                onClick={() => { if (!loved) setBump(b => b + 1); onLove(); }}><SIcon key={bump} name="heart" /></button>
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
  /* The post that just went up drops into the top of the feed once the bar
     is done; until then it shows only as the bar. */
  const [landed, setLanded] = useState<string | null>(null);
  /* Tabs slide their content the way the highlight moves. */
  const [way, setWay] = useState<'left' | 'right' | null>(null);

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
  const shown = posting && landed !== posting.id ? list.filter(p => p.id !== posting.id) : list;

  const loveTile = (p: Post) => setPosts(all => all.map(x => {
    if (x.id !== p.id) return x;
    const r = { ...x.reactions };
    if (r[me.handle]) delete r[me.handle]; else r[me.handle] = 'love';
    return { ...x, reactions: r };
  }));
  const pick = (t: Tab) => {
    if (t === tab) return;
    setWay(TABS.indexOf(t) > TABS.indexOf(tab) ? 'right' : 'left');
    setTab(t);
    const key = Object.entries(TAB_KEY).find(([, v]) => v === t)![0];
    router.replace(key === 'foryou' ? '/feed' : `/feed?tab=${key}`, { scroll: false });
  };
  const postingDone = () => {
    const id = postingId;
    // The bar folds away as the post drops in under it; then the address settles.
    setLanded(id);
    setTimeout(() => router.replace('/feed', { scroll: false }), 420);
    setTimeout(() => setLanded(l => (l === id ? null : l)), 1000);
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

      <div className="sx-tabs is-slide" role="tablist" aria-label="Feed" style={{ '--i': TABS.indexOf(tab), '--n': TABS.length } as React.CSSProperties}>
        {TABS.map(t => <button key={t} type="button" role="tab" aria-selected={t === tab} className="sx-tab" onClick={() => pick(t)}>{t}</button>)}
      </div>

      {!hydrated ? null : <>
        {posting && <Posting post={posting} onDone={postingDone} leaving={landed === posting.id} />}

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

        {tab === 'Quotes' && shown.length > 0 ? (
          <div key={tab} className={`sx-qgrid${way ? ` is-from-${way}` : ''}`}>
            {shown.map(p => <QuoteTile key={p.id} post={p} loved={!!p.reactions[me.handle]} onLove={() => loveTile(p)} />)}
          </div>
        ) : shown.length > 0 ? (
          <div key={tab} className={`sx-list${way ? ` is-from-${way}` : ''}`}>
            {shown.map(p => (
              <div key={p.id} className={`sx-slot${p.id === landed ? ' is-landing' : ''}`}>
                <div className="sx-slot-in"><PostCard post={p} {...sheets} /></div>
              </div>
            ))}
          </div>
        ) : q ? (
          <p className="t-body c-2 sx-none">Nothing matches &ldquo;{q}&rdquo;.</p>
        ) : tab !== 'Thoughts' && !posting ? <EmptyFeed tab={tab} any={visible.length > 0} /> : null}
      </>}

      {sheets.node}
      {toastNode}
    </main>
  );
}
