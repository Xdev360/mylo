-- WhatsApp accounts (Cloud API / free service window)
create table if not exists public.whatsapp_accounts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  wa_id text not null unique,
  phone_e164 text,
  profile_name text,
  connected_at timestamptz not null default now(),
  last_inbound_at timestamptz,
  last_message_at timestamptz,
  reminders_enabled boolean not null default true,
  timezone text not null default 'Africa/Lagos',
  remind_minutes_before integer not null default 15
);

create table if not exists public.whatsapp_link_codes (
  code text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_link_codes_user_idx on public.whatsapp_link_codes(user_id);

create table if not exists public.whatsapp_reminder_log (
  goal_id uuid not null references public.goals(id) on delete cascade,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (goal_id, kind)
);

alter table public.whatsapp_accounts enable row level security;
alter table public.whatsapp_link_codes enable row level security;
alter table public.whatsapp_reminder_log enable row level security;

drop policy if exists whatsapp_accounts_select_own on public.whatsapp_accounts;
create policy whatsapp_accounts_select_own on public.whatsapp_accounts
  for select to authenticated using (user_id = auth.uid());

drop policy if exists whatsapp_link_codes_select_own on public.whatsapp_link_codes;
create policy whatsapp_link_codes_select_own on public.whatsapp_link_codes
  for select to authenticated using (user_id = auth.uid());

create or replace function public.my_whatsapp_status()
returns json
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  row public.profiles;
  acc public.whatsapp_accounts;
  plan_ok boolean;
  configured boolean;
  display_number text;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  row := public.ensure_plan_state();
  plan_ok := coalesce(row.is_admin, false) or row.plan in ('pro', 'pod');
  select * into acc from public.whatsapp_accounts where user_id = row.id;
  select exists(
    select 1 from public.app_secrets where key = 'WHATSAPP_TOKEN'
  ) and exists(
    select 1 from public.app_secrets where key = 'WHATSAPP_PHONE_NUMBER_ID'
  ) into configured;
  select value into display_number from public.app_secrets where key = 'WHATSAPP_DISPLAY_NUMBER' limit 1;
  return json_build_object(
    'connected', acc.user_id is not null,
    'configured', coalesce(configured, false),
    'plan_ok', plan_ok,
    'plan', row.plan,
    'phone_e164', acc.phone_e164,
    'profile_name', acc.profile_name,
    'reminders_enabled', coalesce(acc.reminders_enabled, true),
    'remind_minutes_before', coalesce(acc.remind_minutes_before, 15),
    'timezone', coalesce(acc.timezone, 'Africa/Lagos'),
    'connected_at', acc.connected_at,
    'last_inbound_at', acc.last_inbound_at,
    'last_message_at', acc.last_message_at,
    'display_number', display_number,
    'service_window_open', case
      when acc.last_inbound_at is null then false
      else acc.last_inbound_at > now() - interval '24 hours'
    end
  );
end;
$function$;

grant execute on function public.my_whatsapp_status() to authenticated;
