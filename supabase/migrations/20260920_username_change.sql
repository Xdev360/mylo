-- Mylo — let people change their username
--
-- 20260915_ledger_and_profile_lockdown.sql deliberately left `username` out of
-- the columns a person may update, because the login email was derived from
-- it: renaming would have broken sign-in. Since 20260920_real_email_auth.sql
-- accounts carry a real address, so the username is just a handle again and
-- can move. Sign-in by username keeps working because email_for_username
-- resolves the current handle at the moment you sign in.
--
-- Uniqueness and shape are enforced by a trigger rather than trusting the
-- client: 3-20 of a-z, 0-9, _ ; lowercase; taken names refused.
--
-- Safe to re-run.

grant update (username) on table public.profiles to authenticated;

create or replace function public.profiles_username_guard()
returns trigger language plpgsql as $$
begin
  if new.username is distinct from old.username then
    new.username := lower(trim(coalesce(new.username, '')));
    if new.username !~ '^[a-z0-9_]{3,20}$' then
      raise exception 'Username: 3–20 letters, numbers or _';
    end if;
    if exists (select 1 from public.profiles p where lower(p.username) = new.username and p.id <> new.id) then
      raise exception 'Username taken';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists profiles_username_guard on public.profiles;
create trigger profiles_username_guard
  before update of username on public.profiles
  for each row execute function public.profiles_username_guard();
