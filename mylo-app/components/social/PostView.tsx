'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ScreenHeader from '@/components/ScreenHeader';
import PostCard from './PostCard';
import { usePostSheets } from './PostSheets';
import { Avatar, SIcon, useToast } from './ui';
import { ago, isMe, uid, useMe, usePosts } from '@/lib/social';
import { useHydrated } from '@/lib/local';

/* VF5 · Post and comments: the post, its comments newest or oldest first,
   a heart and Reply on each, and the comment box held at the bottom. */
export default function PostView() {
  const { id } = useParams<{ id: string }>();
  const hydrated = useHydrated();
  const me = useMe();
  const [posts, setPosts] = usePosts();
  const post = posts.find(p => p.id === id);
  const [order, setOrder] = useState<'Newest' | 'Oldest'>('Newest');
  const [text, setText] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const [toastNode, toast] = useToast();
  const sheets = usePostSheets(toast);

  useEffect(() => {
    if (hydrated && window.location.hash === '#comment') input.current?.focus();
  }, [hydrated]);

  if (!hydrated) return <main className="screen on-desk sx-full" aria-busy="true" />;
  if (!post) return (
    <main className="screen on-desk sx-full">
      <ScreenHeader title="Post" fallback="/feed" />
      <section className="sx-gone">
        <img src="/figma/social/mylo-empty.svg" alt="" width={100} height={120} />
        <p className="t-title-s">This post is not here any more.</p>
        <Link href="/feed" className="btn-primary">Back to Vibe</Link>
      </section>
    </main>
  );

  const comments = [...post.comments].sort((a, b) => order === 'Newest' ? b.at - a.at : a.at - b.at);
  const send = (e: React.FormEvent) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setPosts(all => all.map(p => p.id !== post.id ? p : { ...p, comments: [...p.comments, { id: uid(), by: me, text: t, at: Date.now(), likes: [] }] }));
    setText('');
    setOrder('Newest');
  };
  const like = (cid: string) => setPosts(all => all.map(p => p.id !== post.id ? p : {
    ...p, comments: p.comments.map(c => c.id !== cid ? c : { ...c, likes: c.likes.includes(me.handle) ? c.likes.filter(h => h !== me.handle) : [...c.likes, me.handle] })
  }));

  return (
    <main className="screen on-desk sx-full sx-postpage">
      <ScreenHeader title="Post" fallback="/feed"
        actions={<button type="button" className="back-btn" aria-label="Post options" onClick={() => sheets.onMenu(post)}><SIcon name="more-round" size={20} /></button>} />
      <PostCard post={post} detail {...sheets} />

      <section className="sx-comments" aria-label="Comments">
        <div className="sx-comments-head">
          <h2 className="t-body sx-name">{post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}</h2>
          {post.comments.length > 1 && (
            <button type="button" className="t-body-s c-2" onClick={() => setOrder(o => o === 'Newest' ? 'Oldest' : 'Newest')}>{order}</button>
          )}
        </div>
        <ul className="sx-comment-list">
          {comments.map(c => {
            const liked = c.likes.includes(me.handle);
            return (
              <li key={c.id} className="sx-comment">
                <Avatar name={c.by.name} size={32} me={isMe(c.by, me)} />
                <div className="sx-comment-main">
                  <p className="sx-comment-top"><span className="sx-comment-name">{isMe(c.by, me) ? me.name : c.by.name}</span><span className="t-caption c-3">{ago(c.at)}</span></p>
                  <p className="sx-comment-text">{c.text}</p>
                  <button type="button" className="sx-reply" onClick={() => { setText(`@${c.by.handle} `); input.current?.focus(); }}>Reply</button>
                </div>
                <button type="button" className={`sx-comment-like${liked ? ' is-on' : ''}`} aria-pressed={liked} aria-label={`Like, ${c.likes.length}`} onClick={() => like(c.id)}>
                  <SIcon name="heart" size={20} /><span>{c.likes.length}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <form className="sx-composer" onSubmit={send}>
        <Avatar name={me.name} size={36} me />
        <label className="sx-composer-field">
          <span className="sr-only">Add a comment</span>
          <input ref={input} id="comment" value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment" maxLength={500} enterKeyHint="send" />
        </label>
        <button type="submit" className={`sx-send${text.trim() ? ' is-ready' : ''}`} aria-label="Send" disabled={!text.trim()}><SIcon name="send" /></button>
      </form>
      {sheets.node}
      {toastNode}
    </main>
  );
}
