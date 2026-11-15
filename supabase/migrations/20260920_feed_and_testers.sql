-- Mylo — public stories, listing a room as you create it, testers
--
-- Three things the last round left half-built, plus the one the badge was
-- supposed to buy.
--
-- Safe to re-run.

-- ── Public stories, across every room ─────────────────────────────────────
-- A story lives in `messages`, which you can only read for rooms you are in.
-- That is the right rule and it stays: this reads past it for exactly the
-- rows that asked to be public, and returns only what a card needs — no
-- caption-less internals, no room code, nothing about who else is in there.
--
-- 24 hours, same as a story anywhere else. Rooms that are not discoverable
-- are excluded even if someone marked a story public inside one, because the
-- room itself is the thing that opted in to being seen.
create or replace function public.public_stories(p_limit int default 40)
returns table (
  id uuid, room_id uuid, room_title text, room_avatar text, room_category text,
  by_id uuid, by_username text, by_character text,
  url text, w int, h int, caption text, created_at timestamptz)
language sql security definer set search_path = public stable as $$
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
     and r.parent_room_id is null and r.group_room_id is null
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
$$;
revoke all on function public.public_stories(int) from public;
grant execute on function public.public_stories(int) to authenticated;

-- ── Listing a room at the moment you make it ──────────────────────────────
-- create_room took a title and nothing else, so a room could only be listed
-- by going back into settings afterwards — which nobody does. Same function,
-- three optional arguments; the old one-argument call still works.
-- The one-argument version has to go, or PostgREST has two candidates for the
-- same call and picks by argument name alone.
drop function if exists public.create_room(text);
create or replace function public.create_room(
  p_title text default 'Room',
  p_public boolean default false,
  p_blurb text default null,
  p_category text default null)
returns public.rooms
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  space_row public.rooms;
  group_row public.rooms;
  new_code text;
  t text := left(trim(coalesce(p_title, 'Room')), 40);
  b text := nullif(left(trim(coalesce(p_blurb, '')), 120), '');
  gate json;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if not exists (select 1 from public.profiles where id = uid) then
    raise exception 'profile missing';
  end if;
  if t = '' then t := 'Room'; end if;
  -- A room cannot be listed with nothing to read: a card with no line under
  -- the name is the kind of listing nobody requests to join.
  if p_public and b is null then
    raise exception 'add one line on what the room is for before listing it';
  end if;

  gate := public.can_create_room();
  if coalesce((gate->>'ok')::boolean, false) is not true then
    raise exception 'room_limit: upgrade your plan to create more rooms';
  end if;

  loop
    new_code := public.gen_room_code();
    begin
      insert into public.rooms (code, created_by, kind, title, discoverable, blurb, category)
      values (new_code, uid, 'space', t, coalesce(p_public, false), b, nullif(trim(coalesce(p_category,'')), ''))
      returning * into space_row;
      exit;
    exception when unique_violation then null;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, role)
  values (space_row.id, uid, 'owner');

  loop
    new_code := public.gen_room_code();
    begin
      insert into public.rooms (code, created_by, kind, title, parent_room_id)
      values (new_code, uid, 'group', t, space_row.id)
      returning * into group_row;
      exit;
    exception when unique_violation then null;
    end;
  end loop;

  insert into public.room_members (room_id, user_id, role)
  values (group_row.id, uid, 'owner');

  return space_row;
end $$;
revoke all on function public.create_room(text, boolean, text, text) from public;
grant execute on function public.create_room(text, boolean, text, text) to authenticated;

-- ── What a tester badge actually buys ─────────────────────────────────────
-- The badge was cosmetic. A tester is someone let in early to break things,
-- so they get the paid feature set and a pot of AI credits — capped, because
-- an unmetered pot is how a tester round turns into a bill.
--
-- This deliberately does NOT change `plan`: the badge is the reason, and
-- taking the badge off has to take the perks with it. my_billing_state is the
-- one place the client asks what it may do, so that is where it is answered.
create or replace function public.tester_credit_grant()
returns int language sql immutable as $$ select 2000 $$;

create or replace function public.admin_set_badge(p_username text, p_badge text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user text := lower(trim(regexp_replace(coalesce(p_username,''), '^@', '')));
  v_id   uuid;
  v_was  text;
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  if p_badge is not null and p_badge not in ('founder','tester') then
    raise exception 'badge must be founder, tester, or none';
  end if;
  select id, badge into v_id, v_was from public.profiles where lower(username) = v_user;
  if v_id is null then raise exception 'no such user'; end if;
  update public.profiles set badge = p_badge where id = v_id;
  -- Becoming a tester tops the credits up to the allowance, once. Losing the
  -- badge does not claw back what they already spent testing for you.
  if p_badge = 'tester' and v_was is distinct from 'tester' then
    update public.profiles
       set credits = greatest(coalesce(credits, 0), public.tester_credit_grant())
     where id = v_id;
  end if;
end $$;
revoke all on function public.admin_set_badge(text, text) from public;
grant execute on function public.admin_set_badge(text, text) to authenticated;
