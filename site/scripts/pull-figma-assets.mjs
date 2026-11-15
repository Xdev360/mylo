/* Pull Figma exports at 2x into public/figma/.
 *
 *   node scripts/pull-figma-assets.mjs            # everything in ASSETS
 *   node scripts/pull-figma-assets.mjs hero-panel # just one
 *
 * Needs a Figma personal access token with the "File content: Read-only"
 * scope, read from FIGMA_TOKEN in the environment or from .env.local. The
 * token is never printed and .env.local is gitignored.
 *
 * Why this exists: the Figma MCP screenshot tool renders a node at its
 * natural size and will not upscale, so it cannot produce the 2x exports the
 * design calls for. The REST images endpoint can.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = resolve(ROOT, 'public/figma');
const FILE_KEY = 'V9DfX3Oc3FSM9T9P9YYb7X';

/* name → Figma node. Add a line here when a section needs a picture. */
const ASSETS = {
  'hero-panel':      '887:22',
  'hero-panel-dark': null,        // fill in from the dark home frame 893:199227
  'share':           '1108:749'   // 1200x630 og:image, export at 1x
};
const SCALE = { share: 1 };       // everything else 2x
/* Figma returns PNG. A 2x panel is about a megabyte that way and has no
   transparency, so it is re-encoded as JPEG, roughly a third the size, and
   the artefacts are invisible at 2x displayed at 1x. Anything that needs an
   alpha channel, or is the share image, stays PNG. */
const KEEP_PNG = new Set(['share']);

function token() {
  if (process.env.FIGMA_TOKEN) return process.env.FIGMA_TOKEN.trim();
  const envFile = resolve(ROOT, '.env.local');
  if (existsSync(envFile)) {
    const line = readFileSync(envFile, 'utf8')
      .split('\n').find(l => l.startsWith('FIGMA_TOKEN='));
    if (line) {
      const v = line.slice('FIGMA_TOKEN='.length).trim().replace(/^["']|["']$/g, '');
      // The file ships with a placeholder so there is something to edit;
      // treat it as absent rather than sending it to Figma and getting a 403.
      if (v && v !== 'PASTE_YOUR_TOKEN_HERE') return v;
    }
  }
  console.error(
    'No FIGMA_TOKEN yet.\n' +
    'Open site/.env.local and replace PASTE_YOUR_TOKEN_HERE.\n' +
    'Figma → avatar → Settings → Security → Personal access tokens →\n' +
    'Generate new token, scope "File content: Read-only". Then:\n' +
    '  echo \'FIGMA_TOKEN=figd_your_token\' >> site/.env.local'
  );
  process.exit(1);
}

const only = process.argv[2];
const wanted = Object.entries(ASSETS)
  .filter(([name, id]) => id && (!only || name === only));

if (!wanted.length) { console.error('Nothing to pull.'); process.exit(1); }

const TOKEN = token();
mkdirSync(OUT, { recursive: true });

/* One request per scale: the endpoint takes a batch of ids but a single
   scale, and a 1200x630 share image must not be doubled. */
const byScale = new Map();
for (const [name, id] of wanted) {
  const s = SCALE[name] ?? 2;
  if (!byScale.has(s)) byScale.set(s, []);
  byScale.get(s).push([name, id]);
}

for (const [scale, group] of byScale) {
  const ids = group.map(([, id]) => id).join(',');
  const url = `https://api.figma.com/v1/images/${FILE_KEY}?ids=${encodeURIComponent(ids)}&scale=${scale}&format=png`;
  const res = await fetch(url, { headers: { 'X-Figma-Token': TOKEN } });
  if (!res.ok) {
    console.error(`Figma said ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { images, err } = await res.json();
  if (err) { console.error('Figma error:', err); process.exit(1); }

  for (const [name, id] of group) {
    const link = images[id];
    if (!link) { console.error(`  ${name}: no image came back for ${id}`); continue; }
    const png = await fetch(link);
    if (!png.ok) { console.error(`  ${name}: download failed ${png.status}`); continue; }
    const buf = Buffer.from(await png.arrayBuffer());
    const png = resolve(OUT, `${name}.png`);
    writeFileSync(png, buf);
    const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);   // PNG header
    const hasAlpha = buf[25] === 4 || buf[25] === 6;

    if (KEEP_PNG.has(name) || hasAlpha) {
      console.log(`  ${name}.png  ${w}x${h}  ${Math.round(buf.length / 1024)} KB  (${scale}x)`);
      continue;
    }
    const jpg = resolve(OUT, `${name}.jpg`);
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', png, '--out', jpg],
                 { stdio: 'ignore' });
    rmSync(png);
    const size = readFileSync(jpg).length;
    console.log(`  ${name}.jpg  ${w}x${h}  ${Math.round(size / 1024)} KB  (${scale}x, from ${Math.round(buf.length / 1024)} KB png)`);
  }
}
console.log('Done.');
