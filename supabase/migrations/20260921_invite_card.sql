-- Mylo — an invite link that unfurls as an invitation
--
-- A link preview is fetched by a crawler with no session, and it never runs
-- a script, so whatever the app would have drawn is never drawn. The card has
-- to already exist as a picture somewhere public by the time the link is
-- pasted.
--
-- The app draws it — same canvas as the streak and win cards — uploads it to
-- the bucket it already uses, and records the URL here. api/invite.js reads it
-- back through room_preview_by_code and puts it in the meta tags.
--
-- Safe to re-run.

alter table public.rooms add column if not exists invite_card_url text;

-- Anyone in the room may refresh the card: the name or the picture changing is
-- exactly when it goes stale, and whoever noticed is whoever is looking.
create or replace function public.set_room_invite_card(p_room_id uuid, p_url text)
returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_url is not null and p_url !~ '^https://[a-z0-9.-]+/' then
    raise exception 'bad url';
  end if;
  if not exists (
    select 1 from public.room_members m
     where m.room_id = p_room_id and m.user_id = uid and m.archived_at is null
  ) then
    raise exception 'not a member of that room';
  end if;
  update public.rooms set invite_card_url = p_url where id = p_room_id;
end $$;
revoke all on function public.set_room_invite_card(uuid, text) from public;
grant execute on function public.set_room_invite_card(uuid, text) to authenticated;

-- The preview carries the card now. Return type changes, so the old one goes.
drop function if exists public.room_preview_by_code(text);
create or replace function public.room_preview_by_code(p_code text)
returns table (title text, avatar_url text, category text, member_count int, invite_card_url text)
language sql security definer set search_path = public stable as $$
  select r.title, r.avatar_url, r.category,
    (select count(*)::int from public.room_members m
      where m.room_id = r.id and m.archived_at is null) as member_count,
    r.invite_card_url
  from public.rooms r
  where upper(trim(r.code)) = upper(trim(coalesce(p_code, '')))
    and length(trim(coalesce(p_code, ''))) between 4 and 12
    and r.parent_room_id is null and r.group_room_id is null
  limit 1;
$$;
revoke all on function public.room_preview_by_code(text) from public;
grant execute on function public.room_preview_by_code(text) to anon, authenticated;
