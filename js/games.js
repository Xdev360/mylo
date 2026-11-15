/* Mylo games — playable inside a chat thread, iMessage style.
 *
 * Wire format: games ride on the `messages` table. Prefer kind 'text' (always
 * allowed by messages_kind_check); payload.game discriminates the game.
 * After migration 20260903_messages_kind_chance.sql, kind 'chance' is also OK.
 *
 *   payload = { game:'chess'|'eights'|'rush'|'chance', gameId, host_id, guest_id, turn, state, over, winner }
 *
 * Note: card hands live in the payload, so a determined person could read the
 * opponent's hand from the raw row. Fine for a private two-person room; do not
 * treat Eights as competitive.
 */
(function (global) {
  'use strict';

  const uid = () => 'g' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  /* ══════════════════════════ CHESS ══════════════════════════ */

  const FILES = 'abcdefgh';
  const START = [
    'bR','bN','bB','bQ','bK','bB','bN','bR',
    'bP','bP','bP','bP','bP','bP','bP','bP',
    null,null,null,null,null,null,null,null,
    null,null,null,null,null,null,null,null,
    null,null,null,null,null,null,null,null,
    null,null,null,null,null,null,null,null,
    'wP','wP','wP','wP','wP','wP','wP','wP',
    'wR','wN','wB','wQ','wK','wB','wN','wR'
  ];
  const GLYPH = {
    wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
    bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟'
  };
  /* Staunton pieces, drawn as filled shapes with a contrasting outline so white
     and black read the same way they do on a real board. Each path is closed and
     self-contained, so a single fill never collapses into a blob. */
  const PIECE_PATH = {
    K: 'M22.5 6v5m-2.5-2.5h5M22.5 14c-2.2 0-4 1.6-4 3.6 0 1.4.9 2.6 2.2 3.2-3.9 1.2-6.7 4.6-6.7 8.6 0 1.6.5 3.1 1.3 4.4h18.4c.8-1.3 1.3-2.8 1.3-4.4 0-4-2.8-7.4-6.7-8.6 1.3-.6 2.2-1.8 2.2-3.2 0-2-1.8-3.6-4-3.6zM12.5 33.5h20v3.5h-20zM11 37.5h23V40H11z',
    Q: 'M9 13a2.2 2.2 0 1 1-4.4 0A2.2 2.2 0 0 1 9 13zm31.4 0a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0zM24.7 8.4a2.2 2.2 0 1 1-4.4 0 2.2 2.2 0 0 1 4.4 0zM16 11a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm17 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM7 15l3.6 12h24.8L39 15l-6 8-3-11-3.5 11-4.5-12-4.5 12L14.5 12l-3 11zM10 28h25l-1.2 5.5h-22.6zM12.5 34.5h20V38h-20zM11 38.5h23V41H11z',
    R: 'M11 10.5h4.5v3h4V10.5h5v3h4v-3H34V17l-3 3v10l3 3v3.5H11V33l3-3V20l-3-3zM9 36.5h27V40H9z',
    B: 'M22.5 8.5a2.6 2.6 0 1 1 0 5.2 2.6 2.6 0 0 1 0-5.2zM22.5 14c-4.6 0-8.3 4.3-8.3 9.6 0 3.3 1.5 6.2 3.7 8h9.2c2.2-1.8 3.7-4.7 3.7-8 0-5.3-3.7-9.6-8.3-9.6zM15 33h15v3.4H15zM11.5 37h22V40h-22z',
    N: 'M17 8c1.5 0 3 .6 4.2 1.6l1.3-2.1 1.6 2.6C29.8 12 34 18.6 34 27v6.5H14.5V27c0-3.6 1.6-5.9 3.4-8-1.6.4-3.1 1.4-4.2 2.7l-2.6-1.3c.8-2.5 2.4-4.6 4.6-6l-2.2-1.4L15 11l-1.3-2 3.3-1zm.8 6.4a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8zM13 36.5h23V40H13z',
    P: 'M22.5 10.5a4.7 4.7 0 0 1 2.9 8.4c2.4 1.3 4 3.9 4 6.8 0 1.9-.7 3.6-1.9 5h-10a7.5 7.5 0 0 1-1.9-5c0-2.9 1.6-5.5 4-6.8a4.7 4.7 0 0 1 2.9-8.4zM16 31.5h13V35H16zM12.5 35.5h20V39h-20z'
  };
  function pieceSVG(code){
    if (!code) return '';
    const isW = code[0] === 'w';
    const d = PIECE_PATH[code[1]];
    if (!d) return `<span class="cpc-g cpc-${code[0]}">${GLYPH[code] || ''}</span>`;
    return `<svg class="cpc-svg" viewBox="0 0 45 45" aria-hidden="true">
      <path d="${d}" fill="${isW ? '#FFFFFF' : '#1E1E1E'}"
        stroke="${isW ? '#1E1E1E' : '#000000'}" stroke-width="1.6"
        stroke-linejoin="round" stroke-linecap="round"/>
    </svg>`;
  }
  const NAME = { K:'King', Q:'Queen', R:'Rook', B:'Bishop', N:'Knight', P:'Pawn' };

  const colorOf = p => p ? p[0] : null;
  const typeOf  = p => p ? p[1] : null;
  const rc      = i => [i >> 3, i & 7];          // row, col
  const idx     = (r, c) => r * 8 + c;
  const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const sq      = i => FILES[i & 7] + (8 - (i >> 3));

  function chessNew(){
    return {
      board: START.slice(),
      turn: 'w',
      castle: { wK:true, wQ:true, bK:true, bQ:true },
      ep: null,          // en-passant target index
      half: 0,
      full: 1,
      last: null         // {from,to} for highlighting
    };
  }

  /** Pseudo-legal moves for one square — king safety is filtered later. */
  function rawMoves(g, from){
    const p = g.board[from];
    if (!p) return [];
    const me = colorOf(p), t = typeOf(p);
    const [r, c] = rc(from);
    const out = [];
    const push = (rr, cc, opts) => {
      if (!onBoard(rr, cc)) return false;
      const target = g.board[idx(rr, cc)];
      if (target && colorOf(target) === me) return false;
      out.push(Object.assign({ from, to: idx(rr, cc) }, opts || {}));
      return !target;                       // keep sliding only into empty squares
    };
    const ray = (dr, dc) => { let rr = r + dr, cc = c + dc; while (push(rr, cc)){ rr += dr; cc += dc; } };

    if (t === 'P'){
      const dir = me === 'w' ? -1 : 1;
      const startRow = me === 'w' ? 6 : 1;
      const promoRow = me === 'w' ? 0 : 7;
      const one = idx(r + dir, c);
      if (onBoard(r + dir, c) && !g.board[one]){
        if (r + dir === promoRow) out.push({ from, to: one, promo: 'Q' });
        else out.push({ from, to: one });
        const two = idx(r + 2 * dir, c);
        if (r === startRow && !g.board[two]) out.push({ from, to: two, double: true });
      }
      [-1, 1].forEach(dc => {
        const rr = r + dir, cc = c + dc;
        if (!onBoard(rr, cc)) return;
        const j = idx(rr, cc);
        const target = g.board[j];
        if (target && colorOf(target) !== me){
          if (rr === promoRow) out.push({ from, to: j, promo: 'Q' });
          else out.push({ from, to: j });
        } else if (g.ep === j){
          out.push({ from, to: j, ep: true });
        }
      });
    } else if (t === 'N'){
      [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
        .forEach(([dr, dc]) => push(r + dr, c + dc));
    } else if (t === 'B'){
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([dr, dc]) => ray(dr, dc));
    } else if (t === 'R'){
      [[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr, dc]) => ray(dr, dc));
    } else if (t === 'Q'){
      [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]].forEach(([dr, dc]) => ray(dr, dc));
    } else if (t === 'K'){
      [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]
        .forEach(([dr, dc]) => push(r + dr, c + dc));
      // castling — squares empty, king not in or through check (checked in legalMoves)
      const home = me === 'w' ? 7 : 0;
      if (r === home && c === 4){
        if (g.castle[me + 'K'] && !g.board[idx(home,5)] && !g.board[idx(home,6)])
          out.push({ from, to: idx(home, 6), castle: 'K' });
        if (g.castle[me + 'Q'] && !g.board[idx(home,3)] && !g.board[idx(home,2)] && !g.board[idx(home,1)])
          out.push({ from, to: idx(home, 2), castle: 'Q' });
      }
    }
    return out;
  }

  function attacked(g, target, byColor){
    for (let i = 0; i < 64; i++){
      const p = g.board[i];
      if (!p || colorOf(p) !== byColor) continue;
      if (typeOf(p) === 'K'){
        const [r1, c1] = rc(i), [r2, c2] = rc(target);
        if (Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1) return true;
        continue;
      }
      if (typeOf(p) === 'P'){
        const dir = colorOf(p) === 'w' ? -1 : 1;
        const [r1, c1] = rc(i);
        if (idx(r1 + dir, c1 - 1) === target || idx(r1 + dir, c1 + 1) === target){
          if (onBoard(r1 + dir, c1 - 1) || onBoard(r1 + dir, c1 + 1)) return true;
        }
        continue;
      }
      if (rawMoves(g, i).some(m => m.to === target)) return true;
    }
    return false;
  }

  function kingSquare(g, color){
    for (let i = 0; i < 64; i++) if (g.board[i] === color + 'K') return i;
    return -1;
  }
  function inCheck(g, color){
    const k = kingSquare(g, color);
    return k >= 0 && attacked(g, k, color === 'w' ? 'b' : 'w');
  }

  /** Apply without validation — callers use legalMoves(). Returns a new state. */
  function chessApply(g, mv){
    const n = {
      board: g.board.slice(),
      turn: g.turn === 'w' ? 'b' : 'w',
      castle: Object.assign({}, g.castle),
      ep: null,
      half: g.half + 1,
      full: g.turn === 'b' ? g.full + 1 : g.full,
      last: { from: mv.from, to: mv.to }
    };
    const p = n.board[mv.from];
    const me = colorOf(p);
    if (typeOf(p) === 'P' || n.board[mv.to]) n.half = 0;

    n.board[mv.to] = mv.promo ? me + mv.promo : p;
    n.board[mv.from] = null;

    if (mv.ep){
      const [r] = rc(mv.to);
      n.board[idx(me === 'w' ? r + 1 : r - 1, mv.to & 7)] = null;
    }
    if (mv.double) n.ep = idx((rc(mv.from)[0] + rc(mv.to)[0]) / 2, mv.from & 7);
    if (mv.castle){
      const home = me === 'w' ? 7 : 0;
      if (mv.castle === 'K'){ n.board[idx(home,5)] = n.board[idx(home,7)]; n.board[idx(home,7)] = null; }
      else { n.board[idx(home,3)] = n.board[idx(home,0)]; n.board[idx(home,0)] = null; }
    }
    if (typeOf(p) === 'K'){ n.castle[me + 'K'] = false; n.castle[me + 'Q'] = false; }
    if (typeOf(p) === 'R'){
      const home = me === 'w' ? 7 : 0;
      if (mv.from === idx(home, 7)) n.castle[me + 'K'] = false;
      if (mv.from === idx(home, 0)) n.castle[me + 'Q'] = false;
    }
    // a rook captured on its home square also kills that right
    [['w',7],['b',0]].forEach(([col, home]) => {
      if (mv.to === idx(home, 7)) n.castle[col + 'K'] = false;
      if (mv.to === idx(home, 0)) n.castle[col + 'Q'] = false;
    });
    return n;
  }

  function legalMoves(g, from){
    const p = g.board[from];
    if (!p || colorOf(p) !== g.turn) return [];
    const me = g.turn;
    return rawMoves(g, from).filter(mv => {
      if (mv.castle){
        if (inCheck(g, me)) return false;
        const home = me === 'w' ? 7 : 0;
        const through = mv.castle === 'K' ? idx(home, 5) : idx(home, 3);
        if (attacked(g, through, me === 'w' ? 'b' : 'w')) return false;
      }
      return !inCheck(chessApply(g, mv), me);
    });
  }

  function allLegal(g){
    const out = [];
    for (let i = 0; i < 64; i++){
      if (g.board[i] && colorOf(g.board[i]) === g.turn) out.push(...legalMoves(g, i));
    }
    return out;
  }

  function chessStatus(g){
    const moves = allLegal(g);
    const check = inCheck(g, g.turn);
    if (!moves.length) return check ? 'checkmate' : 'stalemate';
    if (g.half >= 100) return 'draw';
    return check ? 'check' : 'playing';
  }

  function moveLabel(g, mv){
    const p = g.board[mv.from];
    const cap = g.board[mv.to] || mv.ep;
    if (mv.castle) return mv.castle === 'K' ? 'castles short' : 'castles long';
    return `${NAME[typeOf(p)]} ${sq(mv.from)}${cap ? '×' : '–'}${sq(mv.to)}${mv.promo ? '=Q' : ''}`;
  }

  /* ══════════════════════════ CRAZY EIGHTS ══════════════════════════ */

  const SUITS = ['♠','♥','♦','♣'];   // spade heart diamond club
  const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
  const isRed = c => c.s === '♥' || c.s === '♦';

  function shuffled(){
    const deck = [];
    SUITS.forEach(s => RANKS.forEach(r => deck.push({ s, r })));
    for (let i = deck.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  function eightsNew(){
    const deck = shuffled();
    const host = deck.splice(0, 7);
    const guest = deck.splice(0, 7);
    let up = deck.shift();
    while (up.r === '8'){ deck.push(up); up = deck.shift(); }   // don't start on a wild
    return { deck, hands: { host, guest }, pile: [up], suit: up.s, turn: 'host', drew: 0 };
  }

  const cardPlayable = (c, st) => c.r === '8' || c.s === st.suit || c.r === st.pile[st.pile.length - 1].r;

  function eightsPlay(st, seat, cardIdx, chosenSuit){
    const n = JSON.parse(JSON.stringify(st));
    const hand = n.hands[seat];
    const card = hand[cardIdx];
    if (!card || !cardPlayable(card, n)) return null;
    hand.splice(cardIdx, 1);
    n.pile.push(card);
    n.suit = card.r === '8' ? (chosenSuit || card.s) : card.s;
    n.drew = 0;
    if (!hand.length){ n.over = true; n.winner = seat; return n; }
    n.turn = seat === 'host' ? 'guest' : 'host';
    return n;
  }

  function eightsDraw(st, seat){
    const n = JSON.parse(JSON.stringify(st));
    if (!n.deck.length){
      const top = n.pile.pop();
      n.deck = n.pile;
      n.pile = [top];
      for (let i = n.deck.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [n.deck[i], n.deck[j]] = [n.deck[j], n.deck[i]];
      }
    }
    if (!n.deck.length){ n.turn = seat === 'host' ? 'guest' : 'host'; n.drew = 0; return n; }
    n.hands[seat].push(n.deck.shift());
    n.drew = (n.drew || 0) + 1;
    if (n.drew >= 3){ n.turn = seat === 'host' ? 'guest' : 'host'; n.drew = 0; }
    return n;
  }

  /* ══════════════════════════ RUSH — 2-4 players ══════════════════════════
     Colour-and-number matching with action cards. Seats are an ordered array
     of profile ids, so the same engine covers a duo or a full room.
       card = { c:'r'|'g'|'b'|'y'|'w', v:'0'..'9'|'skip'|'rev'|'d2'|'wild'|'wd4' }
     Hands live in the payload, so this is for a private room, not a tournament. */

  const RUSH_COLOURS = ['r', 'g', 'b', 'y'];
  const COLOUR_NAME = { r:'Red', g:'Green', b:'Blue', y:'Yellow', w:'Wild' };

  function rushDeck(){
    const d = [];
    RUSH_COLOURS.forEach(c => {
      d.push({ c, v: '0' });                                   // one zero
      for (let n = 1; n <= 9; n++){ d.push({ c, v: String(n) }); d.push({ c, v: String(n) }); }
      ['skip', 'rev', 'd2'].forEach(v => { d.push({ c, v }); d.push({ c, v }); });
    });
    for (let i = 0; i < 4; i++){ d.push({ c:'w', v:'wild' }); d.push({ c:'w', v:'wd4' }); }
    for (let i = d.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [d[i], d[j]] = [d[j], d[i]];
    }
    return d;
  }

  function rushNew(playerIds){
    const players = (playerIds || []).slice(0, 4);
    const deck = rushDeck();
    const hands = {};
    players.forEach(id => { hands[id] = deck.splice(0, 7); });
    let up = deck.shift();
    while (up.c === 'w' || up.v === 'd2' || up.v === 'skip' || up.v === 'rev'){
      deck.push(up); up = deck.shift();                        // start on a plain number
    }
    return {
      players, hands, deck, pile: [up], colour: up.c,
      turn: 0, dir: 1, pendingDraw: 0, drew: 0,
      over: false, winner: null, note: null
    };
  }

  const rushCurrent = st => st.players[st.turn];
  function rushNext(st, from){
    const n = st.players.length;
    return ((from == null ? st.turn : from) + st.dir + n) % n;
  }
  function rushPlayable(card, st){
    const top = st.pile[st.pile.length - 1];
    if (st.pendingDraw > 0) return card.v === 'd2' || card.v === 'wd4';  // stack or take it
    if (card.c === 'w') return true;
    return card.c === st.colour || card.v === top.v;
  }

  function rushPlay(st, playerId, cardIdx, chosenColour){
    if (rushCurrent(st) !== playerId || st.over) return null;
    const n = JSON.parse(JSON.stringify(st));
    const hand = n.hands[playerId];
    const card = hand[cardIdx];
    if (!card || !rushPlayable(card, n)) return null;

    hand.splice(cardIdx, 1);
    n.pile.push(card);
    n.colour = card.c === 'w' ? (chosenColour || 'r') : card.c;
    n.drew = 0;
    n.note = `${COLOUR_NAME[n.colour]} ${cardLabel(card)}`;

    if (!hand.length){ n.over = true; n.winner = playerId; return n; }

    if (card.v === 'rev'){
      if (n.players.length === 2) n.turn = rushNext(n);          // reverse = skip in a duo
      n.dir *= -1;
      n.turn = rushNext(n);
    } else if (card.v === 'skip'){
      n.turn = rushNext(n);
      n.turn = rushNext(n);
    } else if (card.v === 'd2'){
      n.pendingDraw += 2;
      n.turn = rushNext(n);
    } else if (card.v === 'wd4'){
      n.pendingDraw += 4;
      n.turn = rushNext(n);
    } else {
      n.turn = rushNext(n);
    }
    return n;
  }

  function rushReshuffle(n){
    if (n.deck.length) return;
    const top = n.pile.pop();
    n.deck = n.pile.map(c => (c.c === 'w' ? { c:'w', v:c.v } : c));
    n.pile = [top];
    for (let i = n.deck.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [n.deck[i], n.deck[j]] = [n.deck[j], n.deck[i]];
    }
  }

  /** Draw: takes the stacked penalty if there is one, else one card then passes. */
  function rushDraw(st, playerId){
    if (rushCurrent(st) !== playerId || st.over) return null;
    const n = JSON.parse(JSON.stringify(st));
    if (n.pendingDraw > 0){
      for (let i = 0; i < n.pendingDraw; i++){
        rushReshuffle(n);
        if (!n.deck.length) break;
        n.hands[playerId].push(n.deck.shift());
      }
      n.note = `Drew ${n.pendingDraw}`;
      n.pendingDraw = 0;
      n.turn = rushNext(n);
      return n;
    }
    rushReshuffle(n);
    if (n.deck.length) n.hands[playerId].push(n.deck.shift());
    n.note = 'Drew a card';
    n.drew = (n.drew || 0) + 1;
    if (n.drew >= 2){ n.drew = 0; n.turn = rushNext(n); }
    return n;
  }

  function cardLabel(c){
    if (c.v === 'skip') return 'skip';
    if (c.v === 'rev') return 'reverse';
    if (c.v === 'd2') return '+2';
    if (c.v === 'wd4') return 'wild +4';
    if (c.v === 'wild') return 'wild';
    return c.v;
  }
  function cardFace(c){
    if (c.v === 'skip') return '\u2298';
    if (c.v === 'rev') return '\u21BB';
    if (c.v === 'd2') return '+2';
    if (c.v === 'wd4') return '+4';
    if (c.v === 'wild') return '\u25C9';
    return c.v;
  }


  /* ══════════════════════════ SCRABBLE — 2-3 players ══════════════════════════
     Standard board, bag, premiums, bingo. Every formed word (main + crosses)
     must appear in assets/scrabble-words.txt (Scrabble-legal English list). */

  const SC_SIZE = 15;
  // premium squares, quadrant-mirrored from the standard board
  const SC_PREM = (() => {
    const g = Array.from({ length: 225 }, () => '');
    const put = (r, c, v) => {
      [[r,c],[r,14-c],[14-r,c],[14-r,14-c]].forEach(([rr,cc]) => { g[rr*15+cc] = v; });
    };
    [[0,0],[0,7],[7,0]].forEach(([r,c]) => put(r,c,'TW'));
    [[1,1],[2,2],[3,3],[4,4]].forEach(([r,c]) => put(r,c,'DW'));
    [[1,5],[5,1],[5,5]].forEach(([r,c]) => put(r,c,'TL'));
    [[0,3],[2,6],[3,0],[3,7],[6,2],[6,6],[7,3]].forEach(([r,c]) => put(r,c,'DL'));
    g[7*15+7] = 'DW';                       // centre star
    return g;
  })();

  const SC_VALUE = {
    A:1,B:3,C:3,D:2,E:1,F:4,G:2,H:4,I:1,J:8,K:5,L:1,M:3,N:1,O:1,
    P:3,Q:10,R:1,S:1,T:1,U:1,V:4,W:4,X:8,Y:4,Z:10,'?':0
  };
  const SC_BAG = {
    A:9,B:2,C:2,D:4,E:12,F:2,G:3,H:2,I:9,J:1,K:1,L:4,M:2,N:6,O:8,
    P:2,Q:1,R:6,S:4,T:6,U:4,V:2,W:2,X:1,Y:2,Z:1,'?':2
  };

  let SC_DICT = null;
  let SC_DICT_LOAD = null;
  function scDictReady(){ return !!SC_DICT; }
  function scLoadDict(){
    if (SC_DICT) return Promise.resolve(SC_DICT);
    if (SC_DICT_LOAD) return SC_DICT_LOAD;
    SC_DICT_LOAD = fetch('assets/scrabble-words.txt?v=20260906l')
      .then(r => {
        if (!r.ok) throw new Error('Dictionary failed to load');
        return r.text();
      })
      .then(text => {
        const set = new Set();
        text.split(/\n+/).forEach(w => {
          const t = w.trim().toUpperCase();
          if (t.length >= 2) set.add(t);
        });
        SC_DICT = set;
        return SC_DICT;
      })
      .catch(err => {
        SC_DICT_LOAD = null;
        throw err;
      });
    return SC_DICT_LOAD;
  }
  function scIsWord(word){
    if (!word || word.length < 2 || !SC_DICT) return false;
    return SC_DICT.has(String(word).toUpperCase());
  }

  function scBag(){
    const bag = [];
    Object.entries(SC_BAG).forEach(([l, n]) => { for (let i = 0; i < n; i++) bag.push(l); });
    for (let i = bag.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  }

  function scrabbleNew(playerIds){
    const players = (playerIds || []).slice(0, 3);
    const bag = scBag();
    const racks = {};
    players.forEach(id => { racks[id] = bag.splice(0, 7); });
    scLoadDict().catch(() => {});
    return {
      players, racks, bag,
      board: Array(225).fill(null),
      scores: Object.fromEntries(players.map(id => [id, 0])),
      turn: 0, passes: 0, lastWord: null, over: false, winner: null
    };
  }

  const scCurrent = st => st.players[st.turn];
  const scAt = (st, r, c) => (r < 0 || r > 14 || c < 0 || c > 14) ? null : st.board[r * 15 + c];

  function scValidate(st, placed){
    if (!placed.length) return { ok: false, why: 'Place at least one tile' };
    for (const p of placed){
      const L = String(p.letter || '').toUpperCase();
      if (!/^[A-Z]$/.test(L)) return { ok: false, why: 'Every tile needs a letter' };
      if (st.board[p.idx]) return { ok: false, why: 'That square is taken' };
      p.letter = L;
    }
    const seen = new Set();
    for (const p of placed){
      if (seen.has(p.idx)) return { ok: false, why: 'Two tiles on the same square' };
      seen.add(p.idx);
    }

    const rows = new Set(placed.map(p => (p.idx / 15) | 0));
    const cols = new Set(placed.map(p => p.idx % 15));
    if (rows.size > 1 && cols.size > 1) return { ok: false, why: 'Tiles must sit in one line' };
    const horizontal = rows.size === 1;

    const tmp = st.board.slice();
    placed.forEach(p => { tmp[p.idx] = { l: p.letter, blank: !!p.blank }; });
    const at = (r, c) => (r < 0 || r > 14 || c < 0 || c > 14) ? null : tmp[r * 15 + c];

    const line = placed.map(p => horizontal ? p.idx % 15 : (p.idx / 15) | 0).sort((a, b) => a - b);
    const fixed = horizontal ? (placed[0].idx / 15) | 0 : placed[0].idx % 15;
    for (let k = line[0]; k <= line[line.length - 1]; k++){
      const cell = horizontal ? at(fixed, k) : at(k, fixed);
      if (!cell) return { ok: false, why: 'No gaps allowed' };
    }

    const firstMove = st.board.every(c => !c);
    if (firstMove){
      if (!placed.some(p => p.idx === 112)) return { ok: false, why: 'The first word must cross the centre' };
      if (placed.length < 2) return { ok: false, why: 'The first word needs at least two letters' };
    } else {
      const touches = placed.some(p => {
        const r = (p.idx / 15) | 0, c = p.idx % 15;
        return !!(scAt(st, r - 1, c) || scAt(st, r + 1, c) || scAt(st, r, c - 1) || scAt(st, r, c + 1));
      });
      if (!touches) return { ok: false, why: 'Must connect to a word already on the board' };
    }
    return { ok: true, horizontal, tmp, firstMove };
  }

  function scWords(st, placed, horizontal, tmp){
    const at = (r, c) => (r < 0 || r > 14 || c < 0 || c > 14) ? null : tmp[r * 15 + c];
    const isNew = new Set(placed.map(p => p.idx));
    const found = new Map();

    const walk = (r, c, dr, dc) => {
      let sr = r, sc = c;
      while (at(sr - dr, sc - dc)){ sr -= dr; sc -= dc; }
      let letters = [], cells = [];
      let rr = sr, cc = sc;
      while (at(rr, cc)){ letters.push(at(rr, cc)); cells.push(rr * 15 + cc); rr += dr; cc += dc; }
      return { word: letters.map(x => x.l).join(''), cells, letters };
    };

    const add = (w) => {
      if (!w || w.word.length < 2) return;
      const key = w.cells.join(',');
      if (!found.has(key)) found.set(key, w);
    };

    const main = horizontal
      ? walk((placed[0].idx / 15) | 0, placed[0].idx % 15, 0, 1)
      : walk((placed[0].idx / 15) | 0, placed[0].idx % 15, 1, 0);
    add(main);

    placed.forEach(p => {
      const r = (p.idx / 15) | 0, c = p.idx % 15;
      add(horizontal ? walk(r, c, 1, 0) : walk(r, c, 0, 1));
    });

    const words = [...found.values()];
    let total = 0;
    const detail = words.map(w => {
      let sum = 0, mult = 1;
      w.cells.forEach((cell, i) => {
        const tile = w.letters[i];
        let v = tile.blank ? 0 : (SC_VALUE[tile.l] || 0);
        if (isNew.has(cell)){
          const prem = SC_PREM[cell];
          if (prem === 'DL') v *= 2;
          else if (prem === 'TL') v *= 3;
          else if (prem === 'DW') mult *= 2;
          else if (prem === 'TW') mult *= 3;
        }
        sum += v;
      });
      const score = sum * mult;
      total += score;
      return { word: w.word, score };
    });
    if (placed.length === 7) total += 50;
    return { words: detail, total, main };
  }

  function scrabblePlay(st, playerId, placed){
    if (scCurrent(st) !== playerId || st.over) return { error: 'Not your turn' };
    if (!SC_DICT) return { error: 'Word list still loading — try again in a moment' };
    const v = scValidate(st, placed);
    if (!v.ok) return { error: v.why };
    const { words, total, main } = scWords(st, placed, v.horizontal, v.tmp);
    if (!words.length) return { error: 'That does not make a word' };
    if (v.firstMove && (!main || main.word.length < 2 || !scIsWord(main.word))){
      return { error: main && main.word ? '"' + main.word + '" is not a word' : 'Need a real word across the centre' };
    }
    for (const w of words){
      if (!scIsWord(w.word)) return { error: '"' + w.word + '" is not a word' };
    }

    const n = JSON.parse(JSON.stringify(st));
    placed.forEach(p => { n.board[p.idx] = { l: p.letter, blank: !!p.blank, by: playerId }; });
    const rack = n.racks[playerId];
    placed.forEach(p => {
      const want = p.blank ? '?' : p.letter;
      const i = rack.indexOf(want);
      if (i >= 0) rack.splice(i, 1);
    });
    while (rack.length < 7 && n.bag.length) rack.push(n.bag.shift());
    n.scores[playerId] = (n.scores[playerId] || 0) + total;
    n.passes = 0;
    n.lastWord = { by: playerId, words: words.map(w => w.word), score: total };
    // Bag empty after this play → game over; highest score wins.
    if (!n.bag.length){
      n.over = true;
      n.winner = scWinner(n);
      return { state: n, total, words };
    }
    n.turn = (n.turn + 1) % n.players.length;
    return { state: n, total, words };
  }

  function scWinner(st){
    return st.players.slice().sort((a, b) => (st.scores[b] || 0) - (st.scores[a] || 0))[0];
  }

  function scrabblePass(st, playerId){
    if (scCurrent(st) !== playerId || st.over) return null;
    const n = JSON.parse(JSON.stringify(st));
    n.passes = (n.passes || 0) + 1;
    n.lastWord = { by: playerId, words: [], score: 0, passed: true };
    if (n.passes >= n.players.length * 2 || !n.bag.length){
      n.over = true;
      n.winner = scWinner(n);
      return n;
    }
    n.turn = (n.turn + 1) % n.players.length;
    return n;
  }

  function scrabbleSwap(st, playerId, idxs){
    if (scCurrent(st) !== playerId || st.over) return null;
    if (st.bag.length < 1) return null;
    const n = JSON.parse(JSON.stringify(st));
    const rack = n.racks[playerId];
    const out = idxs.slice().sort((a, b) => b - a).map(i => rack.splice(i, 1)[0]).filter(Boolean);
    while (rack.length < 7 && n.bag.length) rack.push(n.bag.shift());
    n.bag.push(...out);
    for (let i = n.bag.length - 1; i > 0; i--){
      const j = Math.floor(Math.random() * (i + 1));
      [n.bag[i], n.bag[j]] = [n.bag[j], n.bag[i]];
    }
    n.passes = 0;
    n.lastWord = { by: playerId, words: [], score: 0, swapped: out.length };
    n.turn = (n.turn + 1) % n.players.length;
    return n;
  }

  /* ══════════════════════════ BOTS ══════════════════════════
     One opponent per game so nothing needs a second human to be playable.
     Each returns an intent the caller applies, never a mutated state. */

  /** Colour Rush: dump the awkward cards first, keep wilds for when you are stuck. */
  function rushBot(st, playerId){
    const hand = st.hands[playerId] || [];
    const legal = [];
    hand.forEach((c, i) => { if (rushPlayable(c, st)) legal.push({ c, i }); });
    if (!legal.length) return { type: 'draw' };
    const rank = ({ c }) => (c.c === 'w' ? 3 : (c.v === 'd2' || c.v === 'skip' || c.v === 'rev' ? 0 : 1));
    legal.sort((a, b) => rank(a) - rank(b));
    const pick = legal[0];
    let colour = null;
    if (pick.c.c === 'w'){
      // choose the colour it holds most of
      const tally = {};
      hand.forEach(c => { if (c.c !== 'w') tally[c.c] = (tally[c.c] || 0) + 1; });
      colour = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || RUSH_COLOURS[0];
    }
    return { type: 'play', idx: pick.i, colour };
  }

  /** Crazy Eights: play the highest-value match, saving wild eights for last. */
  function eightsBot(st, seat){
    const hand = st.hands[seat] || [];
    const legal = [];
    hand.forEach((c, i) => { if (cardPlayable(c, st)) legal.push({ c, i }); });
    if (!legal.length) return { type: 'draw' };
    legal.sort((a, b) => (a.c.r === '8' ? 1 : 0) - (b.c.r === '8' ? 1 : 0));
    const pick = legal[0];
    let suit = null;
    if (pick.c.r === '8'){
      const tally = {};
      hand.forEach(c => { if (c.r !== '8') tally[c.s] = (tally[c.s] || 0) + 1; });
      suit = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0] || SUITS[0];
    }
    return { type: 'play', idx: pick.i, suit };
  }

  /* Scrabble: no clever engine, just an honest search. Try short placements at every
     square in both directions and let scrabblePlay() be the judge — it already knows
     every rule and owns the dictionary, so the bot cannot cheat by construction.
     Bounded by a work budget so a turn never hangs the tab. */
  const SC_BOT_BUDGET = 26000;
  function scrabbleBot(st, playerId){
    if (!SC_DICT) return null;
    const rack = (st.racks[playerId] || []).filter(l => l !== '?');
    if (!rack.length) return null;
    const letters = [...new Set(rack)];
    let budget = SC_BOT_BUDGET;
    let best = null;

    const tryPlaced = placed => {
      if (budget-- <= 0) return;
      const res = scrabblePlay(st, playerId, placed);
      if (res.error) return;
      if (!best || res.total > best.total) best = { placed, total: res.total };
    };

    // Candidate starts: every empty square that touches a tile (or the centre, move one).
    const starts = [];
    const filled = st.board.some(Boolean);
    for (let i = 0; i < SC_SIZE * SC_SIZE; i++){
      if (st.board[i]) continue;
      if (!filled){ if (i === 112) starts.push(i); continue; }
      const r = Math.floor(i / SC_SIZE), c = i % SC_SIZE;
      const touch =
        (c > 0 && st.board[i - 1]) || (c < SC_SIZE - 1 && st.board[i + 1]) ||
        (r > 0 && st.board[i - SC_SIZE]) || (r < SC_SIZE - 1 && st.board[i + SC_SIZE]);
      if (touch) starts.push(i);
    }
    if (!starts.length) return null;

    for (const start of starts){
      if (budget <= 0) break;
      for (const step of [1, SC_SIZE]){                    // across, then down
        // walk forward over empty squares, laying 1..3 tiles
        const build = (idx, used, depth) => {
          if (budget <= 0 || depth > 3) return;
          let at = idx;
          while (at < SC_SIZE * SC_SIZE && st.board[at]) at += step;   // skip existing tiles
          if (at >= SC_SIZE * SC_SIZE) return;
          if (step === 1 && Math.floor(at / SC_SIZE) !== Math.floor(idx / SC_SIZE)) return;
          for (const L of letters){
            const next = used.concat([{ idx: at, letter: L }]);
            if (next.length >= 2) tryPlaced(next);
            build(at + step, next, depth + 1);
          }
        };
        build(start, [], 1);
      }
    }
    return best ? best.placed : null;
  }

  /* ══════════════════════════ REGISTRY ══════════════════════════ */

  const GAMES = {
    chess: {
      id: 'chess', name: 'Chess', blurb: 'Full rules. One move each, in the thread.',
      icon: '♞', color: '#5B6ABF',
      create: chessNew,
      summary(st){
        const s = chessStatus(st);
        if (s === 'checkmate') return `Checkmate — ${st.turn === 'w' ? 'Black' : 'White'} wins`;
        if (s === 'stalemate') return 'Stalemate — draw';
        if (s === 'draw') return 'Draw';
        return `${st.turn === 'w' ? 'White' : 'Black'} to move${s === 'check' ? ' · check' : ''}`;
      },
      over: st => ['checkmate','stalemate','draw'].includes(chessStatus(st))
    },
    rush: {
      id: 'rush', name: 'Colour Rush', blurb: 'Match colour or number. 2 to 4 players.',
      icon: '\u25C9', color: '#E0A33E', group: true, maxPlayers: 4,
      create: rushNew,
      summary(st){
        if (st.over) return 'Game over';
        const counts = st.players.map(id => (st.hands[id] || []).length).join(' \u00b7 ');
        return `${COLOUR_NAME[st.colour]}${st.pendingDraw ? ' \u00b7 +' + st.pendingDraw : ''} \u00b7 ${counts}`;
      },
      over: st => !!st.over
    },
    scrabble: {
      id: 'scrabble', name: 'Scrabble', blurb: 'Real words only. Two or three players.',
      icon: '\u25A6', color: '#C89B5A', group: true, maxPlayers: 3,
      create: scrabbleNew,
      summary(st){
        if (st.over) return 'Game over';
        const line = st.players.map(id => st.scores[id] || 0).join(' \u00b7 ');
        return `${line} \u00b7 ${st.bag.length} left`;
      },
      over: st => !!st.over
    },
    eights: {
      id: 'eights', name: 'Crazy Eights', blurb: 'Match suit or rank. Eights are wild.',
      icon: '♣', color: '#C2544D',
      create: eightsNew,
      summary(st){
        if (st.over) return 'Game over';
        return `${st.suit} · ${st.hands.host.length}v${st.hands.guest.length} cards`;
      },
      over: st => !!st.over
    }
  };

  /* ── a small opponent: 2-ply material + centre control, good enough to lose to ── */
  const VALUE = { P:100, N:320, B:330, R:500, Q:900, K:0 };
  const CENTRE = [27, 28, 35, 36];

  function evaluate(g, forColor){
    let score = 0;
    for (let i = 0; i < 64; i++){
      const p = g.board[i];
      if (!p) continue;
      const v = VALUE[typeOf(p)] + (CENTRE.includes(i) ? 12 : 0);
      score += colorOf(p) === forColor ? v : -v;
    }
    return score;
  }

  /** Negamax to `depth` plies with no pruning - the board is small enough. */
  function search(g, depth, forColor){
    const moves = allLegalFor(g);
    if (!moves.length){
      return { score: inCheck(g, g.turn)
        ? (g.turn === forColor ? -99999 : 99999)
        : 0, move: null };
    }
    if (depth === 0) return { score: evaluate(g, forColor), move: null };
    let best = null, bestScore = g.turn === forColor ? -Infinity : Infinity;
    for (const mv of moves){
      const child = chessApply(g, mv);
      const { score } = search(child, depth - 1, forColor);
      if (g.turn === forColor ? score > bestScore : score < bestScore){
        bestScore = score; best = mv;
      }
    }
    return { score: bestScore, move: best };
  }
  function allLegalFor(g){
    const out = [];
    for (let i = 0; i < 64; i++){
      if (g.board[i] && colorOf(g.board[i]) === g.turn) out.push(...legalMoves(g, i));
    }
    return out;
  }
  /** Pick a reply for whoever is to move. depth 2 answers instantly on a phone. */
  function botMove(g, depth = 2){
    const moves = allLegalFor(g);
    if (!moves.length) return null;
    const { move } = search(g, depth, g.turn);
    return move || moves[Math.floor(Math.random() * moves.length)];
  }

  global.MyloGames = {
    uid, GAMES,
    chess: {
      create: chessNew, apply: chessApply, legalMoves, allLegal,
      status: chessStatus, inCheck, moveLabel, sq, GLYPH, colorOf, typeOf, rc, idx,
      botMove, evaluate, pieceSVG
    },
    eights: {
      create: eightsNew, play: eightsPlay, draw: eightsDraw,
      playable: cardPlayable, isRed, SUITS, bot: eightsBot
    },
    scrabble: {
      create: scrabbleNew, play: scrabblePlay, pass: scrabblePass, swap: scrabbleSwap,
      validate: scValidate, words: scWords, current: scCurrent,
      loadDict: scLoadDict, isWord: scIsWord, dictReady: scDictReady,
      PREM: SC_PREM, VALUE: SC_VALUE, SIZE: SC_SIZE, bot: scrabbleBot
    },
    rush: {
      create: rushNew, play: rushPlay, draw: rushDraw, playable: rushPlayable,
      current: rushCurrent, next: rushNext, cardFace, cardLabel,
      COLOURS: RUSH_COLOURS, COLOUR_NAME, bot: rushBot
    }
  };
})(window);
