-- ============================================================
-- Mylo — APPLY THIS ONCE in the Supabase SQL editor.
-- Dashboard → your project → SQL Editor → New query → paste → Run.
-- Contains both Sept 16 migrations. Safe to re-run.
--   1. Rooms directory  (Browse open rooms)
--   2. Waitlist referrals (share link moves you up the queue)
-- ============================================================

begin;

-- Mylo — Rooms directory ("Browse open rooms")
-- A room is invisible unless an owner/admin flips `discoverable` on. Listing a room
-- exposes ONLY: title, blurb, category, open_slots, member count and up to four
-- member character names. Never the code, never usernames, never messages.
-- Joining still goes through join_requests: an admin has to Allow every person.
-- Safe to re-run.

alter table public.rooms add column if not exists discoverable boolean not null default false;
alter table public.rooms add column if not exists blurb       text;
alter table public.rooms add column if not exists category    text;
alter table public.rooms add column if not exists open_slots  int;

alter table public.rooms drop constraint if exists rooms_blurb_len;
alter table public.rooms add constraint rooms_blurb_len check (blurb is null or length(blurb) <= 120);
alter table public.rooms drop constraint if exists rooms_open_slots_range;
alter table public.rooms add constraint rooms_open_slots_range check (open_slots is null or open_slots between 1 and 9);

create index if not exists rooms_discoverable_idx on public.rooms (created_at desc) where discoverable;

-- Owner/admin lists or unlists their room. Sub-chats and groups can never be listed.
create or replace function public.set_room_discoverable(
  p_room_id uuid, p_on boolean, p_blurb text default null, p_category text default null, p_open_slots int default null)
returns void
language plpgsql security definer set search_path = public as $$
declare v_blurb text := nullif(left(trim(coalesce(p_blurb, '')), 120), '');
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if not exists (select 1 from public.room_members rm
                 where rm.room_id = p_room_id and rm.user_id = auth.uid()
                   and rm.role in ('owner','admin') and rm.archived_at is null) then
    raise exception 'not authorized';
  end if;
  if exists (select 1 from public.rooms r where r.id = p_room_id
             and (r.parent_room_id is not null or r.group_room_id is not null)) then
    raise exception 'only a main room can be listed';
  end if;
  if p_on and (v_blurb is null or length(v_blurb) < 8) then
    raise exception 'add a short description first';
  end if;
  update public.rooms set
    discoverable = coalesce(p_on, false),
    blurb        = v_blurb,
    category     = nullif(left(coalesce(p_category, ''), 24), ''),
    open_slots   = case when p_open_slots between 1 and 9 then p_open_slots else null end
  where id = p_room_id;
end $$;
revoke all on function public.set_room_discoverable(uuid, boolean, text, text, int) from public;
grant execute on function public.set_room_discoverable(uuid, boolean, text, text, int) to authenticated;

-- The directory. Signed-in only (no anon), newest first, optional category filter.
create or replace function public.browse_rooms(p_category text default null, p_limit int default 40)
returns table (id uuid, title text, blurb text, category text, open_slots int, member_count int, faces text[])
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
      where p."character" is not null), '{}'::text[]) as faces
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

-- Request to join a listed room by id. Same rules as request_join(code): pending until
-- an owner/admin approves. Refuses rooms that are not listed, so the id alone is useless.
create or replace function public.request_join_room(p_room_id uuid)
returns public.join_requests
language plpgsql security definer set search_path = public as $$
declare v_req public.join_requests;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  if not exists (select 1 from public.rooms r where r.id = p_room_id and r.discoverable
                 and r.parent_room_id is null and r.group_room_id is null) then
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
end $$;
revoke all on function public.request_join_room(uuid) from public;
grant execute on function public.request_join_room(uuid) to authenticated;


-- Mylo — waitlist referrals ("share your link, move up the queue")
-- Adds a per-signup ref code and who referred whom. join_waitlist_v2 returns the
-- caller's code so the site can build a share link. Reads stay locked: anon can only
-- learn its OWN code back from the insert, never anyone else's row.
-- Safe to re-run. The old join_waitlist() keeps working.

alter table public.waitlist add column if not exists ref_code    text unique;
alter table public.waitlist add column if not exists referred_by text;
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by);

create or replace function public.gen_ref_code()
returns text language sql volatile as $$
  -- 7 chars from an unambiguous alphabet; no pgcrypto dependency.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 7);
$$;

create or replace function public.join_waitlist_v2(
  p_email text, p_source text default null, p_referrer text default null, p_ref text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
  v_ref   text := nullif(upper(left(regexp_replace(coalesce(p_ref, ''), '[^A-Za-z0-9]', '', 'g'), 12)), '');
  v_code  text;
  v_tries int := 0;
begin
  if v_email is null or v_email = '' then raise exception 'email required'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then raise exception 'invalid email'; end if;

  -- Already on the list: hand back the existing code so the share link is stable.
  select ref_code into v_code from public.waitlist where email = v_email;
  if v_code is not null then return v_code; end if;

  -- Fresh signup (or a legacy row with no code yet).
  loop
    v_code := public.gen_ref_code(); v_tries := v_tries + 1;
    exit when not exists (select 1 from public.waitlist where ref_code = v_code) or v_tries > 5;
  end loop;

  -- A code can't refer itself, and only real codes count.
  if v_ref is not null and not exists (select 1 from public.waitlist where ref_code = v_ref) then v_ref := null; end if;

  insert into public.waitlist (email, source, referrer, ref_code, referred_by)
    values (v_email,
            nullif(left(coalesce(p_source, ''), 64), ''),
            nullif(left(coalesce(p_referrer, ''), 255), ''),
            v_code, v_ref)
    on conflict (email) do update
      set ref_code = coalesce(public.waitlist.ref_code, excluded.ref_code)
    returning ref_code into v_code;
  return v_code;
end $$;
revoke all on function public.join_waitlist_v2(text, text, text, text) from public;
grant execute on function public.join_waitlist_v2(text, text, text, text) to anon, authenticated;

-- Admin view for the queue: earlier signup + more referrals = higher.
create or replace view public.waitlist_queue as
  select w.email, w.ref_code, w.created_at, w.source, w.invited_at,
         (select count(*) from public.waitlist r where r.referred_by = w.ref_code) as referrals
  from public.waitlist w
  order by referrals desc, w.created_at asc;
revoke all on public.waitlist_queue from public, anon, authenticated;

commit;
