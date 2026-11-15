/* Mylo — Supabase project (anon/publishable key is safe in the browser) */
window.MYLO_CONFIG = {
  url: 'https://bjenyxrxbfgphnbncnwv.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZW55eHJ4YmZncGhuYm5jbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODg2MjksImV4cCI6MjEwMDM2NDYyOX0.hDr4ehJO_tZo7VXYh3Njfm6Ig0rDlYBDtDWasOecfmM',
  /* Auth uses username → synthetic email (Supabase requires a valid-looking email) */
  emailDomain: 'example.com',
  /* Web Push. The public half of the VAPID pair is meant to ship in the browser —
     it only lets the push service verify that a notification came from us. The
     private half lives in the Supabase Edge Function secrets and is never here.
     iOS delivers push only to a Home-Screen-installed PWA; in Safari itself no
     notification ever arrives, which is Apple's rule and not a bug in Mylo. */
  vapidPublicKey: 'BJ9tuHlXTfoRKtUbYP2_ktVj8V3l4j6aRCpfoUnWzOD-NrXYQbCXpsGw7SU-px-9Dn9K0CU7v_OBnxMI8JkBc4A'
};
/* Back-compat for any leftover references */
window.SEPHORA_CONFIG = window.MYLO_CONFIG;
