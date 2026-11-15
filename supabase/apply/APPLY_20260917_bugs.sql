-- ============================================================
-- Mylo — bug reports. Paste into the Supabase SQL editor and Run.
-- Safe to re-run.
-- ============================================================

begin;
-- Mylo — tester bug reports
-- Anonymous testers file a bug from staymylo.com. The table is locked down the same
-- way the waitlist is: RLS on, no anon policies, writes only through a SECURITY
-- DEFINER RPC, so the publishable key can file a report but can never read the
-- queue back. Valid reports are worth 100 $MYL, paid by hand from the admin grant.
-- Safe to re-run.

create table if not exists public.bug_reports (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  username    text,
  user_id     uuid references public.profiles(id) on delete set null,
  area        text not null,
  kind        text not null,
  detail      text not null,
  agent       text,
  status      text not null default 'new'
              check (status in ('new','confirmed','duplicate','invalid','fixed')),
  award       int  not null default 0,
  awarded_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists bug_reports_created_idx on public.bug_reports (created_at desc);
create index if not exists bug_reports_status_idx  on public.bug_reports (status, created_at desc);
create index if not exists bug_reports_user_idx    on public.bug_reports (user_id);

alter table public.bug_reports enable row level security;
-- No policies for anon/authenticated: RLS denies everything. Read with the service
-- role or straight from the SQL editor.

create or replace function public.gen_bug_ref()
returns text language sql volatile as $$
  select 'BUG-' || string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 5);
$$;

create or replace function public.file_bug_report(
  p_username text, p_area text, p_kind text, p_detail text, p_agent text default null)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user   text := nullif(lower(trim(regexp_replace(coalesce(p_username,''), '^@', ''))), '');
  v_detail text := nullif(trim(coalesce(p_detail, '')), '');
  v_area   text := nullif(left(trim(coalesce(p_area, '')), 32), '');
  v_kind   text := nullif(left(trim(coalesce(p_kind, '')), 32), '');
  v_id     uuid;
  v_ref    text;
  v_tries  int := 0;
begin
  if v_detail is null or length(v_detail) < 15 then
    raise exception 'tell us a bit more about what happened';
  end if;
  if length(v_detail) > 2000 then
    raise exception 'that is too long — keep it under 2000 characters';
  end if;
  if v_area is null then raise exception 'pick where it happened'; end if;
  if v_user is not null and length(v_user) > 20 then raise exception 'invalid username'; end if;

  -- Resolve the username to a real account so the 100 $MYL can actually be paid.
  -- An unmatched name is still accepted; it just can't be rewarded.
  if v_user is not null then
    select id into v_id from public.profiles where lower(username) = v_user limit 1;
  end if;

  -- Throttle: 5 an hour per named tester, 40 an hour site-wide.
  if v_user is not null and (
      select count(*) from public.bug_reports b
      where lower(b.username) = v_user and b.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'that is a lot of reports in one hour — try again shortly';
  end if;
  if (select count(*) from public.bug_reports where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'too many reports right now — try again shortly';
  end if;

  loop
    v_ref := public.gen_bug_ref(); v_tries := v_tries + 1;
    exit when not exists (select 1 from public.bug_reports where ref = v_ref) or v_tries > 5;
  end loop;

  insert into public.bug_reports (ref, username, user_id, area, kind, detail, agent)
    values (v_ref, v_user, v_id, v_area, coalesce(v_kind, 'bug'), v_detail,
            nullif(left(coalesce(p_agent, ''), 200), ''));
  return v_ref;
end $$;
revoke all on function public.file_bug_report(text, text, text, text, text) from public;
grant execute on function public.file_bug_report(text, text, text, text, text) to anon, authenticated;

-- The triage queue. Unpaid confirmed reports float to the top.
create or replace view public.bug_queue as
  select b.ref, b.created_at, b.area, b.kind, b.status, b.username,
         (b.user_id is not null) as can_pay,
         b.award, b.awarded_at, b.detail, b.agent
  from public.bug_reports b
  order by (b.status = 'confirmed' and b.awarded_at is null) desc, b.created_at desc;
revoke all on public.bug_queue from public, anon, authenticated;

-- Mark a report paid after granting the 100 $MYL. Service role / SQL editor only.
create or replace function public.mark_bug_paid(p_ref text, p_award int default 100)
returns void
language sql security definer set search_path = public as $$
  update public.bug_reports
     set award = greatest(coalesce(p_award, 100), 0), awarded_at = now(),
         status = case when status = 'new' then 'confirmed' else status end
   where ref = upper(trim(p_ref));
$$;
revoke all on function public.mark_bug_paid(text, int) from public, anon, authenticated;

commit;
