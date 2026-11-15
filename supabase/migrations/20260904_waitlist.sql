-- Mylo — public waitlist
-- Anonymous visitors on the marketing site sign up for early access.
-- The table is locked down: no anon select/update/delete, and inserts go only
-- through a SECURITY DEFINER RPC so the list can never be harvested with the
-- publishable anon key.

create table if not exists public.waitlist (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,
  referrer    text,
  created_at  timestamptz not null default now(),
  invited_at  timestamptz,
  unique (email)
);

create index if not exists waitlist_created_at_idx on public.waitlist (created_at desc);

alter table public.waitlist enable row level security;

-- No policies for anon/authenticated: RLS denies everything by default.
-- Reads happen with the service role (admin) or straight from the SQL editor.

create or replace function public.join_waitlist(p_email text, p_source text default null, p_referrer text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_email text := lower(trim(p_email));
begin
  if v_email is null or v_email = '' then
    raise exception 'email required';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid email';
  end if;
  if length(v_email) > 254 then
    raise exception 'invalid email';
  end if;

  insert into public.waitlist (email, source, referrer)
    values (v_email, nullif(left(coalesce(p_source, ''), 64), ''), nullif(left(coalesce(p_referrer, ''), 255), ''))
    on conflict (email) do nothing;
end $$;

revoke all on function public.join_waitlist(text, text, text) from public;
grant execute on function public.join_waitlist(text, text, text) to anon, authenticated;

-- Handy count for the site's social proof, without exposing addresses.
create or replace function public.waitlist_count()
returns integer
language sql security definer set search_path = public stable as $$
  select count(*)::int from public.waitlist;
$$;

revoke all on function public.waitlist_count() from public;
grant execute on function public.waitlist_count() to anon, authenticated;
