> **Archived 1 November 2026.** This was www.staymylo.com from September to
> November 2026. It was replaced by the Figma rebuild, which now lives in
> `site/` and deploys from the same Vercel project (`mylo-2ack`). Nothing here
> is deployed any more. `screens/` has full-page captures of every page at
> desktop (1440) and mobile (390), taken before the switch. To look at it
> again, open `index.html` in a browser; it has no build step. Paths below
> say `site/` because that is where it lived.

# Mylo — marketing site

> **Sept 2026 — black-glass redesign.** `index.html` is now the black & white
> glassmorphism waitlist page (all CSS/JS inline, Lucide icons and the Mylo
> character set as inline SVG, one rAF scroll engine for parallax / scrub /
> pin / reveals). The previous light page lives in git history only — it was
> deleted because it shipped with public "Open app" links. Waitlist wiring
> below is unchanged.

One self-contained landing page with a waitlist, deployed separately from the
app so nothing here can break the app.

**Nothing in this folder may link into the app.** Testers get the app link by
email. Before shipping, check: `grep -rn "app.staymylo.com\|mylo.vercel.app" site/`
should return nothing but this line.

```
site/
  index.html    the whole site — CSS and JS inline, no build step, no images
  favicon.svg
  vercel.json
  README.md
```

## 1. Create the waitlist table

Run `supabase/migrations/20260904_waitlist.sql` against the Mylo Supabase
project (SQL editor, or `supabase db push`). It creates:

- `public.waitlist` — RLS on, **no anon policies**, so the publishable key can
  never read the list back.
- `join_waitlist(p_email, p_source, p_referrer)` — `security definer`, granted
  to `anon`. Validates, lowercases, de-dupes on conflict.
- `waitlist_count()` — a count with no addresses attached.

Read signups from the SQL editor:

```sql
select email, source, created_at from public.waitlist order by created_at desc;
```

## 2. Deploy

New Vercel project, root directory `site/`, no build command. Point your
marketing domain at it and leave `mylo.vercel.app` on the app project.

> `MYLO_SITE` in `js/app.js` is now `https://staymylo.com`.

## No public link into the app (Sept 16)

