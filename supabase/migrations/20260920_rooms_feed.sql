-- Mylo — the rooms feed
--
-- The screen you land on with no room open is becoming a feed rather than a
-- list: rooms you are in, rooms that asked to be found, and what happened to
-- the requests you sent. Two small additions to the directory from
-- 20260916_room_directory.sql make that possible.
--
-- Safe to re-run.

-- ── browse_rooms now carries the room's picture ───────────────────────────
-- A feed card without a cover is a list row. The return type changes, so the
-- old signature is dropped first.
drop function if exists public.browse_rooms(text, int);
create or replace function public.browse_rooms(p_category text default null, p_limit int default 40)
returns table (
  id uuid, title text, blurb text, category text, open_slots int,
  member_count int, faces text[], avatar_url text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
  select r.id, r.title, r.blurb, r.category, r.open_slots,
    (select count(*)::int from public.room_members m
      where m.room_id = r.id and m.archived_at is null) as member_count,
    coalesce((
      select array_agg(p."character" order by m.joined_at)
      from (select m2.user_id, m2.joined_at from public.room_members m2
            where m2.room_id = r.id and m2.archived_at is null
            order by m2.joined_at limit 4) m
      join public.profiles p on p.id = m.user_id
      where p."character" is not null), '{}'::text[]) as faces,
    r.avatar_url,
    r.created_at
  from public.rooms r
  where r.discoverable
    and r.parent_room_id is null and r.group_room_id is null
    and auth.uid() is not null
    and (p_category is null or r.category = p_category)
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$$;
revoke all on function public.browse_rooms(text, int) from public;
grant execute on function public.browse_rooms(text, int) to authenticated;

-- ── The requests I have sent, and what became of them ─────────────────────
-- join_requests already lets you read your own rows, but the room's title and
-- picture live in a table you cannot read until you are in. This returns just
-- the public face of each room next to your request's status.
create or replace function public.my_join_requests()
returns table (
  id uuid, room_id uuid, title text, avatar_url text, category text,
  status text, created_at timestamptz, decided_at timestamptz)
language sql security definer set search_path = public stable as $$
  select j.id, j.room_id, r.title, r.avatar_url, r.category,
         j.status, j.created_at, j.decided_at
    from public.join_requests j
    join public.rooms r on r.id = j.room_id
   where j.user_id = auth.uid()
   order by coalesce(j.decided_at, j.created_at) desc
   limit 50;
$$;
revoke all on function public.my_join_requests() from public;
grant execute on function public.my_join_requests() to authenticated;

-- ── Look a room up by its code before asking to join ──────────────────────
-- The old flow was paste-a-code-and-hope. This shows the room's name and
-- picture first, so a mistyped code is caught by a person, not by a bounce.
-- Nothing private comes back: only what a member would see on the feed card.
create or replace function public.peek_room_by_code(p_code text)
returns table (id uuid, title text, avatar_url text, category text, member_count int)
language sql security definer set search_path = public stable as $$
  select r.id, r.title, r.avatar_url, r.category,
    (select count(*)::int from public.room_members m
      where m.room_id = r.id and m.archived_at is null) as member_count
  from public.rooms r
  where auth.uid() is not null
    and upper(trim(r.code)) = upper(trim(coalesce(p_code, '')))
    and r.parent_room_id is null and r.group_room_id is null
  limit 1;
$$;
revoke all on function public.peek_room_by_code(text) from public;
grant execute on function public.peek_room_by_code(text) to authenticated;
