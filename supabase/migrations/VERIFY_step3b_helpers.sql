-- Read-only. One question decides which policy to keep:
-- does kicking someone set archived_at (a soft removal), and does
-- is_room_member() ignore archived_at? If both are true, a kicked member can
-- still post under the OLD policy, and the new one is the one worth keeping.

select 1 as step, 'is_room_member() source' as item,
       pg_get_functiondef(p.oid) as detail
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'is_room_member'

union all
select 2, 'kick_member() source', pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'kick_member'

union all
select 3, 'archived memberships right now',
       (select count(*) from public.room_members where archived_at is not null)::text
       || ' of ' || (select count(*) from public.room_members)::text || ' rows'
order by step;
