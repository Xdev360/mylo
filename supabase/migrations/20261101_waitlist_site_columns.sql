-- Mylo: the columns the new site's /api/waitlist writes
--
-- The waitlist table already exists in two shapes: the app's (20260904 and
-- 20260916: source, referrer, ref_code, referred_by, invited_at) and the
-- site's first draft (20261031: country, referred_by, status). Whichever one
-- a database has, this brings it to the union of both, plus utm. Nothing is
-- dropped or renamed, so the app's join_waitlist_v2() and the
-- waitlist_queue view keep working unchanged.
--
-- Additive and safe to re-run. Not applied yet: run it from the Supabase
-- SQL editor or with `supabase db push`.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  created_at  timestamptz not null default now()
);

alter table public.waitlist add column if not exists country     text;
alter table public.waitlist add column if not exists referred_by text;
alter table public.waitlist add column if not exists utm         jsonb;
alter table public.waitlist add column if not exists source      text;
alter table public.waitlist add column if not exists referrer    text;
alter table public.waitlist add column if not exists ref_code    text;
alter table public.waitlist add column if not exists status      text not null default 'waiting';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waitlist_status_check') then
    alter table public.waitlist
      add constraint waitlist_status_check check (status in ('waiting', 'invited', 'active'));
  end if;
end $$;

create unique index if not exists waitlist_ref_code_key on public.waitlist (ref_code);
create index if not exists waitlist_referred_by_idx on public.waitlist (referred_by);

-- Locked: RLS on and no policy, so only the service role can read or write.
alter table public.waitlist enable row level security;
revoke all on table public.waitlist from anon, authenticated;
