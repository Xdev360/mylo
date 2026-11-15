'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import Sheet from '@/components/Sheet';
import { ActionRow, Avatar, MenuSheet, SIcon } from './ui';
import {
  copyText, firstName, isMe, postUrl, REACTIONS, reactionArt, useBlocked, useFriends, useHidden, useMe, useMuted,
  usePosts, useRooms, useSaved, useSent, type Post, type ReactionKey
} from '@/lib/social';

/* The three sheets a post opens: who reacted (VF11b), share (VF12) and the
   post menu (VF13). One set per screen, opened with the post they are for. */
export function usePostSheets(toast: (text: string, opts?: { href?: string; action?: string }) => void) {
  type S = { id: string | null; open: boolean };
  const shut: S = { id: null, open: false };
  const [react, setReact] = useState<S>(shut);
  const [share, setShare] = useState<S>(shut);
  const [menu, setMenu] = useState<S>(shut);
  const [posts] = usePosts();
  const find = (id: string | null) => posts.find(p => p.id === id) ?? null;
  // Closing keeps the post, so the sheet slides away with its content.
  const closeReact = useCallback(() => setReact(s => ({ ...s, open: false })), []);
  const closeShare = useCallback(() => setShare(s => ({ ...s, open: false })), []);
  const closeMenu = useCallback(() => setMenu(s => ({ ...s, open: false })), []);
  const node = (
    <>
      <WhoReacted post={find(react.id)} open={react.open} onClose={closeReact} />
      <ShareSheet post={find(share.id)} open={share.open} onClose={closeShare} toast={toast} />
      <PostMenu post={find(menu.id)} open={menu.open} onClose={closeMenu} toast={toast} />
    </>
  );
  return {
    node,
    onReactions: (p: Post) => setReact({ id: p.id, open: true }),
    onShare: (p: Post) => setShare({ id: p.id, open: true }),
    onMenu: (p: Post) => setMenu({ id: p.id, open: true })
  };
}

