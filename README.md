# Mylo

A goal app where getting things done feels like a game. You tick off tasks, show up with friends in shared rooms, keep streaks, and open a reward chest every Sunday. Your Mylo character grows with you.

**Live:** [staymylo.com](https://staymylo.com)

I'm building Mylo end to end: the product, the brand and mascot, the design system in Figma, and the code for web, iOS and Android.

## How it works

1. **Add** a task by tapping, by voice, from a goal, or with Mylo AI.
2. **Tick** it off. Ticking earns XP and marks the day as active.
3. **Show up with people.** In a room, everyone sees who showed up today and can cheer or nudge each other, and the room keeps a shared streak. Private tasks stay private.
4. **Get rewarded on Sunday.** Five active days earn a key, and the key opens the weekly chest. Chests get better week by week (wood, silver, gold) and hold outfits for your Mylo, shards and eggs that hatch into pets.
5. **Grow.** XP raises your level, from Spark to Kindle, Flame, Blaze and Beacon. Each level unlocks features like games and challenges, and badges mark milestones.

The full logic is in [mylo-app/docs/LOGIC.md](mylo-app/docs/LOGIC.md).

## What's in this repo

| Folder | What it is |
| --- | --- |
| `mylo-app/` | The app. Next.js and React as a PWA, wrapped with Capacitor for the App Store and Google Play (`ios/`, `android/`). It covers onboarding, today, goals, rooms and chat, feed, friends, rewards, chests, pets, levels, badges, games, Mylo AI, themes and widgets. |
| `site/` | The marketing site and waitlist at staymylo.com. Next.js 16, Tailwind and Resend email. |
| `supabase/` | Database schema, migrations and edge functions shared by everything. |
| `figma-plugin/` | A small Figma plugin I wrote for the design workflow. |
| `Mylo Character/` | The mascot system: personas, reactions, stickers and accessories. |
| root (`index.html`, `js/`, `api/`) | The first version of the web app, including an admin CRM, mini games, and invite and post link previews that unfurl properly in chat apps. |
| `archive/` | The previous website, kept with screenshots. |

## Design to code

Every screen is built from its Figma frame, in light and dark, from 360 to 430 px wide plus desktop. Each screen keeps its Figma code (C2, E1, CT0...) in a comment so it can be checked against the frame it came from. Design tokens come from the Figma handoff and live in `mylo-app/app/globals.css`. New features ship behind release flags.

## Stack

| | |
| --- | --- |
| Design | Figma, FigJam, custom Figma plugin |
| App | Next.js, React 19, TypeScript, Capacitor 7 (iOS and Android) |
| Site | Next.js 16, Tailwind CSS, Resend |
| Backend | Supabase (Postgres, Auth, Storage, Edge Functions, row-level security) |
| Hosting | Vercel |

## Run it

```bash
cd mylo-app && npm install && npm run dev   # app on http://localhost:3300
cd site && npm install && npm run dev       # marketing site
```

Environment variables for the site are listed in `site/.env.example`.

## Contact

Built by [Ibraheem Oladele](https://github.com/Xdev360), design engineer at [Wintech Studio](https://wintechstudio.com).
[xbigbrainnx@gmail.com](mailto:xbigbrainnx@gmail.com) · [X](https://x.com/xbigbrainnx) · [Behance](https://www.behance.net/xbigbrainnx)