The site deliberately contains **no link to the running app**. Testers get the
link by email after they join the waitlist — that is the only way in, so the
list stays the gate. Three links were removed: the hero "See it running", the
contact card "Open the app", and the footer Product nav "Open the app". If you
add a CTA later, do not point it at the app. (Re-checked during the staymylo.com
domain pass on Sept 16 — the three links were briefly reintroduced and removed
again. The page's only outbound requests are the Inter font and `waitlist_count`.)

## Where the content comes from

Every mockup on this page is a redraw of a real screen, and the copy is taken
from the source rather than invented. If you change any of the following in the
app, change it here too:

| App source | Used on the site for |
|---|---|
| `css/styles.css` `:root` | the whole colour system, light and dark |
| `assets/characters/mylo.svg` | the mascot, inlined as an SVG symbol |
| `PLAN_PERKS`, `BILLING_SKUS` (`app.js`) | plan bullets and every price |
| `MINI_APPS` (`app.js`) | the Apps hub tiles, glyphs and hex colours |
| `MYLO_CAT_HINTS` (`app.js`) | category names and colours in the mockups |
| `THEME_FAMILIES` (`app.js`) | the seven theme swatches |
| `ONBOARD_CHARS` (`app.js`) | the seven persona names |
| `ACHIEVEMENT_BADGES` (`app.js`) | badge names and colours |
| `emptyToday()`, `emptyGoals()` (`app.js`) | empty-state copy, verbatim |

## Deliberate accuracy calls

These were checked against the code and are stated the way the app actually
behaves — don't "fix" them back:

- **Journal and WeSub sit under Coming soon**, not Room tools. They are
  `ready: true` in `MINI_APPS` but `openMiniApp()` has no branch for either, so
  tapping them does nothing. Milestones is the only working room tool.
- **Integrations are under You → Connect**, not the Apps hub. The Apps hub is
  games and room tools only.
- **The privacy FAQ says personal goals are visible under Goals → Everyone and
  on the calendar** — only Today filters them out. Saying otherwise would have
  been false.
- **Badges are described as a shelf, not as earned.** `loadBadgeDemo()` seeds a
  fixed set; there is no achievement engine wired to real streaks yet.
- **WhatsApp carries a dagger footnote** on the Pro bullet, because the
  integration renders as "Coming soon" while `configured === false`.

## Notes

- The anon key in `index.html` is the same publishable key the app ships in
  `js/config.js`. With the RLS setup above it can only call the insert RPC.
- No external requests except the Inter webfont. The mascot, every icon and
  every product mockup is inline SVG/CSS.
- Reveal animations are JS-gated (`html.js`), so the page renders fully if the
  script never runs. All motion respects `prefers-reduced-motion`.
- Verified: no horizontal overflow from 320px to 1440px, no console errors,
  light and dark both painted explicitly.

## Sept 16 additions

- **`og.png`** — 1200×630 share card. `og:image` / `twitter:image` are absolute,
  because WhatsApp and X don't run JS. They point at `https://www.staymylo.com/og.png?v=2`
  — **www, not the apex**, since the apex 308s to www and not every scraper follows a
  redirect for an image. If the domain ever changes, those two lines change with it.
  See "The share card" at the bottom for how the artwork is generated.

## Domains

| | Vercel project | Root Directory | Domain |
|---|---|---|---|
| Site | new project, same repo | `site` | `staymylo.com` + `www.staymylo.com` |
| App  | `mylo` (existing) | repo root | `app.staymylo.com` (keeps `mylo.vercel.app`) |

Both deploy from the same push to `main`. Baked into the code: `og:image`/`twitter:image`
here, `MYLO_SITE` in `js/app.js` (the in-app "Top up credits" / "Upgrade" link), the Plan
footnote, and `hello@staymylo.com` everywhere. Invite links use `location.origin`, so they
follow whatever host the app is served from — nothing to change there.

**After the DNS is live, also update, or sign-in and integrations break:**
- Supabase → Authentication → URL Configuration: Site URL + Redirect URLs → `https://app.staymylo.com`
- Google Cloud Console → OAuth client → Authorized redirect URIs (Calendar + Google sign-in)
- Notion integration → redirect URI
- Registrar → email forwarding for `hello@staymylo.com`
- `supabase functions deploy` to pick up the new fallback origins in `supabase/functions/*`
- **Referrals** — apply `supabase/migrations/20260916_waitlist_referrals.sql`. The form calls
  `join_waitlist_v2` (returns the signup's ref code → share links `?ref=CODE` for WhatsApp / X /
  copy) and falls back to the old `join_waitlist` if the RPC isn't there yet. Read the queue with
  `select * from waitlist_queue;` (referrals desc, then oldest first).
- **Privacy / Terms** — in-page modals (`#privacy`, `#terms`), plain-English drafts. Get them
  reviewed before payments go live.
- **Rewards** — no naira figure anywhere. Copy is "Season 1 is counting" + "10% of revenue,
  published monthly" + top-10 weekly get a month of Pro. Cash only from the pool, after the
  XP ledger is server-side (see the comment in `20260915_ledger_and_profile_lockdown.sql`).
- **Open rooms** — the Rooms section has a directory card. The app side is wired in
  `js/app.js` (`openBrowseSheet`, `saveRoomListing`) and `index.html` (`#browse-sheet`, the
  "Open to requests" switch in room settings) and needs `20260916_room_directory.sql` applied;
  until then every call degrades to a "coming right after launch" toast.

## Report a bug (Sept 17)

Section `#bug` on the site, linked from the footer. Testers pick an area, describe
what happened, and give their Mylo username. **100 $MYL per confirmed report.**

- Migration: `supabase/migrations/20260917_bug_reports.sql`
  (one-paste copy at `supabase/apply/APPLY_20260917_bugs.sql`).
- Same lockdown as the waitlist: RLS on, **no anon policies**, writes only through
  `file_bug_report()` (SECURITY DEFINER). The publishable key can file a report and
  can never read the queue back.
- The RPC resolves the username against `profiles`, so `can_pay` in the queue tells
  you whether the 100 $MYL can actually be sent. An unmatched name is still accepted.
- Throttled: 5/hour per named tester, 40/hour site-wide. Minimum 15 characters of
  detail. Browser UA is captured — it is usually the fastest clue.
- Triage: `select * from bug_queue;` — confirmed-and-unpaid float to the top.
  After you grant the $MYL in the app, run `select mark_bug_paid('BUG-XXXXX');`.
- Every reporter gets a `BUG-XXXXX` reference on screen to quote back at you.

## The share card (og.png)

`site/og.png` is 1200x630 and is **generated, not screenshotted**. The old one was
a crop of the hero section: it carried a clipped inner card border, a cut-off
"Waitlist open" pill, and a three-line paragraph that turned to grey mush at the
~300px WhatsApp renders previews at.

Source: `docs/og-card.html` (self-contained, reuses the same inline character
SVGs as this page). To change it:

```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
  --disable-gpu --hide-scrollbars --force-device-scale-factor=2 \
  --window-size=1200,630 --virtual-time-budget=9000 \
  --screenshot=og-2x.png "file://$PWD/docs/og-card.html"
sips -z 630 1200 og-2x.png --out site/og.png
```

Rendering at 2x and downsampling is what keeps the type crisp. After changing the
artwork, **bump `?v=` on `og:image` and `twitter:image`** — WhatsApp and X cache
the old image against the old URL and will not re-fetch on their own.

Check the result at 300px wide before shipping. If the headline isn't readable
there, it isn't readable in a chat.
