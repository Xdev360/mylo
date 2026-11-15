-- Room join requests
-- A signed-in NON-member asks to join a room by its invite code; room owners/admins
-- approve or decline. Writes go only through SECURITY DEFINER RPCs so RLS stays tight.

create table if not exists public.join_requests (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.rooms(id)    on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at  timestamptz not null default now(),
  decided_at  timestamptz,
  unique (room_id, user_id)
);

alter table public.join_requests enable row level security;

drop policy if exists jr_select_own on public.join_requests;
create policy jr_select_own on public.join_requests
  for select using (auth.uid() = user_id);

drop policy if exists jr_select_admin on public.join_requests;
create policy jr_select_admin on public.join_requests
  for select using (exists (
    select 1 from public.room_members rm
    where rm.room_id = join_requests.room_id
      and rm.user_id = auth.uid()
      and rm.role in ('owner','admin')));

create or replace function public.request_join(p_code text)
returns public.join_requests
language plpgsql security definer set search_path = public as $$
declare
  v_room uuid;
  v_req  public.join_requests;
begin
  if auth.uid() is null then raise exception 'auth required'; end if;
  select id into v_room from public.rooms where upper(code) = upper(trim(p_code)) limit 1;
  if v_room is null then raise exception 'room not found'; end if;
  if exists (select 1 from public.room_members where room_id = v_room and user_id = auth.uid()) then
    raise exception 'already a member';
  end if;
  insert into public.join_requests (room_id, user_id, status)
    values (v_room, auth.uid(), 'pending')
    on conflict (room_id, user_id)
      do update set status = 'pending', decided_at = null, created_at = now()
    returning * into v_req;
  return v_req;
end $$;

create or replace function public.approve_join_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v public.join_requests;
begin
  select * into v from public.join_requests where id = p_request_id;
  if v is null then raise exception 'request not found'; end if;
  if not exists (select 1 from public.room_members rm
     where rm.room_id = v.room_id and rm.user_id = auth.uid() and rm.role in ('owner','admin')) then
    raise exception 'not authorized';
  end if;
  insert into public.room_members (room_id, user_id, role)
    values (v.room_id, v.user_id, 'member')
    on conflict (room_id, user_id) do nothing;
  update public.join_requests set status = 'approved', decided_at = now() where id = p_request_id;
end $$;

create or replace function public.decline_join_request(p_request_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare v public.join_requests;
begin
  select * into v from public.join_requests where id = p_request_id;
  if v is null then raise exception 'request not found'; end if;
  if not exists (select 1 from public.room_members rm
     where rm.room_id = v.room_id and rm.user_id = auth.uid() and rm.role in ('owner','admin')) then
    raise exception 'not authorized';
  end if;
  update public.join_requests set status = 'declined', decided_at = now() where id = p_request_id;
end $$;

create or replace function public.list_join_requests(p_room_id uuid)
returns table (id uuid, user_id uuid, username text, avatar_url text, "character" text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.room_members rm
     where rm.room_id = p_room_id and rm.user_id = auth.uid() and rm.role in ('owner','admin')) then
    raise exception 'not authorized';
  end if;
  return query
    select jr.id, jr.user_id, p.username, p.avatar_url, p."character", jr.created_at
    from public.join_requests jr
    join public.profiles p on p.id = jr.user_id
    where jr.room_id = p_room_id and jr.status = 'pending'
    order by jr.created_at asc;
end $$;

grant execute on function public.request_join(text)            to authenticated;
grant execute on function public.approve_join_request(uuid)    to authenticated;
grant execute on function public.decline_join_request(uuid)    to authenticated;
grant execute on function public.list_join_requests(uuid)      to authenticated;
