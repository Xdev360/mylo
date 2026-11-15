-- Mylo — a Vibe post you chose to share outside the room
--
-- A Vibe post is room-only, and that is the point of it. Pasting its link
-- somewhere else makes it readable by anyone holding the link, which is a new
-- exposure and therefore a decision — so only the person who wrote it can make
-- that decision, and nothing is public until they do.
--
-- A crawler fetching a link preview has no session and runs no script, so the
-- post has to already exist somewhere anonymous by the time it is pasted. That
-- is all this table is: the words, who wrote them, and the card the app drew.
--
-- Safe to re-run.

create table if not exists public.shared_posts (
  post_id     uuid primary key,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  author_name text not null default 'Mylo',
  author_user text not null default '',
  body        text not null default '',
  card_url    text,
  created_at  timestamptz not null default now()
);

alter table public.shared_posts enable row level security;
revoke all on table public.shared_posts from anon, authenticated;

-- Only the author, and only their own post. p_post_id is the id of the message
-- row the post lives in; the check that they wrote it is done against that row.
create or replace function public.share_vibe_post(p_post_id uuid, p_card_url text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  m   public.messages;
  prof public.profiles;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  select * into m from public.messages where id = p_post_id;
  if m.id is null then raise exception 'no such post'; end if;
  if m.from_id <> uid then raise exception 'only the person who wrote it can share it'; end if;
  if coalesce(m.payload->>'msg_kind', '') <> 'vibe' or coalesce(m.payload->>'mtype', '') <> 'post' then
    raise exception 'that is not a post';
  end if;
  if p_card_url is not null and p_card_url !~ '^https://[a-z0-9.-]+/' then
    raise exception 'bad url';
  end if;

  select * into prof from public.profiles where id = uid;
  insert into public.shared_posts (post_id, author_id, author_name, author_user, body, card_url)
  values (p_post_id, uid,
          coalesce(nullif(prof.display_name, ''), prof.username, 'Mylo'),
          coalesce(prof.username, ''),
          left(coalesce(m.payload->>'text', m.body, ''), 600),
          p_card_url)
  on conflict (post_id) do update
    set body = excluded.body, card_url = excluded.card_url,
        author_name = excluded.author_name, author_user = excluded.author_user;
end $$;
revoke all on function public.share_vibe_post(uuid, text) from public;
grant execute on function public.share_vibe_post(uuid, text) to authenticated;

-- What the link preview reads. Only rows that were deliberately shared exist
-- here at all, so there is nothing to filter.
create or replace function public.shared_post_preview(p_post_id uuid)
returns table (body text, author_name text, author_user text, card_url text)
language sql security definer set search_path = public stable as $$
  select s.body, s.author_name, s.author_user, s.card_url
    from public.shared_posts s
   where s.post_id = p_post_id
   limit 1;
$$;
revoke all on function public.shared_post_preview(uuid) from public;
grant execute on function public.shared_post_preview(uuid) to anon, authenticated;

-- Taking it back down again.
create or replace function public.unshare_vibe_post(p_post_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from public.shared_posts where post_id = p_post_id and author_id = auth.uid();
end $$;
revoke all on function public.unshare_vibe_post(uuid) from public;
grant execute on function public.unshare_vibe_post(uuid) to authenticated;
