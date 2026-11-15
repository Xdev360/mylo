// /p/ID — the page a shared Vibe post points at.
//
// Same reason as the invite endpoint: a chat app that unfurls a link fetches
// the page and reads its meta tags, and never runs a script. So the words have
// to be in the tags, and the card has to already be a picture.
//
// Only posts whose author chose to share them exist in shared_posts at all, so
// there is nothing here to filter — a post nobody shared simply is not found.

const SUPABASE_URL = 'https://bjenyxrxbfgphnbncnwv.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZW55eHJ4YmZncGhuYm5jbnd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ3ODg2MjksImV4cCI6MjEwMDM2NDYyOX0.hDr4ehJO_tZo7VXYh3Njfm6Ig0rDlYBDtDWasOecfmM';
const FALLBACK_IMAGE = 'https://staymylo.com/og.png';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function lookup(id){
  try{
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/shared_post_preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', apikey: ANON, authorization: `Bearer ${ANON}` },
      body: JSON.stringify({ p_post_id: id })
    });
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) ? rows[0] || null : rows || null;
  }catch(_){ return null; }
}

module.exports = async (req, res) => {
  const id = String((req.query && req.query.id) || '').trim();
  const origin = `https://${req.headers['x-forwarded-host'] || req.headers.host || 'app.staymylo.com'}`;
  const post = UUID.test(id) ? await lookup(id) : null;

  const words = post ? String(post.body || '').trim() : '';
  const who = post ? (post.author_name || 'Mylo') : '';
  const handle = post && post.author_user ? `@${post.author_user}` : '';
  // The words are the title, because the words are the post.
  const title = words ? (words.length > 70 ? words.slice(0, 69).trimEnd() + '…' : words) : 'A post on Mylo';
  const desc = post ? `${who}${handle ? ' · ' + handle : ''} on Mylo` : 'Shared accountability, with people you trust.';
  const card = post && /^https:\/\//.test(post.card_url || '') ? post.card_url : '';
  const image = card || FALLBACK_IMAGE;

  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'public, max-age=120, s-maxage=600');
  res.status(post ? 200 : 404).send(`<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Mylo">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:url" content="${esc(`${origin}/p/${id}`)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${esc(image)}">
<style>
  *{box-sizing:border-box}
  html{background:#0A0A0B;color:#FAFAFA;font:16px/1.55 -apple-system,Inter,system-ui,sans-serif}
  body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;
    background:radial-gradient(720px 520px at 50% -10%, rgba(167,139,250,.24), transparent 62%), #0A0A0B}
  .c{width:min(420px,100%);padding:26px;border-radius:26px;
    background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1)}
  .q{font-size:22px;line-height:1.4;letter-spacing:-.01em;margin:0 0 18px;white-space:pre-wrap;overflow-wrap:anywhere}
  .by{display:flex;align-items:center;gap:10px;font-size:14px;color:rgba(250,250,250,.55)}
  .by b{color:#FAFAFA;font-weight:700}
  .r{width:34px;height:4px;border-radius:4px;background:#A78BFA;flex:none}
  a{display:block;margin-top:22px;padding:14px;border-radius:100px;background:#FAFAFA;color:#0A0A0B;
    font-weight:700;text-decoration:none;text-align:center}
  .f{margin-top:14px;text-align:center;font-size:12px;color:rgba(250,250,250,.32)}
</style>
</head><body>
<div class="c">
  <p class="q">${post ? esc(words) : 'This post is not shared.'}</p>
  ${post ? `<div class="by"><span class="r"></span><span><b>${esc(who)}</b>${handle ? ' ' + esc(handle) : ''}</span></div>` : ''}
  <a href="${esc(origin)}/">Open Mylo</a>
  <p class="f">Posted in a private room on Mylo.</p>
</div>
</body></html>`);
};
