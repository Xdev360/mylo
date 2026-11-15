-- Mylo — what an invite link shows before you tap it
--
-- api/invite.js answers /i/CODE for link previews, and a link preview is
-- fetched by a crawler with no session at all. So this one function is
-- callable anonymously. It gives back exactly what a card shows — the name,
-- the picture, how many are in, the category — for a room whose code you
-- already hold. Nothing here lists rooms, and the code space is 36^10.
--
-- Safe to re-run.
create or replace function public.room_preview_by_code(p_code text)
returns table (title text, avatar_url text, category text, member_count int)
language sql security definer set search_path = public stable as $$
  select r.title, r.avatar_url, r.category,
    (select count(*)::int from public.room_members m
      where m.room_id = r.id and m.archived_at is null) as member_count
  from public.rooms r
  where upper(trim(r.code)) = upper(trim(coalesce(p_code, '')))
    and length(trim(coalesce(p_code, ''))) between 4 and 12
    and r.parent_room_id is null and r.group_room_id is null
  limit 1;
$$;
revoke all on function public.room_preview_by_code(text) from public;
grant execute on function public.room_preview_by_code(text) to anon, authenticated;
