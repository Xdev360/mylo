-- A friendly name people can change freely. `username` stays the login handle
-- (auth email is derived from it) so it must not be edited from the profile sheet.
alter table public.profiles add column if not exists display_name text;
