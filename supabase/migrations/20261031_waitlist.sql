-- Mylo — the waitlist table behind the new site
--
-- Written only by the site's own API route, using the service role, because
-- nobody else should be able to read who is on the list or how long it is.
-- RLS is on with no policy at all: that denies anon and authenticated
-- outright, and the service role bypasses it by design.
--
-- Safe to re-run.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  country     text,
  referred_by text,
  created_at  timestamptz not null default now(),
  status      text not null default 'waiting'
                check (status in ('waiting', 'invited', 'active'))
);

-- Unique and lowercased: the API lowercases before it writes, and this makes
-- that a rule rather than a habit. A duplicate raises 23505, which the route
-- turns into a plain "already on the list".
create unique index if not exists waitlist_email_key
  on public.waitlist (lower(email));

create index if not exists waitlist_created_idx
  on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;
revoke all on table public.waitlist from anon, authenticated;

comment on table public.waitlist is
  'Site waitlist. Written by /api/waitlist with the service role; feeds admin screen AD11.';
