-- Mylo security harden (apply in Supabase SQL Editor if CLI/MCP unavailable)
-- 1) Join-requests table (if missing)
-- 2) Longer invite codes
-- 3) Rate limits on join / request / regenerate
-- 4) join_room no longer grants instant membership (approval required)
-- 5) regenerate_room_code for owners/admins
-- 6) Tighten EXECUTE grants on privileged RPCs

-- ---------- join_requests table (was never applied on some projects) ----------
create table if not exists public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (room_id, user_id)
);

alter table public.join_requests enable row level security;

drop policy if exists jr_select_own on public.join_requests;
create policy jr_select_own on public.join_requests
  for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists jr_select_admin on public.join_requests;
create policy jr_select_admin on public.join_requests
  for select to authenticated
  using (exists (
    select 1 from public.room_members rm
    where rm.room_id = join_requests.room_id
      and rm.user_id = auth.uid()
      and rm.role in ('owner','admin')
  ));

-- No direct insert/update from clients — RPCs only.

create or replace function public.list_join_requests(p_room_id uuid)
returns table (id uuid, user_id uuid, username text, avatar_url text, "character" text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = auth.uid()
      and rm.role in ('owner','admin')
  ) then
    raise exception 'not authorized';
  end if;
  return query
    select jr.id, jr.user_id, p.username, p.avatar_url, p."character", jr.created_at
    from public.join_requests jr
    join public.profiles p on p.id = jr.user_id
    where jr.room_id = p_room_id and jr.status = 'pending'
    order by jr.created_at asc;
end;
$$;

-- ---------- rate limit store (no direct client access) ----------
create table if not exists public.security_rate_events (
  id bigserial primary key,
  bucket text not null,
  subject text not null,
  created_at timestamptz not null default now()
);

create index if not exists security_rate_events_lookup
  on public.security_rate_events (bucket, subject, created_at desc);

alter table public.security_rate_events enable row level security;

revoke all on table public.security_rate_events from anon, authenticated, public;
grant all on table public.security_rate_events to postgres, service_role;
grant usage, select on sequence public.security_rate_events_id_seq to postgres, service_role;

create or replace function public._rate_limit_check(
  p_bucket text,
  p_subject text,
  p_max int,
  p_window_seconds int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  -- opportunistic cleanup
  delete from public.security_rate_events
  where created_at < now() - interval '48 hours';

  select count(*)::int into v_count
  from public.security_rate_events
  where bucket = p_bucket
    and subject = p_subject
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max then
    raise exception 'rate limit exceeded — try again later';
  end if;

  insert into public.security_rate_events (bucket, subject)
  values (p_bucket, p_subject);
end;
$$;

revoke all on function public._rate_limit_check(text, text, int, int) from public;
revoke all on function public._rate_limit_check(text, text, int, int) from anon, authenticated;

-- ---------- stronger invite codes (10 chars ≈ 32^10) ----------
create or replace function public.gen_room_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  new_code text := '';
  i int;
begin
  for i in 1..10 loop
    new_code := new_code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return new_code;
end;
$$;

-- ---------- request to join (pending) + rate limit ----------
create or replace function public.request_join(p_code text)
returns public.join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room uuid;
  v_kind text;
  v_parent uuid;
  v_req public.join_requests;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'auth required'; end if;

  perform public._rate_limit_check('request_join:' || uid::text, uid::text, 8, 900);

  select id, kind, parent_room_id
    into v_room, v_kind, v_parent
  from public.rooms
  where upper(code) = upper(trim(p_code))
  limit 1;

  if v_room is null then raise exception 'room not found'; end if;

  -- Group invite → request access to parent space
  if v_kind = 'group' and v_parent is not null then
    v_room := v_parent;
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = v_room and user_id = uid and archived_at is null
  ) then
    raise exception 'already a member';
  end if;

  insert into public.join_requests (room_id, user_id, status)
  values (v_room, uid, 'pending')
  on conflict (room_id, user_id)
    do update set status = 'pending', decided_at = null, created_at = now()
  returning * into v_req;

  return v_req;
end;
$$;

-- ---------- join_room: NO instant membership ----------
-- Already-members can re-enter (unarchive). Everyone else must request + get approved.
create or replace function public.join_room(p_code text)
returns public.rooms
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.rooms;
  space_row public.rooms;
