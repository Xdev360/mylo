-- Optional custom invite code + allow room creator to rotate
-- Run in Supabase SQL Editor after 20260823_security_harden.sql

create or replace function public.regenerate_room_code(
  p_room_id uuid,
  p_code text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_code text;
  r public.rooms;
  clean text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  perform public._rate_limit_check('regen_code:' || uid::text, uid::text, 10, 3600);

  select * into r from public.rooms where id = p_room_id;
  if r.id is null then raise exception 'room not found'; end if;

  if not (
    r.created_by = uid
    or exists (
      select 1 from public.room_members rm
      where rm.room_id = p_room_id
        and rm.user_id = uid
        and rm.role in ('owner', 'admin')
        and rm.archived_at is null
    )
  ) then
    raise exception 'not authorized';
  end if;

  clean := upper(trim(coalesce(p_code, '')));
  if clean <> '' then
    if clean !~ '^[A-Z0-9]{6,12}$' then
      raise exception 'invalid code — use 6 to 12 letters or numbers';
    end if;
    begin
      update public.rooms set code = clean where id = p_room_id;
    exception when unique_violation then
      raise exception 'that code is already taken';
    end;
    return clean;
  end if;

  loop
    new_code := public.gen_room_code();
    begin
      update public.rooms set code = new_code where id = p_room_id;
      exit;
    exception when unique_violation then
      null;
    end;
  end loop;

  return new_code;
end;
$$;

revoke all on function public.regenerate_room_code(uuid, text) from public;
revoke all on function public.regenerate_room_code(uuid, text) from anon;
grant execute on function public.regenerate_room_code(uuid, text) to authenticated;

-- Keep single-arg overload working for older clients
create or replace function public.regenerate_room_code(p_room_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.regenerate_room_code(p_room_id, null);
end;
$$;

revoke all on function public.regenerate_room_code(uuid) from public;
revoke all on function public.regenerate_room_code(uuid) from anon;
grant execute on function public.regenerate_room_code(uuid) to authenticated;
