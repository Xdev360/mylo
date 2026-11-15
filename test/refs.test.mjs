/* Every function the app calls must exist.
 *
 * This is here because of a specific failure: a block replace in js/app.js
 * matched a start and an end marker that were much further apart than
 * intended, and silently deleted 1,782 lines — the wallet, notifications,
 * focus mode, the journal, the games helpers. renderAll() calls into several
 * of those, so the app threw on its first paint and showed a black page to
 * anyone signed in. Signed out it never reaches that code, so a smoke test of
 * the login screen came back clean and the break shipped.
 *
 * A call to a name that is defined nowhere is the exact shape of that bug, and
 * it costs a second to look for.
 */
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const FILES = ['js/app.js', 'js/play.js', 'js/admin.js', 'js/games.js', 'js/avatar-kit.js'];

/* Names that legitimately come from somewhere else: the browser, a CDN script,
   or another file in the page. Anything not here has to be defined in-file. */
const AMBIENT = new Set([
  // language + control flow that looks like a call
  'if', 'for', 'while', 'switch', 'catch', 'return', 'typeof', 'do', 'else', 'try',
  'new', 'delete', 'void', 'await', 'yield', 'function', 'async', 'var', 'let', 'const',
  'of', 'in', 'not', 'and', 'or', 'this', 'case', 'throw', 'super',
  // browser
  'fetch', 'alert', 'confirm', 'prompt', 'setTimeout', 'setInterval', 'clearTimeout',
  'clearInterval', 'requestAnimationFrame', 'cancelAnimationFrame', 'requestIdleCallback',
  'queueMicrotask', 'structuredClone', 'atob', 'btoa', 'parseInt', 'parseFloat',
  'isNaN', 'isFinite', 'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
  'getComputedStyle', 'matchMedia', 'open', 'close', 'scrollTo', 'postMessage',
  // css and svg function words that appear inside strings
  'calc', 'rgba', 'rgb', 'hsl', 'var', 'url', 'translate', 'translateX', 'translateY',
  'rotate', 'scale', 'blur', 'brightness', 'cubic', 'steps', 'repeat', 'minmax',
  'linear', 'radial', 'conic', 'clamp', 'min', 'max', 'attr', 'counter', 'matrix',
  'mix', 'gradient', 'color', 'polygon', 'circle', 'ellipse', 'inset', 'drop',
  // loaded from a CDN or another file in the page
  'confetti', 'lucide', 'console', 'self', 'globalThis'
]);

/* Comments and string literals are prose, not code. Without stripping them,
   every "a conversation (like this one)" in a comment reads as a call. */
const countNl = (s, a, b) => { let k = 0; for (let j = a; j < b; j++) if (s[j] === '\n') k++; return k; };

/* Comments only. String contents stay: a template literal is full of real
   calls, and the handful of CSS words that leak in from ordinary strings are
   cheaper to name in AMBIENT than a string parser is to get right. Line
   breaks are preserved so declarations stay anchored to the start of a line. */
/* A slash starts a regex only where a value may start — after an operator, an
   opening bracket, a comma, or a keyword. After a name or a closing bracket it
   is division. */
function regexPosition(last){
  if (!last) return true;
  return '(,=:[!&|?{;+-*%~^<>\n'.includes(last);
}
function stripComments(src){
  let out = '', i = 0, last = '';
  const n = src.length;
  while (i < n){
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '*'){
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? n : end + 2;
      out += ' ' + '\n'.repeat(countNl(src, i, stop));
      i = stop;
      continue;
    }
    // a regex literal: its contents are a pattern, and \bword reads as a call
    if (c === '/' && d !== '/' && d !== '*' && regexPosition(last)){
      let j = i + 1, klass = false;
      while (j < n){
        const ch = src[j];
        if (ch === '\\'){ j += 2; continue; }
        if (ch === '[') klass = true;
        else if (ch === ']') klass = false;
        else if (ch === '/' && !klass) break;
        else if (ch === '\n') break;                 // not a regex after all
        j++;
      }
      if (j < n && src[j] === '/'){ out += ' '; last = ' '; i = j + 1; continue; }
    }
    if (c === '"' || c === "'"){
      let j = i + 1;
      while (j < n && src[j] !== c){
        if (src[j] === '\\'){ j += 2; continue; }
        if (src[j] === '\n') break;
        j++;
      }
      out += ' '; last = ' ';
      i = (j < n && src[j] === c) ? j + 1 : i + 1;
      continue;
    }
    if (c === '/' && d === '/'){
      const end = src.indexOf('\n', i);
      const stop = end === -1 ? n : end;
      out += ' ';
      i = stop;
      continue;
    }
    out += c;
    if (!/\s/.test(c) || c === '\n') last = c;
    i++;
  }
  return out;
}

function declaredIn(src){
  const out = new Set();
  for (const m of src.matchAll(/(?:^|\n)\s*(?:export\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/(?:const|let|var)\s*[{[]([^}\]]*)[}\]]\s*=/g)){
    for (const part of m[1].split(',')){
      const name = part.split(':').pop().split('=')[0].trim().replace(/^\.\.\./, '');
      if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
    }
  }
  for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s*)?(?:function\b|\([^()]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/g)) out.add(m[1]);
  // every parameter list: function (a, b), (a, b) =>, and a bare x =>
  for (const m of src.matchAll(/(?:function\s*\*?\s*[A-Za-z_$]*\s*)?\(([^()]*)\)\s*(?:=>|\{)/g)){
    for (const part of m[1].split(',')){
      const name = part.split('=')[0].trim().replace(/^\.\.\./, '').replace(/[{}[\]]/g, '').split(':').pop().trim();
      if (/^[A-Za-z_$][\w$]*$/.test(name)) out.add(name);
    }
  }
  for (const m of src.matchAll(/(?:^|[(,=;\s])([A-Za-z_$][\w$]*)\s*=>/g)) out.add(m[1]);
  for (const m of src.matchAll(/catch\s*\(\s*([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  for (const m of src.matchAll(/class\s+([A-Za-z_$][\w$]*)/g)) out.add(m[1]);
  // object-literal method shorthand: `summary(st){ ... }`
  for (const m of src.matchAll(/(?:^|\n)\s*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g)) out.add(m[1]);
  return out;
}

/** Bare calls only: `foo(` but never `obj.foo(` — a method is somebody else's problem. */
function calledIn(src){
  const out = new Set();
  for (const m of src.matchAll(/(?<![.\w$?])([a-z_$][\w$]*)\s*\(/g)) out.add(m[1]);
  return out;
}

for (const file of FILES){
  test(`${file} calls nothing that does not exist`, () => {
    const raw = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    // declarations from the raw text (a name mentioned in a comment only makes
    // this quieter, never louder); calls from the code alone
    const declared = declaredIn(raw);
    const missing = [...calledIn(stripComments(raw))]
      .filter(n => !declared.has(n) && !AMBIENT.has(n))
      .sort();
    assert.deepEqual(missing, [], `${file} calls ${missing.length} name(s) that are defined nowhere in it: ${missing.join(', ')}`);
  });
}
