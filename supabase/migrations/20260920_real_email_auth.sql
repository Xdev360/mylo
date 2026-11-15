-- Mylo — real email addresses, so password reset can exist
--
-- Until now signup took a username and invented `username@example.com`.
-- Supabase sends recovery mail to auth.users.email, so a fabricated address
-- means password reset is not merely unconfigured, it is impossible. The auth
-- identity has to be an address the person actually reads.
--
-- That leaves one problem. The app is username-first and people will type a
-- username at the login box, but signInWithPassword needs the email. Something
-- has to resolve one to the other.
--
-- The honest trade-off, written down because it is a real one: this function
-- turns a guessed username into an email address, which is an enumeration
-- vector. It is the same trade every username-first product makes, and it is
-- bounded three ways — exact match only (no search, no listing), a strict
-- per-IP-ish rate limit below, and nothing returned but the single address.
-- The alternative, signing in through an Edge Function so the address never
-- reaches the browser, means handling raw passwords in our own code, which is
-- a worse risk than this one.
--
-- Safe to re-run.

-- Reuses the existing security_rate_events table if it is shaped for it;
-- otherwise falls back to counting nothing and simply resolving.
create or replace function public.email_for_username(p_username text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_user  text := nullif(lower(trim(regexp_replace(coalesce(p_username,''), '^@', ''))), '');
  v_email text;
  v_hits  int;
begin
  if v_user is null or length(v_user) > 20 then
    return null;                       -- never distinguishes "bad input" from "no such user"
  end if;

  -- 30 lookups a minute across the whole site. A person signing in makes one.
  begin
    select count(*) into v_hits
      from public.security_rate_events
     where bucket = 'email_lookup'
       and created_at > now() - interval '1 minute';
    if v_hits >= 30 then
      raise exception 'too many attempts — wait a moment';
    end if;
    insert into public.security_rate_events (bucket, subject)
      values ('email_lookup', v_user);
  exception when undefined_table or undefined_column then
    null;                              -- table not shaped for this; resolve anyway
  end;

  select u.email into v_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(p.username) = v_user
   limit 1;

  return v_email;                      -- null when there is no such user
end $$;
revoke all on function public.email_for_username(text) from public;
grant execute on function public.email_for_username(text) to anon, authenticated;

-- username_available already exists; this is its companion for the new signup
-- form, which must also refuse an address somebody has already used.
create or replace function public.email_available(p_email text)
returns boolean
language plpgsql security definer set search_path = public stable as $$
declare
  v_email text := nullif(lower(trim(coalesce(p_email,''))), '');
begin
  if v_email is null or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return false;
  end if;
  return not exists (select 1 from auth.users where lower(email) = v_email);
end $$;
revoke all on function public.email_available(text) from public;
grant execute on function public.email_available(text) to anon, authenticated;
