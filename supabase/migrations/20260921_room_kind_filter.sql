-- Mylo — a room's own row is not the one this filter was finding
--
-- Seven functions identified "a real room, not a group thread or a DM" as
--
--     parent_room_id is null and group_room_id is null
--
-- The first half is right. The second is not: when a room is created, the
-- space is linked to the group chat it owns by setting the SPACE's
-- group_room_id to the group's id. So every genuine room fails the test, and
-- these seven functions have been returning nothing for every room that
-- exists:
--
--   admin_grant_myl       "join or create a room first" — so Add to my balance
--                         never worked
--   admin_award_myl       "you share no room with that person" — so crediting
--                         anyone from the CRM never worked
--   room_preview_by_code  empty, so an invite link unfurled as the generic
--                         Mylo card instead of the room
--   peek_room_by_code     a pasted code found nothing
--   request_join_room     asking to join refused
--   browse_rooms          the rooms feed came back empty
--   public_stories        the story rail came back empty
--
-- kind is constrained to space, group or dm, so the room itself is exactly
-- kind = 'space' and there is nothing to infer.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.admin_award_myl(p_username text, p_amount integer, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me   uuid := auth.uid();
  v_them uuid;
  v_room uuid;
  v_ref  text;
  v_note text := coalesce(nullif(trim(p_note), ''), 'From the Mylo team');
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 20000 then
    raise exception 'amount must be between 1 and 20,000';
  end if;

  select id into v_them from public.profiles
   where lower(username) = lower(trim(regexp_replace(coalesce(p_username,''), '^@', '')));
  if v_them is null then raise exception 'no such user'; end if;
  if v_them = v_me then raise exception 'use Grant for your own balance'; end if;

  select a.room_id into v_room
    from public.room_members a
    join public.room_members b on b.room_id = a.room_id and b.user_id = v_them and b.archived_at is null
    join public.rooms r on r.id = a.room_id
   where a.user_id = v_me and a.archived_at is null
     and r.kind = 'space'
   order by a.joined_at limit 1;
  if v_room is null then
    raise exception 'you share no room with that person — they cannot see a payment made somewhere they are not';
  end if;

  v_ref := 'award:' || to_char(now(), 'YYYYMMDDHH24MISS');
  insert into public.messages (room_id, from_id, kind, body, payload)
  values (v_room, v_me, 'text', 'Admin grant',
    jsonb_build_object('msg_kind','myl','mtype','grant','amount',p_amount,
      'reason', v_note, 'ref', v_ref || ':mint'));
  -- a second later, so the replay sees the balance before it is spent
  insert into public.messages (room_id, from_id, kind, body, payload, created_at)
  values (v_room, v_me, 'text', v_note,
    jsonb_build_object('msg_kind','myl','mtype','send','to', v_them, 'amount', p_amount,
      'note', v_note, 'ref', v_ref || ':send'), now() + interval '1 second');
  return jsonb_build_object('ok', true, 'amount', p_amount, 'to', p_username, 'ref', v_ref);
end $function$
;

CREATE OR REPLACE FUNCTION public.admin_grant_myl(p_amount integer, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_me   uuid := auth.uid();
  v_room uuid;
  v_ref  text;
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 20000 then
    raise exception 'amount must be between 1 and 20,000';
  end if;

  select rm.room_id into v_room
    from public.room_members rm
    join public.rooms r on r.id = rm.room_id
   where rm.user_id = v_me and rm.archived_at is null
     and r.kind = 'space'
   order by rm.joined_at limit 1;
  if v_room is null then raise exception 'join or create a room first — the ledger lives in one'; end if;

  v_ref := 'grant:' || to_char(now(), 'YYYYMMDDHH24MISS');
  insert into public.messages (room_id, from_id, kind, body, payload)
  values (v_room, v_me, 'text', coalesce(nullif(trim(p_reason), ''), 'Admin grant'),
    jsonb_build_object('msg_kind','myl','mtype','grant','amount',p_amount,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Admin grant'), 'ref', v_ref));
  return jsonb_build_object('ok', true, 'amount', p_amount, 'ref', v_ref);
end $function$
;

CREATE OR REPLACE FUNCTION public.browse_rooms(p_category text DEFAULT NULL::text, p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, title text, blurb text, category text, open_slots integer, member_count integer, faces text[], avatar_url text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    and r.kind = 'space'
    and auth.uid() is not null
    and (p_category is null or r.category = p_category)
  order by r.created_at desc
  limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.peek_room_by_code(p_code text)
 RETURNS TABLE(id uuid, title text, avatar_url text, category text, member_count integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.id, r.title, r.avatar_url, r.category,
    (select count(*)::int from public.room_members m
      where m.room_id = r.id and m.archived_at is null) as member_count
  from public.rooms r
  where auth.uid() is not null
    and upper(trim(r.code)) = upper(trim(coalesce(p_code, '')))
    and r.kind = 'space'
  limit 1;
$function$
;

CREATE OR REPLACE FUNCTION public.public_stories(p_limit integer DEFAULT 40)
 RETURNS TABLE(id uuid, room_id uuid, room_title text, room_avatar text, room_category text, by_id uuid, by_username text, by_character text, url text, w integer, h integer, caption text, created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select m.id, r.id as room_id, r.title as room_title, r.avatar_url as room_avatar, r.category as room_category,
         p.id as by_id, p.username as by_username, p."character" as by_character,
         m.payload->>'url' as url,
         nullif(m.payload->>'w','')::int as w,
         nullif(m.payload->>'h','')::int as h,
         coalesce(m.payload->>'caption','') as caption,
         m.created_at
    from public.messages m
    join public.rooms r on r.id = m.room_id
    join public.profiles p on p.id = m.from_id
   where auth.uid() is not null
     and m.payload->>'msg_kind' = 'story'
     and m.payload->>'mtype' = 'post'
     and m.payload->>'scope' = 'public'
     and r.discoverable
     and r.kind = 'space'
     and m.created_at > now() - interval '24 hours'
     -- a story someone deleted leaves a tombstone; honour it
     and not exists (
       select 1 from public.messages d
        where d.room_id = m.room_id
          and d.payload->>'msg_kind' = 'story'
          and d.payload->>'mtype' = 'del'
          and d.payload->>'ref' = m.id::text)
   order by m.created_at desc
   limit least(greatest(coalesce(p_limit, 40), 1), 100);
$function$
;

CREATE OR REPLACE FUNCTION public.request_join_room(p_room_id uuid)
 RETURNS join_requests
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_req public.join_requests;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.discoverable
                 and r.kind = 'space') then
    raise exception 'room not open';
  end if;
  if exists (select 1 from public.room_members where room_id = p_room_id and user_id = auth.uid() and archived_at is null) then
    raise exception 'already a member';
  end if;
  if (select count(*) from public.join_requests jr
      where jr.user_id = auth.uid() and jr.created_at > now() - interval '15 minutes') >= 8 then
    raise exception 'too many requests, try again later';
  end if;
  insert into public.join_requests (room_id, user_id, status)
    values (p_room_id, auth.uid(), 'pending')
    on conflict (room_id, user_id)
      do update set status = 'pending', decided_at = null, created_at = now()
    returning * into v_req;
  return v_req;
end $function$
;

CREATE OR REPLACE FUNCTION public.room_preview_by_code(p_code text)
 RETURNS TABLE(title text, avatar_url text, category text, member_count integer, invite_card_url text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select r.title, r.avatar_url, r.category,
    (select count(*)::int from public.room_members m
      where m.room_id = r.id and m.archived_at is null) as member_count,
    r.invite_card_url
  from public.rooms r
  where upper(trim(r.code)) = upper(trim(coalesce(p_code, '')))
    and length(trim(coalesce(p_code, ''))) between 4 and 12
    and r.kind = 'space'
  limit 1;
$function$
;
