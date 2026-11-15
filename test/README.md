# Tests

No framework, no dependencies — plain `node`, run from the repo root.

```
node test/todo-grace.test.mjs
```

Each file lifts the real functions out of `js/app.js` by source and drives them
against a fake clock, so the rules are tested as shipped rather than as a copy
that can drift.

- **`todo-grace.test.mjs`** — the day-lock rule. A to-do settles when its day
  ends, except that yesterday stays tickable until 01:00 (`TODO_GRACE_HOURS`).
  Covers the boundaries at 00:59:59 and 01:00:00, month and year rollover, and
  the bad-data cases.

## refs.test.mjs

Checks that every function each script calls is actually defined in it.

This exists because of a real failure: a block replace in `js/app.js` matched a
start and an end marker that were far further apart than intended and deleted
1,782 lines with them. `renderAll()` called into that region, so the app threw
on its first paint and showed a black page to anyone signed in. Signed out it
never reached that code, so checking the login screen came back clean and the
break shipped.

Run it before every push:

    node --test test/*.test.mjs
