-- Layered avatar look (JSON) alongside legacy character string.
alter table public.profiles
  add column if not exists look jsonb;

comment on column public.profiles.look is
  'Layered avatar config: { base, eyes, mouth, accessories }. character may also encode L1/... fallback.';
