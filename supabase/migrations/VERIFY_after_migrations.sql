-- Mylo — verification. Read-only: this changes nothing.
-- ONE query on purpose: the Supabase SQL editor only shows the result of the
-- LAST statement, so four separate statements hid the three that mattered.
-- Select all, Run, and read the four rows.

with cols as (
  select c.column_name,
         has_column_privilege('authenticated', 'public.profiles', c.column_name, 'UPDATE') as writable
  from information_schema.columns c
  where c.table_schema = 'public' and c.table_name = 'profiles'
),
leaky as (
  select column_name from cols
  where writable and column_name in ('username','plan','credits','is_admin','plan_expires_at')
),
allowed as (select column_name from cols where writable),
pol as (
  select policyname from pg_policies
  where schemaname = 'public' and tablename = 'messages' and cmd = 'INSERT'
)
select 1 as step, 'ledger trigger' as item,
  case when exists (
         select 1 from pg_trigger t
         join pg_class c on c.oid = t.tgrelid
         where c.relname = 'messages'
           and t.tgname = 'messages_payload_guard'
           and not t.tgisinternal)
       then 'PASS  messages_payload_guard is attached'
       else 'FAIL  missing — re-run 20260915_ledger_and_profile_lockdown.sql'
  end as result

union all
select 2, 'profile column locks',
  case
    when exists (select 1 from leaky)
      then 'FAIL  users can still edit: ' || (select string_agg(column_name, ', ' order by column_name) from leaky)
    when not exists (select 1 from allowed)
      then 'WARN  authenticated cannot update ANY profile column — editing your look will fail'
    else 'PASS  limited to: ' || (select string_agg(column_name, ', ' order by column_name) from allowed)
  end

union all
select 3, 'messages INSERT policies',
  case (select count(*) from pol)
    when 0 then 'FAIL  no insert policy — nobody can post at all'
    when 1 then 'PASS  exactly one: ' || (select policyname from pol)
    else 'FAIL  ' || (select count(*) from pol)::text || ' policies, and they OR together so the loosest wins: '
         || (select string_agg(policyname, ', ' order by policyname) from pol)
         || '   → drop the old one with:  drop policy "NAME" on public.messages'
  end

union all
select 4, 'message indexes',
  case when (select count(*) from pg_indexes
             where schemaname = 'public' and tablename = 'messages'
               and indexname in ('messages_room_created','messages_room_kind')) = 2
       then 'PASS  both present'
       else 'WARN  missing one — room loads will be slower'
  end
order by step;
