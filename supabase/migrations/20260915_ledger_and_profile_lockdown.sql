-- Mylo — lock down what a signed-in client may write.
-- Apply in the Supabase SQL Editor. Safe to re-run.
--
-- 1) profiles: a user may only edit their own cosmetic columns.
--    Without column-level grants, "update own row" lets anyone set is_admin,
--    plan, credits or plan_expires_at on themselves.
-- Requires 20260727_avatar_look.sql first (the `look` column). `username` is the
-- login handle — the auth email is derived from it — so it is deliberately NOT here.
revoke update on table public.profiles from authenticated;
grant update ("character", look, avatar_url, display_name, theme, mood)
  on table public.profiles to authenticated;

-- 2) messages: the wallet and XP ledgers are written by the client today, and the
--    balance is replayed client-side. Anyone can insert {msg_kind:'myl',mtype:'grant'}
--    or an XP row of any size. Until a server-side ledger exists, cap what a row
--    may claim so a forged row is worth little, and refuse the mint kinds outright.
create or replace function public.messages_payload_guard()
returns trigger language plpgsql as $$
declare k text := new.payload->>'msg_kind'; t text := new.payload->>'mtype';
        amt numeric := nullif(new.payload->>'amount','')::numeric;
begin
  if k = 'myl' and t = 'grant' then
    -- only an admin account may mint
    if not exists (select 1 from public.profiles p where p.id = auth.uid() and coalesce(p.is_admin,false)) then
      raise exception 'not allowed';
    end if;
    if amt is null or amt > 50000 then raise exception 'amount too large'; end if;
  end if;
  -- plan bonus (max 10,000 for Pod) and level gifts (max 1,000 for Supernova) are
  -- written by ordinary users; the client caps them to the real tier value and
  -- the replay ignores anything unearned — this just stops absurd numbers.
  if k = 'myl' and t = 'plan'    and (amt is null or amt > 10000) then raise exception 'amount too large'; end if;
  if k = 'myl' and t = 'levelup' and (amt is null or amt > 1000)  then raise exception 'amount too large'; end if;
  if k = 'xp' and t = 'earn' then
    if amt is null or amt > 200 then raise exception 'xp amount too large'; end if;
  end if;
  if k = 'myl' and t = 'send' and (amt is null or amt <= 0 or amt > 1000000) then
    raise exception 'bad amount';
  end if;
  return new;
end $$;
drop trigger if exists messages_payload_guard on public.messages;
create trigger messages_payload_guard before insert on public.messages
  for each row execute function public.messages_payload_guard();

-- 3) messages must be written as yourself, into a room you are a member of.
--    (If your existing insert policy already says this, this one is redundant.)
drop policy if exists messages_insert_member on public.messages;
create policy messages_insert_member on public.messages
  for insert to authenticated
  with check (
    from_id = auth.uid()
    and exists (select 1 from public.room_members rm
                where rm.room_id = messages.room_id and rm.user_id = auth.uid()
                  and rm.archived_at is null)
  );

-- 4) Index the hot paths the app actually queries.
create index if not exists messages_room_created on public.messages (room_id, created_at);
create index if not exists messages_room_kind on public.messages (room_id, ((payload->>'msg_kind')));
