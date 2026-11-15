-- Mylo — feature requests, votes, and a changelog
--
-- Sibling to 20260917_bug_reports.sql and locked down the same way: RLS on, no
-- table policies, every write through a SECURITY DEFINER RPC.
--
-- One deliberate difference. Bug reports are private — a report can carry an
-- account name, a screenshot description, whatever someone typed in a panic —
-- so nothing reads them back. Feature requests are the opposite: the whole
-- point is that people see what has already been asked for and pile onto it
-- instead of filing the same thing eight times. So there is a read RPC, and it
-- returns only the columns meant to be public. The table still denies
-- everything directly, so adding a column later cannot leak it by accident.
--
-- Votes need an identity or they are meaningless. A cookie is trivially
-- cleared, so a vote requires a Mylo username and is unique per username per
-- request. People without one can read and request, just not vote — better a
-- smaller honest count than a big fake one.
--
-- Safe to re-run.

create table if not exists public.feature_requests (
  id          uuid primary key default gen_random_uuid(),
  ref         text not null unique,
  username    text,
  user_id     uuid references public.profiles(id) on delete set null,
  title       text not null,
  detail      text not null,
  area        text not null,
  status      text not null default 'open'
              check (status in ('open','planned','building','shipped','declined','duplicate')),
  note        text,                         -- shown publicly next to a status, e.g. why it was declined
  votes       int  not null default 0,      -- denormalised from feature_votes, kept by the vote RPC
  shipped_at  timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists feature_requests_rank_idx    on public.feature_requests (votes desc, created_at desc);
create index if not exists feature_requests_status_idx  on public.feature_requests (status, votes desc);
create index if not exists feature_requests_shipped_idx on public.feature_requests (shipped_at desc)
  where shipped_at is not null;

create table if not exists public.feature_votes (
  request_id uuid not null references public.feature_requests(id) on delete cascade,
  voter      text not null,                 -- lowercased username
  created_at timestamptz not null default now(),
  primary key (request_id, voter)
);
create index if not exists feature_votes_voter_idx on public.feature_votes (voter);

alter table public.feature_requests enable row level security;
alter table public.feature_votes    enable row level security;
-- No policies. Everything goes through the functions below.

create or replace function public.gen_feature_ref()
returns text language sql volatile as $$
  select 'FR-' || string_agg(
    substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 5);
$$;

-- ── File a request ────────────────────────────────────────────────────────
create or replace function public.file_feature_request(
  p_username text, p_title text, p_detail text, p_area text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user   text := nullif(lower(trim(regexp_replace(coalesce(p_username,''), '^@', ''))), '');
  v_title  text := nullif(trim(coalesce(p_title, '')), '');
  v_detail text := nullif(trim(coalesce(p_detail, '')), '');
  v_area   text := nullif(left(trim(coalesce(p_area, '')), 32), '');
  v_id     uuid;
  v_ref    text;
  v_new    uuid;
  v_tries  int := 0;
begin
  if v_title is null or length(v_title) < 6 then
    raise exception 'give it a short title so people can find it';
  end if;
  if length(v_title) > 90 then
    raise exception 'keep the title under 90 characters';
  end if;
  if v_detail is null or length(v_detail) < 15 then
    raise exception 'say a little more about what you want and why';
  end if;
  if length(v_detail) > 2000 then
    raise exception 'that is too long — keep it under 2000 characters';
  end if;
  if v_area is null then raise exception 'pick an area'; end if;
  if v_user is not null and length(v_user) > 20 then raise exception 'invalid username'; end if;

  if v_user is not null then
    select id into v_id from public.profiles where lower(username) = v_user limit 1;
  end if;

  -- Throttle: 5 an hour per named tester, 40 an hour site-wide.
  if v_user is not null and (
      select count(*) from public.feature_requests f
      where lower(f.username) = v_user and f.created_at > now() - interval '1 hour') >= 5 then
    raise exception 'that is a lot of requests in one hour — try again shortly';
  end if;
  if (select count(*) from public.feature_requests where created_at > now() - interval '1 hour') >= 40 then
    raise exception 'too many requests right now — try again shortly';
  end if;

  loop
    v_ref := public.gen_feature_ref(); v_tries := v_tries + 1;
    exit when not exists (select 1 from public.feature_requests where ref = v_ref) or v_tries > 5;
  end loop;

  insert into public.feature_requests (ref, username, user_id, title, detail, area)
    values (v_ref, v_user, v_id, v_title, v_detail, v_area)
    returning id into v_new;

  -- Asking for something counts as wanting it.
  if v_user is not null then
    insert into public.feature_votes (request_id, voter) values (v_new, v_user)
      on conflict do nothing;
    update public.feature_requests set votes = 1 where id = v_new;
  end if;

  return v_ref;
end $$;
revoke all on function public.file_feature_request(text, text, text, text) from public;
grant execute on function public.file_feature_request(text, text, text, text) to anon, authenticated;

-- ── Vote (toggles) ────────────────────────────────────────────────────────
create or replace function public.vote_feature(p_username text, p_ref text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user text := nullif(lower(trim(regexp_replace(coalesce(p_username,''), '^@', ''))), '');
  v_id   uuid;
  v_had  boolean;
  v_n    int;
begin
  if v_user is null then raise exception 'add your Mylo username to vote'; end if;
  if length(v_user) > 20 then raise exception 'invalid username'; end if;

  select id into v_id from public.feature_requests where ref = upper(trim(coalesce(p_ref,'')));
  if v_id is null then raise exception 'that request no longer exists'; end if;

  -- 60 votes an hour per name is far past enthusiasm and into scripting.
  if (select count(*) from public.feature_votes
       where voter = v_user and created_at > now() - interval '1 hour') >= 60 then
    raise exception 'slow down a moment';
  end if;

  select exists (select 1 from public.feature_votes where request_id = v_id and voter = v_user)
    into v_had;

  if v_had then
    delete from public.feature_votes where request_id = v_id and voter = v_user;
  else
    insert into public.feature_votes (request_id, voter) values (v_id, v_user)
      on conflict do nothing;
  end if;

  select count(*) into v_n from public.feature_votes where request_id = v_id;
  update public.feature_requests set votes = v_n where id = v_id;

  return jsonb_build_object('votes', v_n, 'voted', not v_had);
end $$;
revoke all on function public.vote_feature(text, text) from public;
grant execute on function public.vote_feature(text, text) to anon, authenticated;

-- ── Read the board ────────────────────────────────────────────────────────
-- Public on purpose, and column-by-column rather than select *, so a column
-- added to the table later is not published by accident. p_voter is optional
-- and only decides whether each row comes back marked as already voted.
create or replace function public.list_features(
  p_status text default 'open', p_sort text default 'top',
  p_limit int default 60, p_voter text default null)
returns table (
  ref text, title text, detail text, area text, status text, note text,
  votes int, username text, created_at timestamptz, shipped_at timestamptz, voted boolean)
language sql security definer set search_path = public stable as $$
  select f.ref, f.title, f.detail, f.area, f.status, f.note,
         f.votes, f.username, f.created_at, f.shipped_at,
         case when p_voter is null then false
              else exists (select 1 from public.feature_votes v
                            where v.request_id = f.id
                              and v.voter = lower(trim(regexp_replace(p_voter, '^@', ''))))
         end as voted
    from public.feature_requests f
   where f.status <> 'duplicate'
     and (p_status is null or p_status = 'all'
          or (p_status = 'shipped' and f.status = 'shipped')
          or (p_status = 'open'    and f.status in ('open','planned','building')))
   order by
     case when p_sort = 'new'    then extract(epoch from f.created_at) end desc nulls last,
     case when p_sort = 'recent' then extract(epoch from coalesce(f.shipped_at, f.created_at)) end desc nulls last,
     case when p_sort not in ('new','recent') then f.votes end desc nulls last,
     f.created_at desc
   limit greatest(1, least(coalesce(p_limit, 60), 100));
$$;
revoke all on function public.list_features(text, text, int, text) from public;
grant execute on function public.list_features(text, text, int, text) to anon, authenticated;

-- ── Admin ─────────────────────────────────────────────────────────────────
create or replace view public.feature_queue as
  select f.ref, f.created_at, f.status, f.votes, f.area, f.title, f.username,
         (f.user_id is not null) as known_user, f.detail, f.note, f.shipped_at
  from public.feature_requests f
  order by (f.status = 'open') desc, f.votes desc, f.created_at desc;
revoke all on public.feature_queue from public, anon, authenticated;

-- Move a request along. Service role / SQL editor only.
create or replace function public.set_feature_status(
  p_ref text, p_status text, p_note text default null)
returns void
language sql security definer set search_path = public as $$
  update public.feature_requests
     set status = p_status,
         note = coalesce(nullif(trim(coalesce(p_note,'')), ''), note),
         shipped_at = case when p_status = 'shipped' then coalesce(shipped_at, now()) else shipped_at end
   where ref = upper(trim(p_ref));
$$;
revoke all on function public.set_feature_status(text, text, text) from public, anon, authenticated;
