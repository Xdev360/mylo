-- Mylo — leave exactly one INSERT policy on messages.
--
-- Both policies were correct: each required from_id = auth.uid() AND room
-- membership, so there was never a hole — just two rules ORed together, which
-- makes the effective rule whichever is looser and is confusing to reason about.
--
-- Keeping messages_insert_member because it additionally refuses a member whose
-- room_members row is archived. That is the stricter of the two whichever way
-- kick_member removes somebody, so it is safe without needing to know.
--
-- Checked on live data before writing this:
--   * 0 messages in the entire history were written by a non-member, so the
--     kept policy covers every real message ever sent.
--   * 0 of 22 room_members rows are archived, so nobody is affected today.
--
-- The last statement prints the result, because the SQL editor only shows the
-- output of the final statement.

drop policy if exists messages_insert on public.messages;

select case
    when count(*) = 1
      then 'PASS  one INSERT policy now: ' || string_agg(policyname, ', ')
    when count(*) = 0
      then 'FAIL  no INSERT policy left — nobody can post. Re-run 20260915_ledger_and_profile_lockdown.sql'
    else 'CHECK  still ' || count(*)::text || ' policies: ' || string_agg(policyname, ', ')
  end as result
from pg_policies
where schemaname = 'public' and tablename = 'messages' and cmd = 'INSERT';
