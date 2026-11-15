-- Mylo — the room limit as it stands in the database today
--
-- Neither of these functions was ever checked in: they were applied directly
-- and have lived only in the database since. This file is a transcription of
-- what `pg_get_functiondef` returns right now, so the repo and the database
-- agree before anything changes them. It introduces nothing and alters
-- nothing — running it reinstates exactly what is already there.
--
-- The limit itself is the one CASE in my_billing_state:
--
--     free 1 · pro 3 · pod 10 · admin 1000
--
-- can_create_room only compares that number against how many spaces you own.
--
-- Safe to re-run.

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
  room_limit := CASE row.plan WHEN 'pod' THEN 10 WHEN 'pro' THEN 3 ELSE 1 END;
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

CREATE OR REPLACE FUNCTION public.can_create_room()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  st json;
BEGIN
  st := public.my_billing_state();
  IF (st->>'is_admin')::boolean THEN
    RETURN json_build_object('ok', true, 'state', st);
  END IF;
  IF (st->>'rooms_count')::int >= (st->>'room_limit')::int THEN
    RETURN json_build_object('ok', false, 'reason', 'room_limit', 'state', st);
  END IF;
  RETURN json_build_object('ok', true, 'state', st);
END;
$function$;
