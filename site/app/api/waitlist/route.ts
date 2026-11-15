import { NextResponse } from 'next/server';
import { z } from 'zod';
import { EMAIL_SUBJECT, waitlistEmailHtml, waitlistEmailText } from '@/lib/waitlist-email';
import { mailReady, sendMail } from '@/lib/mail';
import { ANON_KEY, SUPABASE_URL, waitlistCount } from '@/lib/supabase';

/* ──────────────────────────────────────────────────────────────────────────
   POST /api/waitlist  { email, ref?, referrer? }

   Joins the list through join_waitlist_v2(), the same Supabase function the
   previous site called (migrations 20260904 and 20260916), so nothing new has
   to exist in the database:
     · it trims, lowercases and de-dupes the email
     · it returns the signup's referral code, the existing one for someone
       already on the list, so a share link never changes
     · a ?ref=CODE only counts when it belongs to someone on the list
   It is SECURITY DEFINER and granted to anon, and the table has no anon
   policy, so the publishable key can add a signup and never read the list.

   Every signup lands in public.waitlist; the admin panel's Waitlist tab
   lists them (admin.html, supabase/apply/APPLY_20261102_waitlist_admin.sql).

   On top of that: zod, 5 per IP per hour, a honeypot and, once email is set
   up (lib/mail.ts), the confirmation and an alert to the team, both only for
   a new signup: joining twice never sends a second email.
   ────────────────────────────────────────────────────────────────────────── */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NOTIFY = process.env.WAITLIST_NOTIFY_EMAIL || 'hello@staymylo.com';

const Body = z.object({
  email: z.string().trim().toLowerCase().max(254).email(),
  // A malformed code is dropped, not held against the signup.
  ref: z.string().trim().max(12).regex(/^[A-Za-z0-9]*$/).optional().catch(undefined),
  referrer: z.string().max(255).optional().catch(undefined),
  company: z.string().optional()                // the honeypot
});

const LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

/* In-memory and therefore per-instance: it stops a script hammering one
   warm function, not a determined attacker across a fleet. The honeypot and
   the function's own de-dupe are what actually keep the table clean; this is
   the cheap first wall the handoff asks for. */
const hits = new Map<string, number[]>();
function overLimit(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.clear();          // never grow without bound
  return recent.length > LIMIT;
}

/* Who joined, and how long the list is now. */
function alertTeam(email: string, code: string, ref: string | undefined, total: number | null) {
  return sendMail({
    to: NOTIFY,
    subject: `New waitlist signup: ${email}`,
    text: [
      `${email} just joined the Mylo waitlist.`,
      total !== null ? `Total on the list: ${total}` : '',
      `Their referral code: ${code}`,
      ref ? `Referred by code: ${ref}` : ''
    ].filter(Boolean).join('\n')
  });
}

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400 }); }

  // A filled honeypot is a bot. Answer exactly as success so it learns nothing.
  const trap = (raw as { company?: unknown } | null)?.company;
  if (typeof trap === 'string' && trap.trim() !== '') {
    return NextResponse.json({ status: 'ok' });
  }

  const parsed = Body.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid email' }, { status: 400 });
  }
  const { email, ref, referrer } = parsed.data;

  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (overLimit(ip)) {
    return NextResponse.json({ error: 'slow down' }, { status: 429 });
  }

  try {
    // The function does not say whether the address was new, but the count does.
    const before = await waitlistCount();
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/join_waitlist_v2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ p_email: email, p_source: 'site', p_referrer: referrer || null, p_ref: ref || null }),
      cache: 'no-store'
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      // The function raises on an address it does not accept.
      if (/invalid email|email required/.test(detail)) return NextResponse.json({ error: 'invalid email' }, { status: 400 });
      console.error('waitlist rpc failed', res.status, detail);
      return NextResponse.json({ error: 'could not save' }, { status: 502 });
    }
    const code = await res.json().catch(() => null);
    const refCode = typeof code === 'string' ? code : '';
    const after = await waitlistCount();
    // Unknown counts the signup as new: better one extra email than none.
    const isNew = before === null || after === null || after > before;

    let emailed = false;
    if (isNew && refCode && mailReady) {
      const [sent] = await Promise.all([
        sendMail({ to: email, subject: EMAIL_SUBJECT, html: waitlistEmailHtml(refCode), text: waitlistEmailText(refCode), unsubscribe: true }),
        alertTeam(email, refCode, ref, after)
      ]);
      emailed = sent;
    }
    return NextResponse.json({ status: 'ok', code: refCode, joined: isNew ? 'new' : 'already', emailed });
  } catch (err) {
    console.error('waitlist error', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502 });
  }
}
