# How Mylo works

The logic of the whole app, from the Figma handoff ("App · Developer handoff") and the
screens, checked against what is built. Where something can't work yet, it says why.

## The one loop everything hangs on
1. **Plan the day.** Today (C2) holds what you will do today: tasks (a time or not),
   to-dos (no time), and the day's instances of your systems (repeating goals). You add
   with the centre + (D1), by voice (D2), from a goal (D3), or with Mylo AI (AI1, AI5).
2. **Tick.** Ticking is the core action (C3): it counts toward today's progress, earns XP,
   and marks the day **active**.
3. **Show up with people.** In a room (Chats, CT1) everyone sees who showed up today
   (RP1), can cheer or nudge, and keeps a shared streak. Private tasks stay private (RP4).
4. **Get rewarded on Sunday.** 5 active days in a week earn a **key**; on Sunday the key
   opens the **chest** (wood weeks 1-2, silver week 3, gold from week 4; a missed week drops
   one level). Chests give cards (Mylo outfits), shards (5 = any card), and from gold, eggs
   that hatch into pets after 5 more active days.
5. **Grow.** XP raises your **level** (Spark, Kindle, Flame, Blaze, Beacon…). Levels open
   features (games and challenges at Flame, and so on) and give streak freezes. Badges
   mark milestones. Your profile shows all of it to friends.

Everything else in the app feeds this loop: goals break big things into the daily ticks,
Mylo AI drafts them, rooms add the people, games and the feed are where you spend time
together, and rewards are the reason to come back.

## Who decides what
- **The device** decides only what you see and what you type.
- **The server decides the numbers that matter** (handoff §7): XP, levels, streaks, keys,
  chests and what they drop, and which features are open. Otherwise anyone could give
  themselves a gold chest. Today the app computes keys, streak and chest results on the
  device because there is no server logic for them yet; the code keeps one place where the
  server's answer will plug in (`lib/rewards.ts` `useXp()`, `lib/apps.ts` gates).
- **Supabase** is the server: accounts (email code, password, Google), the `profiles`
  table, rooms, members and messages (the current app already has them), the `mylo`
  function for Mylo AI, waitlist and bug reports.

## The parts, and how they connect
| Part | What it is | Connects to |
|---|---|---|
| Sign-in and onboarding (O, X, S1) | Account, age check (13+), what you want, best time, your Mylo, first goal | Profile, Today (first goal lands there) |
| Today (C2, O17) | The day: progress, quick to-dos, up next | Goals, rooms (people ahead of you), rewards (active day) |
| Goals (E1-E3, D3) | Goals with steps, systems that repeat, calendar | Today (each day's instances), AI drafts |
| Mylo AI (AI1-AI10) | Talk or type, Mylo drafts plans; 10 messages a day | Adds to Today/Goals only when you tap Add |
| Rooms and chats (CT, LB, B) | Small private groups by code or invite | Today (room progress), games, cheers, feed |
| Feed and friends (VF, FR, RP) | Posts, quotes, reactions; friends; room people | Rooms, profile |
| Apps (LX1) | Hub of everything beyond the day | Games, challenges, habits, Mylo's place |
| Games (G) and challenges (CH) | Chess, Scrabble, Colour Rush, Chance; dares | Rooms (invites), rewards (download a win) |
| Mylo's world (EG, PT, H, K, PH, M, MS, T, WG) | Your Mylo, its house, pets, photos, looks, themes | Rewards (cards, eggs), friends (visits) |
| Rewards (U, L, XT, SH) | Keys, chest, cards, levels, badges, streak, XP | Everything that counts as showing up |
| Profile (P) | You, as friends see you; your room | Rewards, goals, friends |
| Settings and system (ST, S) | Account, privacy, data, install, offline, errors | Supabase auth |

## What is feasible now, and what is not
**Works now, on one device:** the whole loop for one person: plan, tick, streak, keys,
chest, cards, eggs, pets, levels shown at the start, goals, journal, focus timer, games
against Mylo, Mylo's world, profile, settings, and sign-in with real accounts.

**Needs the server before it's real:**
1. **Rooms, chats, feed, friends between people.** They save on the device today, so two
   people can't see each other. Move them to Supabase (the tables exist) with Realtime for
   live messages. This is the biggest piece and the one that makes Mylo social.
2. **XP, levels, keys and chests on the server**, so rewards can't be faked and follow you
   across devices. Needs a few database functions (grant XP on tick, close the week on
   Sunday, open a chest) that the app calls instead of its local maths.
3. **Today and goals synced to the account**, so the phone and the desktop show the same day.
4. **Mylo AI**: the `mylo` function fails right now (546 WORKER_RESOURCE_LIMIT, likely the
   AI call hanging). It needs fixing in `supabase/functions/mylo`.
5. **Account deletion**: needs a `request_account_deletion` database function.
6. **Push notifications** (morning, evening wrap, cheers): need the service worker and, in
   the store apps, APNs/FCM keys.
7. **Email**: confirmation and alerts need the Resend key and the domain verified in Resend.

**Not realistic on the web alone:** blocking screenshots for view-once photos; home and lock
screen widgets (WG1-WG2) need the store apps; phone calls in rooms are not designed.

## Milestones (the handoff's release flags)
| Flag | When | What opens |
|---|---|---|
| `launch1` | Launch, 3 December | Flows 01-09: onboarding, Today, goals, Mylo AI, rooms and chat, profile, Sunday chest, notifications and settings, locks |
| `u1_1` | Week 3 (Flame) | Games hub, chess, Chance, challenges and dares |
| `u1_2` | Month 2 (Blaze) | Eggs, pets, room editor, backgrounds, shards |
| `u1_3` | Month 3 (Beacon) | Vibe feed, Scrabble, Colour Rush, find a room |
| `u2_0` | Month 4 | House, visits, photo studio, gifting |
| `u2_1` | Month 6 | Widgets, themes, app icon picker |

All of them are built. At the owner's request every flag is on (`GATES_ON = false` in
`lib/apps.ts`); turning the gates back on brings the staged rollout back without code changes.

## Order of work from here
1. Rooms, chats and friends on Supabase with Realtime (people can finally talk).
2. Today and goals synced to the account.
3. XP, keys and chests as database functions; the app reads them.
4. Fix the Mylo AI function; add account deletion.
5. Push notifications; then the store builds (see `STORES.md`).