function WhoReacted({ post, open, onClose }: { post: Post | null; open: boolean; onClose: () => void }) {
  const me = useMe();
  const [friends] = useFriends();
  const [tab, setTab] = useState<ReactionKey | 'all'>('all');
  const rows = useMemo(() => Object.entries(post?.reactions ?? {}), [post]);
  const counts = REACTIONS.map(r => ({ ...r, n: rows.filter(([, k]) => k === r.key).length })).filter(r => r.n > 0);
  const shown = rows.filter(([, k]) => tab === 'all' || k === tab);
  const nameOf = (h: string) => h === me.handle ? me.name : friends.find(f => f.handle === h)?.name ?? `@${h}`;
  return (
    <Sheet open={open} onClose={() => { setTab('all'); onClose(); }} title="Reactions" labelId="sx-reactions">
      <div className="sx-chips" role="tablist" aria-label="Reactions">
        <button type="button" role="tab" aria-selected={tab === 'all'} className="sx-chip" onClick={() => setTab('all')}>All {rows.length}</button>
        {counts.map(c => (
          <button key={c.key} type="button" role="tab" aria-selected={tab === c.key} className="sx-chip" onClick={() => setTab(c.key)}>{c.label} {c.n}</button>
        ))}
      </div>
      <ul className="sx-people">
        {shown.map(([h, k]) => (
          <li key={h} className="sx-person">
            <Avatar name={nameOf(h)} size={40} me={h === me.handle} />
            <span className="sx-person-text">
              <span className="t-body sx-name">{nameOf(h)}</span>
              <span className="t-body-s c-2">{h === me.handle ? 'You' : 'Friend'}</span>
            </span>
            <span className="sx-person-react"><img src={reactionArt(k)} alt={REACTIONS.find(r => r.key === k)!.label} /></span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function ShareSheet({ post, open, onClose, toast }: { post: Post | null; open: boolean; onClose: () => void; toast: (t: string) => void }) {
  const router = useRouter();
  const [friends] = useFriends();
  const rooms = useRooms();
  const [saved, setSaved] = useSaved();
  const [sent, setSent] = useSent();
  if (!post) return <Sheet open={open} onClose={onClose} title="Share" labelId="sx-share"><span /></Sheet>;
  const isSaved = saved.includes(post.id);
  const targets = [...friends.map(f => ({ id: `f:${f.handle}`, name: f.name, room: false })), ...rooms.map(r => ({ id: `r:${r.id}`, name: r.name, room: true }))];
  const sentKey = (id: string) => `${post.id}>${id}`;
  return (
    <Sheet open={open} onClose={onClose} title="Share" labelId="sx-share">
      {targets.length > 0 && (
        <section className="sx-share-to">
          <p className="t-body-s c-2">Send to a friend</p>
          <div className="sx-share-row">
            {targets.map(t => {
              const on = sent.includes(sentKey(t.id));
              return (
                <button key={t.id} type="button" className="sx-share-who" aria-pressed={on}
                        onClick={() => setSent(s => on ? s.filter(x => x !== sentKey(t.id)) : [...s, sentKey(t.id)])}>
                  <span className="sx-share-av">
                    <Avatar name={t.name} size={52} me={t.room} />
                    {on && <span className="sx-sent"><SIcon name="check" size={12} /></span>}
                  </span>
                  <span className="t-caption sx-share-name">{t.name}</span>
                </button>
              );
            })}
          </div>
        </section>
      )}
      <div className="sx-rows">
        <ActionRow icon="chat" label="Send in chat" sub="Goes to your room chat" chevron onClick={() => { onClose(); router.push('/chats'); }} />
        <ActionRow icon="download" label="Download" sub="Story, post or status. Pick a background." chevron onClick={() => { onClose(); router.push(`/feed/${post.id}/download`); }} />
        <ActionRow icon="star" label={isSaved ? 'Saved to Saved vibes' : 'Save to Saved vibes'} sub="Only you see your saves" chevron
                   onClick={() => setSaved(s => isSaved ? s.filter(x => x !== post.id) : [...s, post.id])} />
        <ActionRow icon="link" label="Copy link" sub="Opens in Mylo for people who have it" chevron
                   onClick={async () => { const ok = await copyText(postUrl(post.id)); onClose(); toast(ok ? 'Link copied' : 'Could not copy the link'); }} />
      </div>
    </Sheet>
  );
}

function PostMenu({ post, open, onClose, toast }: { post: Post | null; open: boolean; onClose: () => void; toast: (t: string, o?: { href?: string; action?: string }) => void }) {
  const router = useRouter();
  const me = useMe();
  const [, setPosts] = usePosts();
  const [saved, setSaved] = useSaved();
  const [, setHidden] = useHidden();
  const [, setMuted] = useMuted();
  const [, setBlocked] = useBlocked();
  if (!post) return <MenuSheet open={open} onClose={onClose} label="Post options"><span /></MenuSheet>;
  const mine = isMe(post.by, me);
  const who = firstName(post.by.name);
  const isSaved = saved.includes(post.id);
  const done = (text: string) => { onClose(); toast(text); };
  return (
    <MenuSheet open={open} onClose={onClose} label="Post options">
      <ActionRow icon="star" label={isSaved ? 'Saved' : 'Save'} onClick={() => { setSaved(s => isSaved ? s.filter(x => x !== post.id) : [...s, post.id]); done(isSaved ? 'Removed from Saved vibes' : 'Saved to Saved vibes'); }} />
      <ActionRow icon="link" label="Copy link" onClick={async () => done((await copyText(postUrl(post.id))) ? 'Link copied' : 'Could not copy the link')} />
      {mine ? <>
        <ActionRow icon="download" label="Download" onClick={() => { onClose(); router.push(`/feed/${post.id}/download`); }} />
        <ActionRow icon="ban" label="Delete post" danger onClick={() => {
          setPosts(all => all.filter(p => p.id !== post.id)); onClose();
          if (window.location.pathname !== '/feed') router.replace('/feed');
        }} />
      </> : <>
        <ActionRow icon="eye" label="Not interested" onClick={() => { setHidden(h => [...h, post.id]); done('You will see less like this'); }} />
        <ActionRow icon="minus" label={`Mute ${who}`} onClick={() => { setMuted(m => [...new Set([...m, post.by.handle])]); done(`${who} is muted`); }} />
        <ActionRow icon="flag" label="Report post" danger onClick={() => { onClose(); router.push(`/feed/${post.id}/report`); }} />
        <ActionRow icon="ban" label={`Block ${who}`} danger onClick={() => { setBlocked(b => [...new Set([...b, post.by.handle])]); done(`${who} is blocked`); }} />
      </>}
    </MenuSheet>
  );
}
