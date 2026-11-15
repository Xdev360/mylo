import { NextResponse } from 'next/server';
import { z } from 'zod';
import { BUG_PAGE } from '@/lib/content';
import { ANON_KEY, SUPABASE_URL } from '@/lib/supabase';

/* POST /api/bug  { area, detail, username? }

   Files the report through file_bug_report(), the Supabase function the
   previous site's form called (migration 20260917), so nothing new has to
   exist in the database. It is SECURITY DEFINER, it throttles to 40 an hour
   across the site, and it returns the report's reference. The device info the
   form promises is this request's user agent. A username is how a confirmed
   report gets paid: the function matches it to an account, and takes one it
   cannot match without paying it. */

export const runtime = 'nodejs';

/* The app (app.staymylo.com, beta.staymylo.com, mylo.vercel.app) files reports here too, from
   its own origin, so those origins may call this route from a browser. */
const APP_ORIGINS = new Set(['https://app.staymylo.com', 'https://beta.staymylo.com', 'https://mylo.vercel.app', 'https://mylo-app-xdev360s-projects.vercel.app', 'http://localhost:3300']);
function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') || '';
  return APP_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'content-type', Vary: 'Origin' }
    : {};
}
export function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req) });
}
export const dynamic = 'force-dynamic';

const Body = z.object({
  area: z.enum(BUG_PAGE.areas as [string, ...string[]]),
  detail: z.string().trim().min(15).max(2000),
  // A malformed name is dropped, not held against the report.
  username: z.string().trim().regex(/^@?[A-Za-z0-9_.-]{1,20}$/).optional().catch(undefined),
  company: z.string().optional()                // the honeypot
});

export async function POST(req: Request) {
  let raw: unknown;
  try { raw = await req.json(); } catch { return NextResponse.json({ error: 'bad request' }, { status: 400, headers: cors(req) }); }

  // A filled honeypot is a bot. Answer exactly as success so it learns nothing.
  const trap = (raw as { company?: unknown } | null)?.company;
  if (typeof trap === 'string' && trap.trim() !== '') return NextResponse.json({ status: 'ok', ref: '' }, { headers: cors(req) });

  const parsed = Body.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400, headers: cors(req) });
  const { area, detail, username } = parsed.data;

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/file_bug_report`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON_KEY, authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({
        p_username: username || null, p_area: area, p_kind: 'bug', p_detail: detail,
        p_agent: (req.headers.get('user-agent') || '').slice(0, 200) || null
      }),
      cache: 'no-store'
    });
    if (!res.ok) {
      const why = await res.text().catch(() => '');
      if (/a lot of reports|too many reports/.test(why)) return NextResponse.json({ error: 'slow down' }, { status: 429, headers: cors(req) });
      console.error('bug report rpc failed', res.status, why);
      return NextResponse.json({ error: 'could not save' }, { status: 502, headers: cors(req) });
    }
    const ref = await res.json().catch(() => '');
    return NextResponse.json({ status: 'ok', ref: typeof ref === 'string' ? ref : '' }, { headers: cors(req) });
  } catch (err) {
    console.error('bug report error', err);
    return NextResponse.json({ error: 'could not save' }, { status: 502, headers: cors(req) });
  }
}
