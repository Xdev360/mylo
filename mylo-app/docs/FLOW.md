# Flow and logic pass: make it feel like one app, not a slideshow

The owner's words: pages are built, but moving through them feels like a slideshow of
Figma frames. Some layouts overlap or don't align as designed, font sizes are off, and
small logic is missing (example: the birthday wheels should loop forever, January after
December, day 1 after 31, years too). He wants a developer who takes initiative: walk
every flow as a real person would, and make everything connect seamlessly. Figma is the
reference for how things look; you decide how they behave where the frames don't say.

## What to do in your area
1. **Walk every flow end to end** on a phone (393 wide, also 360 and 430) and on desktop
   (1440), light and dark, starting from an empty account, the way a first-time person would:
   tap everything, go back, change your mind, reload mid-way, type wrong things.
2. **Fix what feels wrong**, including:
   - Layout against Figma: overlaps, things hidden under other things, misalignment,
     cut-off content on short screens (check 393x700 too), wrong font sizes and weights.
     Figma frames are the reference: `GET https://api.figma.com/v1/images/V9DfX3Oc3FSM9T9P9YYb7X?ids=<ids>&format=png`
     with the token from `../site/.env.local`; node IDs in `docs/SCREENS.md`.
   - **Seamless movement**: a step flow (onboarding, sign-in, multi-step forms, sheets that
     lead to sheets) must feel continuous: what stays the same on both screens (header,
     progress, the main button, the tab bar) should stay put while only the content moves;
     forward and back move in opposite directions; tabs and segmented controls slide their
     highlight; lists animate items in/out; nothing pops without motion; nothing jumps.
     Page-level transitions already exist (`components/NavMotion.tsx` + the view-transition
     rules at the end of `app/globals.css`: `stampNav('push'|'pop'|'tab')`, `goBack(router)`);
     use them, and for in-page changes use CSS transitions or the View Transitions API with
     `view-transition-name` on elements that persist. Respect `prefers-reduced-motion`.
   - **Small logic**: loops where a wheel or carousel should wrap, sensible defaults, validation
     with clear messages, disabled states, double-tap protection, keyboard (Enter submits,
     focus moves to the next field), the phone keyboard not covering inputs, back from any
     screen landing somewhere sensible, state surviving a reload where it should, empty states
     that lead somewhere, numbers that add up.
   - Dead ends: every screen must have a way forward and a way back.
3. Keep data real: never show the frames' sample people and numbers.

## How
- A live-reload server runs at **http://localhost:3301** (`next dev`); edits show on reload.
  Don't start, stop or build anything; don't run `npm install`.
- Playwright: `/private/tmp/claude-501/-Users-mac-Desktop-Recent-Project-StayMylo/9a0d35b8-9b9b-4daf-a264-e6e873d8bc55/scratchpad/qa/node_modules/playwright-core`
  (absolute import), Chrome at `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  `webkit.launch()` for Safari. To check motion, freeze view-transition and CSS animations
  mid-way (`document.getAnimations()`, pause, set `currentTime`) and screenshot.
  Put scripts and images under `.../scratchpad/qa/flow-<area>/`.
- Only edit files in your own area (listed in your brief). If a shared file needs a change,
  describe it in your report instead (the `shell` brief owns shared files).
- Never call Supabase auth or write to the production database. Rooms need a session: to
  see signed-in rooms screens, intercept the Supabase REST/Realtime requests in Playwright
  (`page.route`) with fake responses rather than signing in.
- `npx tsc --noEmit` and `npx eslint <your files>` clean at the end. Nothing committed.

## Report
Per flow: what felt wrong and what you changed; the logic you added; anything left and why.
