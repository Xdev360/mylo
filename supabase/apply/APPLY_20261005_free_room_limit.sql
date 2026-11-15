-- ============================================================
-- Mylo — APPLY THIS ONCE in the Supabase SQL editor.
-- Dashboard → your project → SQL Editor → New query → paste → Run.
--
-- Raises the free room limit from 1 to 5 while plans are hidden.
-- Pro (3), Pod (10) and the admin override (1000) are untouched.
--
-- The number becomes its own function, so changing it back later is
-- one line: select 1 instead of select 5.
--
-- Safe to re-run. Nothing is dropped and no data is touched.
-- ============================================================

begin;

create or replace function public.free_room_limit()
returns int language sql immutable as $$ select 5 $$;

comment on function public.free_room_limit() is
  'Rooms a free account may own. Raised from 1 to 5 while plans are hidden pre-launch.';

CREATE OR REPLACE FUNCTION public.my_billing_state()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  row public.profiles;
  rooms_count int;
  room_limit int;
BEGIN
  row := public.ensure_plan_state();
  SELECT count(*)::int INTO rooms_count
  FROM public.room_members rm
  JOIN public.rooms r ON r.id = rm.room_id
  WHERE rm.user_id = row.id
    AND rm.role = 'owner'
    AND rm.archived_at IS NULL
    AND r.kind = 'space';
  room_limit := CASE row.plan
                  WHEN 'pod' THEN 10
                  WHEN 'pro' THEN 3
                  ELSE public.free_room_limit()
                END;
  IF row.is_admin THEN room_limit := 1000; END IF;
  RETURN json_build_object(
    'plan', row.plan,
    'credits', row.credits,
    'plan_expires_at', row.plan_expires_at,
    'credits_reset_at', row.credits_reset_at,
    'rooms_count', rooms_count,
    'room_limit', room_limit,
    'is_admin', coalesce(row.is_admin, false)
  );
END;
$function$;

commit;

-- Check it took (expect room_limit 5 on a free account):
--   select public.my_billing_state();
