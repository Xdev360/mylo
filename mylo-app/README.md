# Mylo app

The new Mylo app, built from the Figma file `V9DfX3Oc3FSM9T9P9YYb7X` (page "Mylo · Launch",
frame "App · Developer handoff"), on the existing Supabase project. Web app first (PWA),
designed at 393 x 852 and working from 360 to 430 wide.

- `npm run dev` serves it on http://localhost:3300
- Every screen keeps its Figma code (C2, E1, CT0...) in a comment, so it can be checked
  against the frame it came from.
- Tokens are the handoff's, in `app/globals.css`, light and dark.

Build order is the handoff's: Phase A (Launch 1) first, each later phase behind its
release flag (launch1, u1_1, u1_2, u1_3, u2_0, u2_1).
