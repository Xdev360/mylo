// /i/CODE — the page an invite link points at.
//
// A chat app that unfurls a link fetches the page and reads its meta tags, and
// never runs a script. So the app's own index.html, which is empty until the
// script runs, unfurls as nothing. This answers with the room's name and
// picture in the tags, then sends a person straight on to the app with the
// code. The room lookup goes through one anon-callable function that returns
// only what a card needs: no members, no code list, nothing to enumerate.

const SUPABASE_URL = 'https://bjenyxrxbfgphnbncnwv.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZW55eHJ4YmZncGhuYm5jbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODg2MjksImV4cCI6MjEwMDM2NDYyOX0.hDr4ehJO_tZo7VXYh3Njfm6Ig0rDlYBDtDWasOecfmM';
const FALLBACK_IMAGE = 'https://staymylo.com/og.png';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function lookup(code){
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/room_preview_by_code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON, authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_code: code })
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows[0] || null : rows || null;
  }catch(_){ return null; }
}

module.exports = async (req, res) => {
  const raw = (req.query && req.query.code) || '';
  const code = String(raw).trim().toUpperCase();
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host || 'app.staymylo.com'}`;
  const valid = /^[A-Z0-9]{4,12}$/.test(code);
  const room = valid ? await lookup(code) : null;
  const target = valid ? `${origin}/?invite=${encodeURIComponent(code)}` : `${origin}/`;

  const title = room ? `Join ${room.title} on Mylo` : 'Join a room on Mylo';
  const n = room ? Number(room.member_count) || 0 : 0;
  const desc = room
    ? `${n === 1 ? '1 person is' : `${n} people are`} in here${room.category ? ` · ${room.category}` : ''}. Tap to join.`
    : 'Someone wants you in their room. Tap to join.';
  /* Three things could stand in for the room, best first: the invitation card
     the app drew for it (a proper 1200x630 that unfurls as a wide card), the
     room's own picture (square, so it shows as a thumbnail beside the text),
     and the Mylo card. */
  const card = /^https:\/\//.test(room?.invite_card_url || '') ? room.invite_card_url : '';
  const avatar = /^https:\/\//.test(room?.avatar_url || '') ? room.avatar_url : '';
  const image = card || avatar || FALLBACK_IMAGE;
  const big = !!card || image === FALLBACK_IMAGE;

  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=60, s-maxage=300');
  res.status(200).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Mylo">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
${big ? '<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">' : ''}
<meta property="og:url" content="${esc(`${origin}/i/${code}`)}">
<meta name="twitter:card" content="${big ? 'summary_large_image' : 'summary'}">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<meta http-equiv="refresh" content="0;url=${esc(target)}">
<style>
  *{box-sizing:border-box}
  html{background:#0A0A0B;color:#FAFAFA;font:15px/1.5 -apple-system,Inter,system-ui,sans-serif}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    background:
      radial-gradient(760px 520px at 50% -8%, rgba(249,115,22,.28), transparent 62%),
      #0A0A0B;}
  .c{width:min(380px,100%);padding:30px 24px 24px;border-radius:28px;text-align:center;
    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);
    backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
    box-shadow:0 30px 70px -30px rgba(0,0,0,.8)}
  .k{font-size:11px;font-weight:700;letter-spacing:.18em;color:#F97316;margin:0 0 16px}
  .av{width:104px;height:104px;border-radius:30px;object-fit:cover;margin:0 auto 16px;display:block;
    background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14)}
  .ltr{display:grid;place-items:center;font-size:44px;font-weight:800;color:#F97316}
  h1{font-size:24px;line-height:1.2;margin:0 0 6px;letter-spacing:-.02em}
  p{margin:0;color:rgba(250,250,250,.55);font-size:14px}
  a{display:block;margin-top:22px;padding:15px;border-radius:100px;background:#FAFAFA;color:#0A0A0B;
    font-weight:700;text-decoration:none;font-size:15px}
  .f{margin-top:16px;font-size:12px;color:rgba(250,250,250,.35)}
</style>
</head><body>
<div class="c">
  <p class="k">YOU'RE INVITED</p>
  ${room
    ? (avatar
        ? `<img class="av" src="${esc(avatar)}" alt="">`
        : `<div class="av ltr">${esc((room.title || 'M').trim().charAt(0).toUpperCase())}</div>`)
    : ''}
  <h1>${esc(room ? room.title : 'Mylo')}</h1>
  <p>${esc(desc)}</p>
  <a href="${esc(target)}">Open Mylo</a>
  <p class="f">Shared accountability, with people you trust.</p>
</div>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`);
};
