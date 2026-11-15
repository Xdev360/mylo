// The Mylo project and its publishable key, as js/config.js ships them to
// every browser. Overridable, but nothing has to be set.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bjenyxrxbfgphnbncnwv.supabase.co';
export const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZW55eHJ4YmZncGhuYm5jbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODg2MjksImV4cCI6MjEwMDM2NDYyOX0.hDr4ehJO_tZo7VXYh3Njfm6Ig0rDlYBDtDWasOecfmM';

/* How many are on the list, never who: waitlist_count() is open to anon and
   returns a bare number. Null when it cannot be read. */
export async function waitlistCount(): Promise<number | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/waitlist_count`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
      body: '{}',
      cache: 'no-store'
    });
    const n = res.ok ? await res.json() : null;
    return typeof n === 'number' ? n : null;
  } catch { return null; }
}
