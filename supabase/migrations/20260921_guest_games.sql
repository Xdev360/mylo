-- Mylo — a game you can send to someone who is not on Mylo
--
-- The whole point is that the guest never signs up and never gets into the
-- app. They open a link, play one game in their browser, and that is the end
-- of it. So there is no account involved on their side at all: the link's
-- token IS the credential, and it only ever unlocks the one row it names.
--
-- Why a table and not the messages log: every other game here lives in
-- `messages`, which is readable only by members of the room. A guest is in no
-- room and must never be able to reach one. Keeping guest games in their own
-- table means the anonymous surface is exactly these five functions and
-- nothing else.
--
-- Safe to re-run.

create table if not exists public.guest_games (
  id           uuid primary key default gen_random_uuid(),
  token        text unique not null,           -- what is in the link
  guest_key    text,                           -- handed to whoever claims the guest seat
  host_id      uuid not null references public.profiles(id) on delete cascade,
  host_name    text not null default 'Mylo player',
  kind         text not null check (kind in ('chess','eights','rush','chance')),
  state        jsonb,
  turn_seat    text not null default 'host' check (turn_seat in ('host','guest')),
  status       text not null default 'open' check (status in ('open','live','done')),
  guest_name   text,
  winner_seat  text check (winner_seat in ('host','guest','draw')),
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '24 hours',
  ended_at     timestamptz
);
create index if not exists guest_games_host_idx on public.guest_games (host_id, created_at desc);

-- Nobody reads or writes this table directly. Every path below is a function
-- that checks the token or the session first.
alter table public.guest_games enable row level security;
revoke all on table public.guest_games from anon, authenticated;

-- A link is dead once the game is finished or the window has passed. Both the
-- guest and the host see the same answer, so a replayed link cannot resurrect
-- a game that is over.
create or replace function public.guest_game_is_live(g public.guest_games)
returns boolean language sql immutable as $$
  select g.status <> 'done' and g.expires_at > now()
$$;

-- ── Made from inside the app, by somebody signed in ───────────────────────
create or replace function public.create_guest_game(p_kind text, p_state jsonb)
returns table (token text, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := (select auth.uid());
  v_tok text;
  v_name text;
begin
  if uid is null then raise exception 'not authenticated'; end if;
  if p_kind not in ('chess','eights','rush','chance') then
    raise exception 'that game cannot be sent as a link yet';
  end if;
  -- One open invite per game kind at a time: a pile of live links is a pile of
  -- ways for the wrong person to walk in.
  update public.guest_games set status = 'done', ended_at = now()
   where host_id = uid and kind = p_kind and status = 'open';

  select coalesce(username, 'Mylo player') into v_name from public.profiles where id = uid;
  -- pgcrypto's random-bytes helper sits in the extensions schema, outside this
  -- function's search_path. gen_random_uuid() is built in, and two of them is
  -- 256 bits of secret, which is more than a link needs.
  v_tok := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  insert into public.guest_games (token, host_id, host_name, kind, state)
  values (v_tok, uid, v_name, p_kind, p_state);
  return query select v_tok, (now() + interval '24 hours')::timestamptz;
end $$;
revoke all on function public.create_guest_game(text, jsonb) from public;
grant execute on function public.create_guest_game(text, jsonb) to authenticated;

-- ── What the link shows before you tap play ───────────────────────────────
create or replace function public.guest_game_peek(p_token text)
returns table (kind text, host_name text, status text, guest_name text, live boolean)
language sql security definer set search_path = public stable as $$
  select g.kind, g.host_name,
         case when public.guest_game_is_live(g) then g.status else 'expired' end,
         g.guest_name,
         public.guest_game_is_live(g)
    from public.guest_games g
   where g.token = p_token
   limit 1;
$$;
revoke all on function public.guest_game_peek(text) from public;
grant execute on function public.guest_game_peek(text) to anon, authenticated;

-- ── Claiming the guest seat ───────────────────────────────────────────────
-- Once. A second person opening the same link joins nothing: the seat is gone
-- and the link is spent, which is exactly how a one-game invite should behave.
create or replace function public.guest_game_join(p_token text, p_name text)
returns table (guest_key text, kind text, host_name text, state jsonb, turn_seat text)
language plpgsql security definer set search_path = public as $$
declare g public.guest_games; v_key text;
begin
  select * into g from public.guest_games where token = p_token for update;
  if g.id is null then raise exception 'no such game'; end if;
  if not public.guest_game_is_live(g) then raise exception 'this link has expired'; end if;
  if g.guest_key is not null then raise exception 'someone is already playing this one'; end if;
  v_key := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');
  update public.guest_games
     set guest_key = v_key,
         guest_name = coalesce(nullif(left(trim(p_name), 24), ''), 'Guest'),
         status = 'live'
   where id = g.id;
  return query select v_key, g.kind, g.host_name, g.state, g.turn_seat;
end $$;
revoke all on function public.guest_game_join(text, text) from public;
grant execute on function public.guest_game_join(text, text) to anon, authenticated;

-- ── Reading the board ─────────────────────────────────────────────────────
-- is_host is answered by the session, not by anything the caller can claim,
-- so the page never has to guess which side of the board it is on.
drop function if exists public.guest_game_state(text);
create or replace function public.guest_game_state(p_token text)
returns table (kind text, host_name text, guest_name text, state jsonb,
               turn_seat text, status text, winner_seat text, live boolean, is_host boolean)
language sql security definer set search_path = public stable as $$
  select g.kind, g.host_name, g.guest_name, g.state, g.turn_seat,
         case when public.guest_game_is_live(g) then g.status else 'expired' end,
         g.winner_seat, public.guest_game_is_live(g),
         (auth.uid() is not null and auth.uid() = g.host_id)
    from public.guest_games g
   where g.token = p_token
   limit 1;
$$;
revoke all on function public.guest_game_state(text) from public;
grant execute on function public.guest_game_state(text) to anon, authenticated;

-- ── Making a move ─────────────────────────────────────────────────────────
-- Two things are checked here and they are the two that matter: that you are
-- the seat you claim (the host by session, the guest by the key handed to them
-- when they joined), and that it is actually your turn. The rules of chess
-- live in JavaScript and cannot be re-run in Postgres, so a determined player
-- could still post a state that suits them — the turn check is what stops the
-- ordinary version of that, which is moving twice.
create or replace function public.guest_game_move(
  p_token text, p_guest_key text, p_state jsonb,
  p_next_seat text, p_over boolean, p_winner text)
returns void
language plpgsql security definer set search_path = public as $$
declare g public.guest_games; v_seat text;
begin
  select * into g from public.guest_games where token = p_token for update;
  if g.id is null then raise exception 'no such game'; end if;
  if not public.guest_game_is_live(g) then raise exception 'this game is over'; end if;

  if p_guest_key is not null and p_guest_key = g.guest_key then v_seat := 'guest';
  elsif auth.uid() is not null and auth.uid() = g.host_id then v_seat := 'host';
  else raise exception 'not your game';
  end if;

  if g.turn_seat <> v_seat then raise exception 'not your turn'; end if;
  if p_next_seat not in ('host','guest') then raise exception 'bad seat'; end if;

  update public.guest_games
     set state = p_state,
         turn_seat = p_next_seat,
         status = case when p_over then 'done' else 'live' end,
         winner_seat = case when p_over then p_winner else null end,
         ended_at = case when p_over then now() else null end
   where id = g.id;
end $$;
revoke all on function public.guest_game_move(text, text, jsonb, text, boolean, text) from public;
grant execute on function public.guest_game_move(text, text, jsonb, text, boolean, text) to anon, authenticated;
