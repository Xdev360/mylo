/* Mylo — the guest side of a game link.
 *
 * This page is not the app and must never become it. A guest opens a link,
 * plays one game, and that is the whole relationship: no account, no room, no
 * access to anything else anyone has written. The only server surface it can
 * reach is the four guest_game_* functions, each of which is keyed on the
 * token in the link.
 *
 * The rules come from games.js, which both sides already share. The host plays
 * their side of the same page, identified by their Mylo session rather than by
 * a key, which is why none of the game plumbing inside the app had to learn
 * about guests at all.
 */
(function(){
  const CFG = window.MYLO_CONFIG || window.SEPHORA_CONFIG || {};
  const sb = window.supabase.createClient(CFG.url, CFG.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: 'mylo-auth' }
  });
  const $ = s => document.querySelector(s);
  const view = $('#view');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  const NAMES = { chess: 'Chess', eights: 'Crazy Eights', rush: 'Colour Rush' };
  const KEY_PREFIX = 'mylo:guest:';

  // the token: /g/TOKEN, or ?g=TOKEN for anywhere that cannot rewrite
  const token = (() => {
    const m = location.pathname.match(/^\/g\/([A-Za-z0-9_-]{12,80})\/?$/);
    if (m) return m[1];
    return (new URLSearchParams(location.search).get('g') || '').trim();
  })();

  let seat = null;          // 'host' | 'guest'
  let guestKey = null;      // what proves the guest seat
  let game = null;          // the latest row
  let sel = null;           // chess selection
  let pendingSuit = null;   // eights: card awaiting a suit choice
  let poll = null;
  let busy = false;

  const savedKey = () => { try{ return localStorage.getItem(KEY_PREFIX + token) || null; }catch(_){ return null; } };
  const saveKey = k => { try{ localStorage.setItem(KEY_PREFIX + token, k); }catch(_){} };

  function card(inner){ view.innerHTML = `<div class="card">${inner}</div>`; }
  function signupCta(label){
    return `<a class="btn ghost" href="/" style="display:block;text-decoration:none;line-height:50px;padding:0">${esc(label || 'Get Mylo')}</a>`;
  }

  async function rpc(fn, args){
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw error;
    return Array.isArray(data) ? data[0] : data;
  }

  /* ── Who am I ────────────────────────────────────────────────────────────
     Signed in and this is your game: you are the host. Otherwise you are the
     guest, and the key you were handed when you joined is what proves it. */
  async function decideSeat(){
    const g = await rpc('guest_game_state', { p_token: token }).catch(() => null);
    if (g && g.is_host){ seat = 'host'; return; }
    const k = savedKey();
    if (k){ guestKey = k; seat = 'guest'; }
  }

  async function start(){
    if (!token){ card(`<h1>No game here</h1><p class="sub">That link is missing its code.</p>${signupCta()}`); return; }
    let peek;
    try{ peek = await rpc('guest_game_peek', { p_token: token }); }
    catch(err){ card(`<h1>Something went wrong</h1><p class="sub">${esc(err.message || 'Try again in a moment.')}</p>`); return; }
    if (!peek){ card(`<h1>Link not found</h1><p class="sub">Ask them to send a new one.</p>${signupCta()}`); return; }
    if (!peek.live){ return expired(); }

    await decideSeat();
    if (seat) return enterGame();

    if (peek.guest_name){
      card(`<p class="kick">ALREADY TAKEN</p><h1>Someone is playing this one</h1>
        <p class="sub">A game link is good for one guest. Ask ${esc(peek.host_name)} for a new one.</p>${signupCta()}`);
      return;
    }
    invite(peek);
  }

  function expired(){
    card(`<p class="kick">LINK EXPIRED</p>
      <h1>This game is finished</h1>
      <p class="sub">A game link works once. When the game ends, the link closes with it.</p>
      ${signupCta('Play more on Mylo')}
      <a class="link" href="/">What is Mylo?</a>`);
  }

  function invite(peek){
    card(`<p class="kick">YOU'VE BEEN CHALLENGED</p>
      <h1>${esc(peek.host_name)} wants to play ${esc(NAMES[peek.kind] || 'a game')}</h1>
      <p class="sub">No account, no download. Just play.</p>
      <input type="text" id="nm" maxlength="24" placeholder="Your name" autocomplete="nickname">
      <button class="btn" id="go">Play</button>
      <div class="err hide" id="er"></div>`);
    const nm = $('#nm');
    nm?.focus();
    $('#go').addEventListener('click', async () => {
      const btn = $('#go');
      btn.disabled = true; btn.textContent = 'Joining…';
      try{
        const r = await rpc('guest_game_join', { p_token: token, p_name: (nm.value || '').trim() || 'Guest' });
        guestKey = r.guest_key; saveKey(guestKey); seat = 'guest';
        enterGame();
      }catch(err){
        btn.disabled = false; btn.textContent = 'Play';
        const er = $('#er'); er.textContent = err.message || 'Could not join'; er.classList.remove('hide');
      }
    });
    nm?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#go').click(); });
  }

  async function enterGame(){
    await refresh();
    if (poll) clearInterval(poll);
    poll = setInterval(() => { if (!busy) refresh().catch(() => {}); }, 2200);
  }

  async function refresh(){
    const g = await rpc('guest_game_state', { p_token: token });
    if (!g) return;
    game = g;
    if (!g.live || g.status === 'done' || g.status === 'expired'){
      clearInterval(poll);
      return over(g);
    }
    render();
  }

  function myTurn(){ return game && game.turn_seat === seat; }
  function otherName(){
    return seat === 'host' ? (game.guest_name || 'your guest') : game.host_name;
  }

  function render(){
    const st = game.state;
    if (!st){ card(`<p class="sub">Waiting for the game to start…</p>`); return; }
    const turnTxt = myTurn() ? 'Your turn' : `${esc(otherName())}'s turn`;
    let board = '';
    if (game.kind === 'chess') board = chessHTML(st);
    else if (game.kind === 'eights') board = eightsHTML(st);
    else if (game.kind === 'rush') board = rushHTML(st);
    view.innerHTML = `
      <div class="who"><span>You are <b>${esc(seat === 'host' ? game.host_name : (game.guest_name || 'Guest'))}</b></span>
        <span>vs <b>${esc(otherName())}</b></span></div>
      <div class="status ${myTurn() ? 'you' : ''}">${turnTxt}</div>
      <div class="board-wrap">${board}</div>`;
    wire();
  }

  /* ── Chess ─────────────────────────────────────────────────────────────── */
  function chessHTML(st){
    const C = window.MyloGames.chess;
    const flip = seat === 'guest';                 // guest plays black
    const targets = sel != null ? C.legalMoves(st, sel).map(m => m.to) : [];
    const order = [];
    for (let i = 0; i < 64; i++) order.push(flip ? 63 - i : i);
    const cells = order.map(i => {
      const [r, c] = C.rc(i);
      const p = st.board[i];
      return `<button class="csq ${(r + c) % 2 ? 'd' : ''}${sel === i ? ' sel' : ''}${targets.includes(i) ? ' tgt' : ''}"
        data-sq="${i}" ${myTurn() ? '' : 'disabled'}>${p ? C.pieceSVG(p) : ''}</button>`;
    }).join('');
    return `<div><div class="cb">${cells}</div>
      <p class="hint">${myTurn() ? (sel != null ? 'Pick a highlighted square.' : 'Tap a piece to move.') : 'Waiting…'}</p></div>`;
  }

  /* ── Crazy Eights ──────────────────────────────────────────────────────── */
  function eightsHTML(st){
    const E = window.MyloGames.eights;
    const hand = st.hands[seat] || [];
    const theirs = st.hands[seat === 'host' ? 'guest' : 'host'] || [];
    const top = st.pile[st.pile.length - 1];
    const cards = hand.map((c, i) => {
      const ok = myTurn() && E.playable(c, st);
      return `<span class="pc ${E.isRed(c) ? 'red' : ''}${ok ? '' : ' dim'}" data-card="${i}">${esc(c.r)}${esc(c.s)}</span>`;
    }).join('');
    return `<div style="width:100%">
      <p class="hint">They hold ${theirs.length}</p>
      <div class="pile">
        <span class="deck" data-draw>${st.deck.length}</span>
        <span class="pc big ${E.isRed(top) ? 'red' : ''}">${esc(top.r)}${esc(top.s)}</span>
        <span class="hint" style="margin:0">Suit ${esc(st.suit)}</span>
      </div>
      <div class="hand">${cards || '<span class="hint">No cards</span>'}</div>
      ${pendingSuit != null ? `<div class="suits">${E.SUITS.map(s => `<button data-suit="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
      <button class="btn ghost" data-draw ${myTurn() ? '' : 'disabled'}>Draw</button>
    </div>`;
  }

  /* ── Colour Rush ───────────────────────────────────────────────────────── */
  function rushHTML(st){
    const R = window.MyloGames.rush;
    const hand = st.hands[seat] || [];
    const theirs = st.hands[seat === 'host' ? 'guest' : 'host'] || [];
    const top = st.pile[st.pile.length - 1];
    const cards = hand.map((c, i) => {
      const ok = myTurn() && R.playable(c, st);
      return `<span class="pc${ok ? '' : ' dim'}" data-card="${i}" style="background:${colourOf(c.c)};color:#fff">${esc(R.cardFace ? R.cardFace(c) : (c.v || ''))}</span>`;
    }).join('');
    return `<div style="width:100%">
      <p class="hint">They hold ${theirs.length}</p>
      <div class="pile">
        <span class="deck" data-draw>${st.deck.length}</span>
        <span class="pc big" style="background:${colourOf(top.c)};color:#fff">${esc(R.cardFace ? R.cardFace(top) : (top.v || ''))}</span>
        <span class="rc" style="background:${colourOf(st.colour)}"></span>
      </div>
      <div class="hand">${cards || '<span class="hint">No cards</span>'}</div>
      ${pendingSuit != null ? `<div class="suits">${['r','g','b','y'].map(c => `<button data-suit="${c}" style="background:${colourOf(c)}"></button>`).join('')}</div>` : ''}
      <button class="btn ghost" data-draw ${myTurn() ? '' : 'disabled'}>${st.pendingDraw ? 'Take ' + st.pendingDraw : 'Draw'}</button>
    </div>`;
  }
  function colourOf(c){
    return { r: '#E0564C', g: '#3FA96B', b: '#3B82F6', y: '#E0A33E', w: '#444' }[c] || '#444';
  }

  /* ── Moves ─────────────────────────────────────────────────────────────── */
  function nextSeatFor(kind, st){
    if (kind === 'chess') return st.turn === 'w' ? 'host' : 'guest';
    if (kind === 'eights') return st.turn;
    if (kind === 'rush') return window.MyloGames.rush.current(st);
    return seat === 'host' ? 'guest' : 'host';
  }
  function outcome(kind, st){
    if (kind === 'chess'){
      const C = window.MyloGames.chess;
      const s = C.status(st);
      if (s === 'checkmate') return { over: true, winner: seat };
      if (s === 'stalemate' || s === 'draw') return { over: true, winner: 'draw' };
      return { over: false, winner: null };
    }
    const done = st.over || (st.hands && st.hands[seat] && st.hands[seat].length === 0);
    if (!done) return { over: false, winner: null };
    return { over: true, winner: st.winner === 'draw' ? 'draw' : (st.winner || seat) };
  }
  async function push(nextState){
    if (busy) return;
    busy = true;
    try{
      const o = outcome(game.kind, nextState);
      await rpc('guest_game_move', {
        p_token: token,
        p_guest_key: seat === 'guest' ? guestKey : null,
        p_state: nextState,
        p_next_seat: o.over ? game.turn_seat : nextSeatFor(game.kind, nextState),
        p_over: o.over,
        p_winner: o.over ? (o.winner === 'draw' ? 'draw' : o.winner) : null
      });
      sel = null; pendingSuit = null;
      await refresh();
    }catch(err){
      alert(err.message || 'That move did not go through');
      await refresh().catch(() => {});
    }finally{ busy = false; }
  }

  function wire(){
    view.querySelectorAll('[data-sq]').forEach(el => el.addEventListener('click', () => {
      if (!myTurn()) return;
      const C = window.MyloGames.chess, st = game.state, i = Number(el.dataset.sq);
      if (sel != null){
        const mv = C.legalMoves(st, sel).find(m => m.to === i);
        if (mv) return push(C.apply(st, mv));
      }
      const p = st.board[i];
      const mine = seat === 'host' ? 'w' : 'b';
      sel = (p && C.colorOf(p) === mine) ? i : null;
      render();
    }));
    view.querySelectorAll('[data-card]').forEach(el => el.addEventListener('click', () => {
      if (!myTurn()) return;
      const i = Number(el.dataset.card), st = game.state;
      if (game.kind === 'eights'){
        const E = window.MyloGames.eights;
        if (!E.playable(st.hands[seat][i], st)) return;
        if (st.hands[seat][i].r === '8'){ pendingSuit = i; return render(); }
        return push(E.play(st, seat, i, null));
      }
      if (game.kind === 'rush'){
        const R = window.MyloGames.rush;
        if (!R.playable(st.hands[seat][i], st)) return;
        if (st.hands[seat][i].c === 'w'){ pendingSuit = i; return render(); }
        return push(R.play(st, seat, i, null));
      }
    }));
    view.querySelectorAll('[data-suit]').forEach(el => el.addEventListener('click', () => {
      const s = el.dataset.suit, st = game.state, i = pendingSuit;
      if (i == null) return;
      if (game.kind === 'eights') return push(window.MyloGames.eights.play(st, seat, i, s));
      if (game.kind === 'rush') return push(window.MyloGames.rush.play(st, seat, i, s));
    }));
    view.querySelectorAll('[data-draw]').forEach(el => el.addEventListener('click', () => {
      if (!myTurn()) return;
      const st = game.state;
      if (game.kind === 'eights') return push(window.MyloGames.eights.draw(st, seat));
      if (game.kind === 'rush') return push(window.MyloGames.rush.draw(st, seat));
    }));
  }

  /* ── The end ───────────────────────────────────────────────────────────── */
  function over(g){
    const w = g.winner_seat;
    const iWon = w && w === seat;
    const drew = w === 'draw';
    const title = drew ? 'A draw' : iWon ? 'You won' : `${esc(seat === 'host' ? (g.guest_name || 'They') : g.host_name)} won`;
    view.innerHTML = `<div class="card">
      <p class="kick">${esc(NAMES[g.kind] || 'GAME')}</p>
      <h1>${title}</h1>
      <p class="sub">${seat === 'guest'
        ? 'That is the game. This link is closed now.'
        : 'That is the game. Send a fresh link for another.'}</p>
      ${seat === 'guest'
        ? `${signupCta('Play more on Mylo')}<a class="link" href="/">Mylo is where you and your people keep each other going.</a>`
        : `<a class="btn" href="/" style="display:block;text-decoration:none;line-height:50px;padding:0">Back to Mylo</a>`}
    </div>`;
  }

  start().catch(err => card(`<h1>Something went wrong</h1><p class="sub">${esc(err.message || '')}</p>`));
})();