begin
  if uid is null then raise exception 'not authenticated'; end if;

  perform public._rate_limit_check('join_room:' || uid::text, uid::text, 8, 900);

  select * into r from public.rooms where upper(code) = upper(trim(p_code));
  if r.id is null then raise exception 'room not found'; end if;

  if r.kind = 'group' and r.parent_room_id is not null then
    select * into space_row from public.rooms where id = r.parent_room_id;
    if space_row.id is null then raise exception 'room not found'; end if;
    r := space_row;
  end if;

  if exists (
    select 1 from public.room_members
    where room_id = r.id and user_id = uid
  ) then
    update public.room_members
      set archived_at = null
    where room_id = r.id and user_id = uid;

    if r.kind = 'space' and r.group_room_id is not null then
      insert into public.room_members (room_id, user_id, role)
      values (r.group_room_id, uid, 'member')
      on conflict (room_id, user_id) do update set archived_at = null;
    end if;

    return r;
  end if;

  -- Create / refresh pending request instead of inserting membership
  insert into public.join_requests (room_id, user_id, status)
  values (r.id, uid, 'pending')
  on conflict (room_id, user_id)
    do update set status = 'pending', decided_at = null, created_at = now();

  raise exception 'join request sent — wait for an admin to approve';
end;
$$;

-- ---------- approve / decline with rate limits ----------
create or replace function public.approve_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.join_requests;
  r public.rooms;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public._rate_limit_check('approve_join:' || uid::text, uid::text, 60, 900);

  select * into v from public.join_requests where id = p_request_id;
  if v is null then raise exception 'request not found'; end if;

  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = v.room_id
      and rm.user_id = uid
      and rm.role in ('owner', 'admin')
      and rm.archived_at is null
  ) then
    raise exception 'not authorized';
  end if;

  insert into public.room_members (room_id, user_id, role)
  values (v.room_id, v.user_id, 'member')
  on conflict (room_id, user_id) do update set archived_at = null;

  select * into r from public.rooms where id = v.room_id;
  if r.kind = 'space' and r.group_room_id is not null then
    insert into public.room_members (room_id, user_id, role)
    values (r.group_room_id, v.user_id, 'member')
    on conflict (room_id, user_id) do update set archived_at = null;
  end if;

  update public.join_requests
    set status = 'approved', decided_at = now()
  where id = p_request_id;
end;
$$;

create or replace function public.decline_join_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v public.join_requests;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public._rate_limit_check('decline_join:' || uid::text, uid::text, 60, 900);

  select * into v from public.join_requests where id = p_request_id;
  if v is null then raise exception 'request not found'; end if;

  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = v.room_id
      and rm.user_id = uid
      and rm.role in ('owner', 'admin')
      and rm.archived_at is null
  ) then
    raise exception 'not authorized';
  end if;

  update public.join_requests
    set status = 'declined', decided_at = now()
  where id = p_request_id;
end;
$$;

-- ---------- rotate invite code (kills leaked codes) ----------
create or replace function public.regenerate_room_code(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  r public.rooms;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public._rate_limit_check('regen_code:' || uid::text, uid::text, 10, 3600);

  if not exists (
    select 1 from public.room_members rm
    where rm.room_id = p_room_id
      and rm.user_id = uid
      and rm.role in ('owner', 'admin')
      and rm.archived_at is null
  ) then
    raise exception 'not authorized';
  end if;

  loop
    new_code := public.gen_room_code();
    begin
      update public.rooms set code = new_code
      where id = p_room_id
      returning * into r;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return new_code;
end;
$$;

-- ---------- grants ----------
revoke all on function public.request_join(text) from public;
revoke all on function public.join_room(text) from public;
revoke all on function public.approve_join_request(uuid) from public;
revoke all on function public.decline_join_request(uuid) from public;
revoke all on function public.list_join_requests(uuid) from public;
revoke all on function public.regenerate_room_code(uuid) from public;

grant execute on function public.request_join(text) to authenticated;
grant execute on function public.join_room(text) to authenticated;
grant execute on function public.approve_join_request(uuid) to authenticated;
grant execute on function public.decline_join_request(uuid) to authenticated;
grant execute on function public.list_join_requests(uuid) to authenticated;
grant execute on function public.regenerate_room_code(uuid) to authenticated;

-- anon must not call join/create RPCs
revoke execute on function public.request_join(text) from anon;
revoke execute on function public.join_room(text) from anon;
revoke execute on function public.approve_join_request(uuid) from anon;
revoke execute on function public.decline_join_request(uuid) from anon;
revoke execute on function public.list_join_requests(uuid) from anon;
revoke execute on function public.regenerate_room_code(uuid) from anon;
