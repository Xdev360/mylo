# Mylo Chat — Figma plugin

Shared room chat on a Figma file. Each person signs in with **their own Mylo account**. The file is linked to one Mylo room so everyone in that file chats in the same thread.

## How it works

1. You install the plugin and open it on a file.
2. Sign in with Mylo (same username/password as [mylo.vercel.app](https://mylo.vercel.app)).
3. Link the file to a room (pick one of yours, or join with a code).
4. A **Mylo Chat** badge can sit on the canvas so the file shows the room is connected.
5. Your teammate opens the same file → same plugin → signs in as **herself** → same room chat, live.

Messages are stored in Mylo (Supabase), not in Figma — so they also show up in the web app / Telegram for that room.

## Install (Figma Desktop)

**Important:** import as a **Plugin**, not a Widget.  
If you use *Widgets → Import widget from manifest*, you’ll get:

`Expected "manifest.containsWidget" to have type true`

Do this instead:

1. Open **Figma Desktop**.
2. Menu → **Plugins** → **Development** → **Import plugin from manifest…**
3. Select:

   `figma-plugin/manifest.json`

4. On any file: right‑click canvas → **Plugins** → **Development** → **Mylo Chat**.

(The canvas “Mylo Chat” badge is placed by the plugin after you link a room — that’s the on-canvas marker. Full chat lives in the plugin panel so each person can sign in.)

## First-time flow (two people)

| You | Teammate |
|---|---|
| Open plugin, sign in | Open plugin on **same file**, sign in |
| Link room (or share room code) | If already linked, chat opens; else join with code |
| Send a message | Sees it live |

Both must be **members** of that Mylo room.

## Make it installable (partner can search)

See **[PUBLISH.md](./PUBLISH.md)** — publish to your **Figma team** (fast) or Community (public review).

Until you publish, only machines that imported the manifest can run it.

## Files

- `manifest.json` — plugin manifest
- `code.js` — file link + canvas badge
- `ui.html` — auth, room link, chat UI
