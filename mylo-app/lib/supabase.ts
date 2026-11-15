import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* The Mylo Supabase project, the same one the current app and the website
   use, with its publishable key (js/config.js ships the same pair). Row level
   security decides what a signed-in person can read and write. */
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bjenyxrxbfgphnbncnwv.supabase.co';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZW55eHJ4YmZncGhuYm5jbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODg2MjksImV4cCI6MjEwMDM2NDYyOX0.hDr4ehJO_tZo7VXYh3Njfm6Ig0rDlYBDtDWasOecfmM';

let client: SupabaseClient | null = null;
export function supabase() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
