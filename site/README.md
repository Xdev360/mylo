# Mylo website

The marketing site and waitlist for Mylo at www.staymylo.com, built from the
Figma page "Mylo · Launch" (file `V9DfX3Oc3FSM9T9P9YYb7X`). Next.js 16 (App
Router), TypeScript, Tailwind, the existing Supabase waitlist, Resend for its
email, deployed on Vercel.

It replaced the previous site in this same folder, on the same Vercel project
and domain. That site is kept, with screenshots of every page, in
[`archive/website-v1`](../archive/website-v1).

## Run it

```bash
cd site
npm install
cp .env.example .env.local     # then fill it in (see below)
npm run dev                    # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the build
npm run lint       # ESLint (eslint-config-next)
npx tsc --noEmit   # type check
```

The site runs without any env variables, and the waitlist works without them
too: it uses the Mylo Supabase project's publishable key, the one the app
already ships to every browser. Signing up locally therefore adds a real row
to the real list.

## Environment variables

All of them are in `.env.example` with comments.

| Name | Where it is used | Needed |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `/api/waitlist`, to point at another Supabase project | no, defaults to Mylo's |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the same, that project's publishable key | no, defaults to Mylo's |
| `RESEND_API_KEY` | the confirmation email | no: without it signups save and no email is sent |
| `BREVO_API_KEY` | fallback sender when `RESEND_API_KEY` is not set; staymylo.com is already authenticated with Brevo | no |
| `WAITLIST_NOTIFY_EMAIL` | where the alert for each new signup goes, default `hello@staymylo.com` | no. Needs `RESEND_API_KEY` (or `BREVO_API_KEY`) |
| `WAITLIST_FROM_EMAIL` | the email's From line, default `Mylo <hello@staymylo.com>` | no. The domain must be verified in Resend |
| `LAUNCHED` | launch day switch, `false` until 3 December | no, defaults to `false` |
| `FIGMA_TOKEN` | `scripts/pull-figma-assets.mjs` only | no |

## The waitlist

- `POST /api/waitlist` with `{ email, ref?, referrer? }`. It validates with
  zod, then calls `join_waitlist_v2()`, the Supabase function the previous
  site called: it lowercases and de-dupes the email, stores the source
  (`site`), the referrer and who referred them, and returns the signup's
  referral code. Five requests per IP per hour, plus a hidden honeypot field.
  No captcha.
- The function returns the same code for an address it already has. The
  browser keeps its own code (under the previous site's key, so people who
  joined there are recognised), and getting it back again shows the
  "already on the list" state.
- `?ref=CODE` on any page is remembered and sent with the signup. Links
  shared from the previous site (`www.staymylo.com/?ref=CODE`) keep working.
- The confirmation email ("Email · Waitlist confirmation", 1108:641) is in
  `lib/waitlist-email.ts`: table-based, 600 wide, light only, with the
  person's referral link.

### Database

Nothing to run. The table, `join_waitlist_v2()` and the `waitlist_queue` view
come from `supabase/migrations/20260904_waitlist.sql` and
`20260916_waitlist_referrals.sql`, already applied for the previous site.
Read the list with `select * from waitlist_queue;`.

`20261031_waitlist.sql` and `20261101_waitlist_site_columns.sql` were written
for an earlier version of this site that wrote with the service role. The
site no longer needs them; they are additive if they are ever run.

## Deploy

Nothing to set up. The Vercel project `mylo-2ack` already serves
`www.staymylo.com` (the apex redirects to it) from this repository with
**Root Directory** `site`, and production tracks `main`. That project was
made for the previous, static site, so `vercel.json` here tells it this is
Next.js (framework, install, build and output), whatever its dashboard says.
A push to `main` that changes `site/` deploys it.

The app is a separate project (`mylo`, app.staymylo.com and
mylo.vercel.app, from the repository root) and is not affected.

Optional: for the confirmation email, add `RESEND_API_KEY` to `mylo-2ack`
and verify `staymylo.com` in Resend. Without it, signups save and no email
goes out, as before.

Canonical URLs, the sitemap and robots point at `https://www.staymylo.com`.
`/og.png`, the previous share card, is still served because `play.html` in
the app uses it as its preview image. `/community` redirects home.

## Flip LAUNCHED on 3 December

1. In Vercel, set `LAUNCHED` to `true` for Production.
2. Redeploy (Deployments, then the latest, then Redeploy). The value is read
   at build time, so a redeploy is what applies it.

That swaps in the launch-day hero and closing CTA: the eyebrow becomes
"NOW OPEN · FREE ON THE WEB", the main buttons become "Open Mylo" and link
to app.staymylo.com, the email field goes, and the sidebar's "Join the
waitlist" becomes "Open Mylo" with the "Already in the waitlist" block
removed. Set it back to `false` and redeploy to undo.

## Where things are

| Path | What |
|---|---|
| `lib/content.ts` | every word on the site, each block naming its Figma frame |
| `app/globals.css` | tokens (light and dark) and every section's styles |
| `components/Shell.tsx` | sidebar, top bar, menu and sheet |
| `components/PlaygroundBoard.tsx`, `components/Playground.tsx` | the play board and the drag/throw hook |
| `app/api/waitlist/route.ts` | the waitlist API |
| `public/figma/` | art, icons and photos exported from Figma |

## Analytics

Vercel Analytics, loaded only on Vercel. Events: page views (automatic),
`cta_click` with the button's name, `waitlist_submit`, and
`waitlist_success` with `new` or `already`. No email or other personal data
goes into an event.
