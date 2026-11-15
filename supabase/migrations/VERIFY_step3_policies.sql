-- Read-only. Shows both INSERT policies on messages, and tests the NEW policy
-- against every message ever written. If no row has an author who is not a
-- current member of that room, the new policy would have allowed all of them —
-- which means dropping the old one is safe.

with pol as (
  select policyname, roles::text as roles, coalesce(with_check, '(no with_check)') as rule
  from pg_policies
  where schemaname = 'public' and tablename = 'messages' and cmd = 'INSERT'
),
orphans as (
  select count(*)::int as n
  from public.messages m
  where not exists (
    select 1 from public.room_members rm
    where rm.room_id = m.room_id
      and rm.user_id = m.from_id
      and rm.archived_at is null)
)
select 1 as step, 'POLICY  ' || policyname as item, roles as applies_to, rule as detail
from pol
union all
select 2,
  'SAFETY CHECK  messages whose author is not a current member of that room',
  (select n from orphans)::text || ' row(s)',
  case when (select n from orphans) = 0
       then 'SAFE — the new policy covers every message ever written'
       else 'STOP — the new policy would have blocked these, send me this number'
  end
order by step, item;
