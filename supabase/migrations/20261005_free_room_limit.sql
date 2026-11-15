-- Mylo — the free room limit, in one place
--
-- Plans are hidden before launch, so Free is the only plan anyone has. One
-- room was the number because two cost money; with nothing to buy, that is
-- just a wall. It goes to five.
--
-- The number is a function rather than a literal buried in a CASE, so
-- changing it later is one line in one place and does not mean rewriting
-- my_billing_state again. Pro and Pod are untouched, and so is the admin
-- override.
--
-- Nothing else about billing moves: plan, credits, expiry and the rooms_count
-- query are exactly as they were.
--
-- Safe to re-run.

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
