-- ============================================================
-- Mylo: the waitlist in the admin panel. Paste into the Supabase SQL editor
-- and Run. Adds one read-only function and changes nothing else.
-- Safe to re-run.
-- ============================================================

-- The table stays locked: only a signed-in admin gets rows back, the same
-- check the Bugs tab uses. Newest signup first.
create or replace function public.admin_list_waitlist(p_limit int default 1000)
returns table (
  email text, created_at timestamptz, source text, referrer text,
  ref_code text, referrals bigint, invited_at timestamptz
)
language sql security definer set search_path = public stable as $$
  select w.email, w.created_at, w.source, w.referrer, w.ref_code,
         (select count(*) from public.waitlist r where r.referred_by = w.ref_code),
         w.invited_at
    from public.waitlist w
   where public.is_app_admin()
   order by w.created_at desc
   limit least(greatest(coalesce(p_limit, 1000), 1), 5000);
$$;
revoke all on function public.admin_list_waitlist(int) from public;
grant execute on function public.admin_list_waitlist(int) to authenticated;
