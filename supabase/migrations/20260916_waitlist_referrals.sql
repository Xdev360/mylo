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
