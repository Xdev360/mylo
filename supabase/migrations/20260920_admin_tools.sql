-- Mylo — the tools an admin actually needs before testers arrive
--
-- Three jobs, all of them things the app promises and cannot currently do:
-- mint $MYL, pay it to somebody, and mark who a person is.
--
-- Why these are functions rather than direct writes: messages_payload_guard()
-- refuses a `myl/grant` row unless auth.uid() belongs to an admin, which is
-- correct — minting is gated on a signed-in admin, not on whoever holds
-- database access. That also means nobody can mint from the SQL editor, where
-- there is no session at all. So the path has to be an authenticated admin
-- calling a function, and these are it.
--
-- Safe to re-run.

-- ── Who someone is ────────────────────────────────────────────────────────
-- founder (orange) is the person who built it; tester (yellow) is someone let
-- in early with paid features unlocked. Both are separate from `plan`, which
-- is what you bought, and from is_admin, which is what you can do.
alter table public.profiles add column if not exists badge text;
alter table public.profiles drop constraint if exists profiles_badge_check;
alter table public.profiles add constraint profiles_badge_check
  check (badge is null or badge in ('founder', 'tester'));

-- Badges are set by an admin, never by the person wearing one, so `badge` is
-- deliberately NOT in the authenticated update grant.

create or replace function public.admin_set_badge(p_username text, p_badge text)
returns void
language plpgsql security definer set search_path = public as $$
declare v_user text := lower(trim(regexp_replace(coalesce(p_username,''), '^@', '')));
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  if p_badge is not null and p_badge not in ('founder','tester') then
    raise exception 'badge must be founder, tester, or none';
  end if;
  update public.profiles set badge = p_badge where lower(username) = v_user;
  if not found then raise exception 'no such user'; end if;
end $$;
revoke all on function public.admin_set_badge(text, text) from public;
grant execute on function public.admin_set_badge(text, text) to authenticated;

-- ── Minting ───────────────────────────────────────────────────────────────
-- A grant credits whoever wrote it, so this writes as the admin. The trigger
-- still runs and still checks auth.uid(): this function does not get around
-- the rule, it just gives the rule somewhere legitimate to be satisfied.
create or replace function public.admin_grant_myl(p_amount int, p_reason text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
     and r.parent_room_id is null and r.group_room_id is null
   order by rm.joined_at limit 1;
  if v_room is null then raise exception 'join or create a room first — the ledger lives in one'; end if;

  v_ref := 'grant:' || to_char(now(), 'YYYYMMDDHH24MISS');
  insert into public.messages (room_id, from_id, kind, body, payload)
  values (v_room, v_me, 'text', coalesce(nullif(trim(p_reason), ''), 'Admin grant'),
    jsonb_build_object('msg_kind','myl','mtype','grant','amount',p_amount,
      'reason', coalesce(nullif(trim(p_reason), ''), 'Admin grant'), 'ref', v_ref));
  return jsonb_build_object('ok', true, 'amount', p_amount, 'ref', v_ref);
end $$;
revoke all on function public.admin_grant_myl(int, text) from public;
grant execute on function public.admin_grant_myl(int, text) to authenticated;

-- ── Paying somebody ───────────────────────────────────────────────────────
-- Two rows, not one: mint to the admin, then send admin -> person. That is
-- how the replay already models a transfer, so the recipient's balance moves
-- and both halves show up in the history with a reason attached. A single
-- grant written as the recipient would be ignored by the replay, which only
-- honours a grant from an admin account.
--
-- The rows go in a room they are both in, because a wallet only reads the
-- rooms you belong to — money written somewhere you cannot see is money you
-- do not have.
create or replace function public.admin_award_myl(p_username text, p_amount int, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
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
     and r.parent_room_id is null and r.group_room_id is null
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
end $$;
revoke all on function public.admin_award_myl(text, int, text) from public;
grant execute on function public.admin_award_myl(text, int, text) to authenticated;

-- ── Reading the queues from the CRM ───────────────────────────────────────
-- bug_reports and feature_requests deny everything at the table, so the only
-- way an admin sees them is through a function that checks who is asking.
create or replace function public.admin_list_bugs(p_status text default null, p_limit int default 100)
returns setof public.bug_queue
language sql security definer set search_path = public stable as $$
  select * from public.bug_queue
   where public.is_app_admin()
     and (p_status is null or p_status = 'all' or status = p_status)
   limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;
revoke all on function public.admin_list_bugs(text, int) from public;
grant execute on function public.admin_list_bugs(text, int) to authenticated;

create or replace function public.admin_list_features(p_status text default null, p_limit int default 100)
returns setof public.feature_queue
language sql security definer set search_path = public stable as $$
  select * from public.feature_queue
   where public.is_app_admin()
     and (p_status is null or p_status = 'all' or status = p_status)
   limit least(greatest(coalesce(p_limit, 100), 1), 500);
$$;
revoke all on function public.admin_list_features(text, int) from public;
grant execute on function public.admin_list_features(text, int) to authenticated;

create or replace function public.admin_set_bug_status(p_ref text, p_status text, p_award int default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  update public.bug_reports
     set status = p_status,
         award = coalesce(p_award, award),
         awarded_at = case when p_award is not null then now() else awarded_at end
   where ref = upper(trim(p_ref));
  if not found then raise exception 'no such report'; end if;
end $$;
revoke all on function public.admin_set_bug_status(text, text, int) from public;
grant execute on function public.admin_set_bug_status(text, text, int) to authenticated;

create or replace function public.admin_set_feature_status(p_ref text, p_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  perform public.set_feature_status(p_ref, p_status, p_note);
end $$;
revoke all on function public.admin_set_feature_status(text, text, text) from public;
grant execute on function public.admin_set_feature_status(text, text, text) to authenticated;

-- ── The users list needs to carry the badge ───────────────────────────────
-- Return type changes, so the old signature goes first.
drop function if exists public.admin_list_users(text, int, int);
create or replace function public.admin_list_users(p_query text default null, p_limit int default 50, p_offset int default 0)
returns table (
  id uuid, username text, char_name text, plan text, credits int, is_admin boolean,
  badge text, disabled_at timestamptz, banned_at timestamptz, created_at timestamptz,
  rooms_count bigint, goals_count bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_app_admin() then raise exception 'not authorized'; end if;
  return query
  select p.id, p.username, p."character" as char_name, p.plan, p.credits, p.is_admin,
         p.badge, p.disabled_at, p.banned_at, p.created_at,
         (select count(*) from public.room_members rm where rm.user_id = p.id),
         (select count(*) from public.goals g where g.owner_id = p.id)
    from public.profiles p
   where p_query is null or p_query = '' or p.username ilike '%' || p_query || '%'
   order by p.created_at desc
   limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(0, coalesce(p_offset, 0));
end $$;
revoke all on function public.admin_list_users(text, int, int) from public;
grant execute on function public.admin_list_users(text, int, int) to authenticated;
