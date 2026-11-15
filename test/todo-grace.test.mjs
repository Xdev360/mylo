// Lift the real functions out of app.js and drive them against a fake clock.
import fs from 'fs';
const src = fs.readFileSync('js/app.js','utf8');
const grab = (start, end) => {
  const a = src.indexOf(start); if (a < 0) throw new Error('missing: '+start);
  const b = src.indexOf(end, a); if (b < 0) throw new Error('missing end for '+start);
  return src.slice(a, b);
};
const body = [
  'const pad = n => String(n).padStart(2,"0");',
  'const iso = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;',
  'let TODAY, TODAY_ISO;',
  'function setNow(d){ NOW = d; TODAY = new Date(d); TODAY.setHours(0,0,0,0); TODAY_ISO = iso(TODAY); }',
  'let NOW;',
  grab('function todoDay(t){', 'function todosFor('),
  grab('const TODO_GRACE_HOURS', 'function todoCanDelete('),
].join('\n')
  // the only clock the rule reads is `new Date()`; point it at the fake one
  .replace('function inTodoGrace(at = new Date()){', 'function inTodoGrace(at = new Date(NOW)){');

const mod = new Function(body + `
  return { setNow, todoLocked, todoInGrace, iso };
`)();

const { setNow, todoLocked, todoInGrace } = mod;
const todo = day => ({ id:'t', day, created_at: day + 'T10:00:00Z' });

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = got === want;
  ok ? pass++ : fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label.padEnd(58)} locked=${got}${ok ? '' : `  EXPECTED ${want}`}`);
};

// It is 00:30 on the 18th — inside the grace hour.
setNow(new Date(2026, 8, 18, 0, 30));
check('00:30 — yesterday (17th): still tickable',        todoLocked(todo('2026-09-17')), false);
check('00:30 — today (18th): open',                      todoLocked(todo('2026-09-18')), false);
check('00:30 — two days back (16th): settled',           todoLocked(todo('2026-09-16')), true);
check('00:30 — yesterday flagged as grace',              todoInGrace(todo('2026-09-17')), true);

// 00:59:59 — last second of the window.
setNow(new Date(2026, 8, 18, 0, 59, 59));
check('00:59:59 — yesterday: still open',                todoLocked(todo('2026-09-17')), false);

// 01:00:00 — shut.
setNow(new Date(2026, 8, 18, 1, 0, 0));
check('01:00:00 — yesterday: SETTLED',                   todoLocked(todo('2026-09-17')), true);
check('01:00:00 — no longer flagged as grace',           todoInGrace(todo('2026-09-17')), false);
check('01:00:00 — today still open',                     todoLocked(todo('2026-09-18')), false);

// Mid-afternoon, the ordinary case.
setNow(new Date(2026, 8, 18, 15, 0));
check('15:00 — yesterday: settled',                      todoLocked(todo('2026-09-17')), true);
check('15:00 — today: open',                             todoLocked(todo('2026-09-18')), false);

// Month boundary: 1 Oct 00:30 must reach back to 30 Sep.
setNow(new Date(2026, 9, 1, 0, 30));
check('1 Oct 00:30 — 30 Sep is "yesterday": open',       todoLocked(todo('2026-09-30')), false);
check('1 Oct 00:30 — 29 Sep: settled',                   todoLocked(todo('2026-09-29')), true);

// Year boundary.
setNow(new Date(2027, 0, 1, 0, 30));
check('1 Jan 00:30 — 31 Dec is "yesterday": open',       todoLocked(todo('2026-12-31')), false);

// Bad data. A row with no `day` falls back to created_at; with neither, that
// resolves to the epoch, which is simply long past — settled, as before.
setNow(new Date(2026, 8, 18, 15, 0));
check('no day, no created_at: settled (epoch, unchanged)', todoLocked({ id:'x' }), true);
// But an unparseable created_at yields no day at all. That used to lock the row
// forever with no way to ever tick it. Now it stays open.
check('unparseable created_at: stays open (was: locked)',  todoLocked({ id:'x', created_at:'garbage' }), false);
check('null to-do: not locked, no crash',                  todoLocked(null), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
