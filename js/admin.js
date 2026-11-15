/* Mylo CRM — desktop admin console (same theme + auth as the app) */
const CFG = window.MYLO_CONFIG || window.SEPHORA_CONFIG || {};
const sb = window.supabase.createClient(CFG.url, CFG.anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Same key as the main app so an already-signed-in owner can open CRM
    storageKey: 'mylo-auth'
  }
});

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const emailFromUsername = (u) => `${String(u || '').toLowerCase()}@${CFG.emailDomain || 'example.com'}`;

let adminProfile = null;
let selectedUser = null;
let toastTimer = 0;

function isDesktop(){
  return window.matchMedia('(min-width: 981px)').matches;
}
function toast(msg){
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2400);
}
function fmtDate(v){
  if (!v) return '—';
  try{
    return new Date(v).toLocaleDateString(undefined, { year:'numeric', month:'short', day:'numeric' });
  }catch{ return '—'; }
}
function planPill(plan){
  const p = plan || 'free';
  return `<span class="pill pill-${p}">${p}</span>`;
}
function statusPill(u){
  if (u.banned_at) return `<span class="pill pill-bad">Banned</span>`;
  if (u.disabled_at) return `<span class="pill pill-warn">Disabled</span>`;
  return `<span class="pill pill-ok">Active</span>`;
}
function errMsg(e){
  const m = e?.message || String(e || 'Something went wrong');
  if (/Invalid login|invalid.*credentials|Email.*password/i.test(m)){
    return 'Wrong username or password';
  }
  if (/not authorized|not an admin/i.test(m)) return 'This account is not an admin';
  if (/Failed to fetch|NetworkError|fetch/i.test(m)) return 'Network error — check connection and retry';
  return m;
}

function closeDrawer(){
  const drawer = $('#drawer');
  if (!drawer) return;
  drawer.hidden = true;
  drawer.setAttribute('aria-hidden', 'true');
}
function showLogin(){
  $('#login-view').hidden = false;
  $('#app-view').hidden = true;
  closeDrawer();
}
function showApp(){
  $('#login-view').hidden = true;
  $('#app-view').hidden = false;
  closeDrawer();
  $('#admin-who').textContent = `@${adminProfile.username}`;
}

async function requireAdmin(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session?.user) return false;
  const { data: profile, error: pErr } = await sb
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .maybeSingle();
  if (pErr || !profile){
    await sb.auth.signOut();
    return false;
  }
  if (!profile.is_admin || profile.disabled_at || profile.banned_at){
    await sb.auth.signOut();
    return false;
  }
  // Confirm RPC path works for admin actions
  const { data: ok, error } = await sb.rpc('is_app_admin');
  if (error || !ok){
    await sb.auth.signOut();
    return false;
  }
  adminProfile = profile;
  return true;
}

/* The CRM signs in with the same account as the app, so it has to resolve a
   handle the same way. It used to build `name@example.com` from the username,
   which stopped working the moment accounts started carrying a real address —
   the console simply refused everyone, including the owner. */
const isEmail = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(v || '').trim());
async function resolveLoginEmail(raw){
  const v = String(raw || '').trim();
  if (isEmail(v)) return v.toLowerCase();
  const uname = v.toLowerCase().replace(/^@/, '').replace(/[^a-z0-9_]/g, '').slice(0, 20);
  const { data, error } = await sb.rpc('email_for_username', { p_username: uname });
  if (error) throw error;
  return data || emailFromUsername(uname);
}
async function login(){
  const raw = ($('#admin-user').value || '').trim();
  const password = $('#admin-pass').value || '';
  const err = $('#login-err');
  err.hidden = true;
  if (!raw){
    err.textContent = 'Enter your username or email';
    err.hidden = false;
    return;
  }
  if (password.length < 4){
    err.textContent = 'Password needs 4+ characters';
    err.hidden = false;
    return;
  }
  $('#admin-login').disabled = true;
  try{
    // Clear any stale non-admin session first
    try{ await sb.auth.signOut({ scope: 'local' }); }catch(_){}
    const { data, error } = await sb.auth.signInWithPassword({
      email: await resolveLoginEmail(raw),
      password
    });
    if (error) throw error;
    if (!data?.session){
      err.textContent = 'Sign in failed — try again';
      err.hidden = false;
      return;
    }
    const ok = await requireAdmin();
    if (!ok){
      err.textContent = 'This account is not an admin';
      err.hidden = false;
      showLogin();
      return;
    }
    showApp();
    await loadOverview();
    await loadUsers();
    await loadRooms();
    toast('Welcome to Mylo CRM');
  }catch(e){
    err.textContent = errMsg(e);
    err.hidden = false;
  }finally{
    $('#admin-login').disabled = false;
  }
}

async function loadOverview(){
  const { data, error } = await sb.rpc('admin_dashboard_stats');
  if (error){ toast(errMsg(error)); return; }
  const s = data || {};
  $('#stat-grid').innerHTML = [
    ['Total users', s.users_total, `${s.signups_7d || 0} new this week`],
    ['Active', s.users_active, `${s.users_banned || 0} banned · ${s.users_disabled || 0} disabled`],
    ['Pro / Pod', `${s.plan_pro || 0} / ${s.plan_pod || 0}`, `${s.plan_free || 0} on free`],
    ['Credits in wallets', s.credits_total, 'Across all accounts'],
    ['Rooms', s.rooms_total, `${s.goals_total || 0} goals total`],
    ['Messages', s.messages_total, 'All room chat'],
    ['Signups 30d', s.signups_30d, 'Last month'],
    ['Signups 7d', s.signups_7d, 'Last 7 days'],
  ].map(([k,v,d]) => `
    <article class="stat">
      <div class="k">${k}</div>
      <div class="v">${v ?? 0}</div>
      <div class="d">${d}</div>
    </article>`).join('');
}

async function loadUsers(){
  const q = ($('#user-q').value || '').trim();
  const { data, error } = await sb.rpc('admin_list_users', {
    p_query: q || null,
    p_limit: 100,
    p_offset: 0
  });
  if (error){ toast(errMsg(error)); return; }
  const rows = data || [];
  $('#users-body').innerHTML = rows.map(u => `
    <tr>
      <td>
        <div class="user-cell">
          <strong>@${esc(u.username)}</strong>
          <span>${u.badge ? `<b class="tag-${esc(u.badge)}">${esc(u.badge)}</b> · ` : ''}${esc(u.char_name || '—')}${u.is_admin ? ' · admin' : ''}</span>
        </div>
      </td>
      <td>${planPill(u.plan)}</td>
      <td><strong>${u.credits ?? 0}</strong></td>
      <td><span class="user-cell"><span>${u.rooms_count || 0} rooms · ${u.goals_count || 0} goals</span></span></td>
      <td>${statusPill(u)}</td>
      <td>${fmtDate(u.created_at)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn-ghost btn-sm" data-open-user="${u.id}">Manage</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" style="color:var(--muted);padding:28px">No users found.</td></tr>`;
}

async function loadRooms(){
  const q = ($('#room-q').value || '').trim();
  const { data, error } = await sb.rpc('admin_list_rooms', {
    p_query: q || null,
    p_limit: 100,
    p_offset: 0
  });
  if (error){ toast(errMsg(error)); return; }
  const rows = data || [];
  $('#rooms-body').innerHTML = rows.map(r => `
    <tr>
      <td><strong>${esc(r.title || 'Untitled')}</strong><div style="color:var(--muted);font-size:12px">${esc(r.kind || 'room')}</div></td>
      <td><code>${esc(r.code || '—')}</code></td>
      <td>@${esc(r.owner_username || '—')}</td>
      <td>${r.members_count || 0}</td>
      <td>${r.goals_count || 0}</td>
      <td>${fmtDate(r.created_at)}</td>
      <td>
        <div class="row-actions">
          <button type="button" class="btn-danger btn-sm" data-del-room="${r.id}" data-room-title="${escAttr(r.title || r.code || 'room')}">Delete</button>
        </div>
      </td>
    </tr>`).join('') || `<tr><td colspan="7" style="color:var(--muted);padding:28px">No rooms found.</td></tr>`;
}

function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escAttr(s){ return esc(s).replace(/`/g, ''); }

async function openUser(id){
  const { data, error } = await sb.rpc('admin_list_users', { p_query: null, p_limit: 200, p_offset: 0 });
  if (error){ toast(errMsg(error)); return; }
  selectedUser = (data || []).find(u => u.id === id);
  if (!selectedUser){ toast('User not found'); return; }
  const u = selectedUser;
  $('#drawer-title').textContent = `@${u.username}`;
  $('#drawer-sub').textContent = `Joined ${fmtDate(u.created_at)} · ${u.rooms_count || 0} rooms · ${u.goals_count || 0} goals`;
  $('#drawer-body').innerHTML = `
    <div class="support-block">
      <div class="support-k">Support</div>
      <div class="support-d">Adjust plan, tokens, and access for @${esc(u.username)}</div>
    </div>
    <div class="field">
      <label>Plan</label>
      <select id="edit-plan">
        <option value="free" ${u.plan==='free'?'selected':''}>Free</option>
        <option value="pro" ${u.plan==='pro'?'selected':''}>Pro</option>
        <option value="pod" ${u.plan==='pod'?'selected':''}>Pod</option>
      </select>
    </div>
    <div class="field">
      <label>Tokens</label>
      <input id="edit-credits" type="number" min="0" max="1000000" value="${Number(u.credits)||0}">
    </div>
    <div class="action-grid">
      <button type="button" class="btn-soft" data-credit-delta="-100">−100</button>
      <button type="button" class="btn-soft" data-credit-delta="-25">−25</button>
      <button type="button" class="btn-soft" data-credit-delta="25">+25</button>
      <button type="button" class="btn-soft" data-credit-delta="100">+100</button>
      <button type="button" class="btn-soft" data-credit-delta="400">+400</button>
      <button type="button" class="btn-primary wide" id="save-user">Save plan & tokens</button>
    </div>
    <div class="support-block">
      <div class="support-k">$MYL</div>
      <div class="support-d">${adminProfile && u.id === adminProfile.id
        ? 'Your own balance. Minted straight in, up to 20,000 a time.'
        : 'Minted and sent. Lands in their wallet with the note attached.'}</div>
      <div class="award-row">
        <input id="award-amount" type="number" min="1" max="20000" value="100" aria-label="Amount">
        <button type="button" class="btn-primary" id="award-myl">${adminProfile && u.id === adminProfile.id ? 'Add to my balance' : 'Send $MYL'}</button>
      </div>
      <input id="award-note" maxlength="60" placeholder="What it is for — e.g. bug BUG-4KZQ2" aria-label="Note">
      <div class="action-grid award-quick">
        <button type="button" class="btn-soft" data-award-preset="100">100</button>
        <button type="button" class="btn-soft" data-award-preset="250">250</button>
        <button type="button" class="btn-soft" data-award-preset="500">500</button>
        <button type="button" class="btn-soft" data-award-preset="1000">1,000</button>
        <button type="button" class="btn-soft" data-award-preset="5000">5,000</button>
      </div>
    </div>
    <div class="support-block">
      <div class="support-k">Badge</div>
      <div class="support-d">A tester gets paid features while they help. Founder is the team.</div>
      <div class="badge-pick" role="radiogroup" aria-label="Badge">
        <button type="button" class="badge-opt ${!u.badge ? 'is-on' : ''}" data-set-badge="">None</button>
        <button type="button" class="badge-opt is-tester ${u.badge === 'tester' ? 'is-on' : ''}" data-set-badge="tester">Tester</button>
        <button type="button" class="badge-opt is-founder ${u.badge === 'founder' ? 'is-on' : ''}" data-set-badge="founder">Founder</button>
      </div>
    </div>
    <div class="support-block">
      <div class="support-k">Integrations</div>
      <button type="button" class="btn-ghost wide" data-unlink-tg="${u.id}">Remove Telegram link</button>
      <button type="button" class="btn-ghost wide" data-unlink-wa="${u.id}">Remove WhatsApp link</button>
    </div>
    <div class="support-block">
      <div class="support-k">Access</div>
      <button type="button" class="btn-ghost wide" data-status-disabled="${u.disabled_at ? '0' : '1'}">${u.disabled_at ? 'Enable account' : 'Disable account'}</button>
      <button type="button" class="btn-ghost wide" data-status-banned="${u.banned_at ? '0' : '1'}">${u.banned_at ? 'Unban user' : 'Ban user'}</button>
      <button type="button" class="btn-danger wide" id="soft-delete-user" ${u.is_admin ? 'disabled' : ''}>Delete user</button>
    </div>`;
  const drawer = $('#drawer');
  if (drawer){
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
  }
}

async function saveUser(){
  if (!selectedUser) return;
  const plan = $('#edit-plan').value;
  const credits = Number($('#edit-credits').value || 0);
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    sb.rpc('admin_set_user_plan', { p_user_id: selectedUser.id, p_plan: plan }),
    sb.rpc('admin_set_user_credits', { p_user_id: selectedUser.id, p_credits: credits })
  ]);
  if (e1 || e2){ toast(errMsg(e1 || e2)); return; }
  toast('User updated');
  closeDrawer();
  await Promise.all([loadUsers(), loadOverview()]);
}

/* ── The queues ───────────────────────────────────────────────────────────
   bug_reports and feature_requests deny everything at the table, so these read
   through functions that check who is asking. A report is worth 100 $MYL when
   it is confirmed, and the pay button does the award and the marking in one
   move — two steps is how a tester ends up confirmed but never paid. */
let bugFilter = 'new';
let featureFilter = 'open';

function when(v){
  if (!v) return '';
  const d = new Date(v), now = Date.now(), diff = (now - d) / 1000;
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  if (diff < 604800) return Math.round(diff / 86400) + 'd ago';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
function bugStatusPill(st){
  const cls = { confirmed: 'pill-ok', fixed: 'pill-ok', duplicate: 'pill-warn', invalid: 'pill-bad' }[st] || '';
  return `<span class="pill ${cls}">${esc(st)}</span>`;
}
async function loadBugs(){
  const box = $('#bugs-list'); if (!box) return;
  box.innerHTML = '<div class="queue-empty">Loading…</div>';
  const { data, error } = await sb.rpc('admin_list_bugs', { p_status: bugFilter, p_limit: 200 });
  if (error){ box.innerHTML = `<div class="queue-empty">${esc(errMsg(error))}</div>`; return; }
  const rows = data || [];
  const chip = $('#bugs-count');
  if (chip){
    const open = rows.filter(r => r.status === 'new').length;
    chip.textContent = open; chip.hidden = bugFilter !== 'new' || !open;
  }
  if (!rows.length){ box.innerHTML = '<div class="queue-empty">Nothing here.</div>'; return; }
  box.innerHTML = rows.map(r => `
    <article class="qcard">
      <div class="qtop">
        <span class="qref">${esc(r.ref)}</span>
        ${bugStatusPill(r.status)}
        <span class="pill">${esc(r.area || '—')}</span>
        <span class="qwho">${r.username ? '@' + esc(r.username) : 'anonymous'}${r.can_pay ? '' : ' · no account'}</span>
        <span class="qwhen">${esc(when(r.created_at))}</span>
        ${r.awarded_at ? `<span class="pill pill-ok">paid ${Number(r.award) || 0}</span>` : ''}
      </div>
      <p class="qbody">${esc(r.detail)}</p>
      ${r.agent ? `<div class="qagent">${esc(r.agent)}</div>` : ''}
      <div class="qacts">
        ${r.status === 'new' ? `
          <button type="button" class="btn-primary btn-sm" data-bug-confirm="${esc(r.ref)}" data-bug-user="${esc(r.username || '')}" ${r.can_pay ? '' : 'disabled title="No matching account to pay"'}>Confirm &amp; pay 100</button>
          <button type="button" class="btn-ghost btn-sm" data-bug-status="${esc(r.ref)}" data-to="duplicate">Duplicate</button>
          <button type="button" class="btn-ghost btn-sm" data-bug-status="${esc(r.ref)}" data-to="invalid">Invalid</button>` : ''}
        ${r.status === 'confirmed' ? `<button type="button" class="btn-ghost btn-sm" data-bug-status="${esc(r.ref)}" data-to="fixed">Mark fixed</button>` : ''}
        ${r.status !== 'new' ? `<button type="button" class="btn-ghost btn-sm" data-bug-status="${esc(r.ref)}" data-to="new">Reopen</button>` : ''}
      </div>
    </article>`).join('');
}
/* Everyone who joined from staymylo.com. The table denies everything, so this
   reads through admin_list_waitlist, which only answers a signed-in admin. */
let waitlistEmails = [];
async function loadWaitlist(){
  const box = $('#waitlist-body'); if (!box) return;
  box.innerHTML = '<tr><td colspan="5">Loading…</td></tr>';
  const { data, error } = await sb.rpc('admin_list_waitlist', { p_limit: 5000 });
  if (error){
    const missing = /admin_list_waitlist/.test(error.message || '');
    box.innerHTML = `<tr><td colspan="5">${esc(missing ? 'Run supabase/apply/APPLY_20261102_waitlist_admin.sql in the Supabase SQL editor first.' : errMsg(error))}</td></tr>`;
    return;
  }
  const rows = data || [];
  waitlistEmails = rows.map(r => r.email);
  const chip = $('#waitlist-count');
  if (chip){ chip.textContent = rows.length; chip.hidden = !rows.length; }
  if (!rows.length){ box.innerHTML = '<tr><td colspan="5">Nobody yet.</td></tr>'; return; }
  box.innerHTML = rows.map(r => `
    <tr>
      <td>${esc(r.email)}</td>
      <td>${esc(when(r.created_at))}</td>
      <td>${Number(r.referrals) || 0}</td>
      <td>${esc(r.referrer || r.source || '—')}</td>
      <td>${r.invited_at ? esc(when(r.invited_at)) : '—'}</td>
    </tr>`).join('');
}
async function loadFeatures(){
  const box = $('#features-list'); if (!box) return;
  box.innerHTML = '<div class="queue-empty">Loading…</div>';
  const { data, error } = await sb.rpc('admin_list_features', { p_status: featureFilter, p_limit: 200 });
  if (error){ box.innerHTML = `<div class="queue-empty">${esc(errMsg(error))}</div>`; return; }
  const rows = data || [];
  const chip = $('#features-count');
  if (chip){
    const open = rows.filter(r => r.status === 'open').length;
    chip.textContent = open; chip.hidden = featureFilter !== 'open' || !open;
  }
  if (!rows.length){ box.innerHTML = '<div class="queue-empty">Nothing here.</div>'; return; }
  box.innerHTML = rows.map(r => `
    <article class="qcard">
      <div class="qtop">
        <span class="qvotes">${Number(r.votes) || 0}<i>want</i></span>
        <span class="qref">${esc(r.ref)}</span>
        <span class="pill">${esc(r.status)}</span>
        <span class="pill">${esc(r.area || '—')}</span>
        <span class="qwho">${r.username ? '@' + esc(r.username) : 'anonymous'}</span>
        <span class="qwhen">${esc(when(r.created_at))}</span>
      </div>
      <div class="qtitle">${esc(r.title)}</div>
      <p class="qbody">${esc(r.detail)}</p>
      ${r.note ? `<div class="qnote">${esc(r.note)}</div>` : ''}
      <div class="qacts">
        <button type="button" class="btn-ghost btn-sm" data-feature-status="${esc(r.ref)}" data-to="planned">Planned</button>
        <button type="button" class="btn-ghost btn-sm" data-feature-status="${esc(r.ref)}" data-to="building">Building</button>
        <button type="button" class="btn-primary btn-sm" data-feature-status="${esc(r.ref)}" data-to="shipped">Shipped</button>
        <button type="button" class="btn-ghost btn-sm" data-feature-status="${esc(r.ref)}" data-to="declined">Not planned</button>
      </div>
    </article>`).join('');
}

function setTab(tab){
  $$('.nav').forEach(n => n.classList.toggle('on', n.dataset.tab === tab));
  if (tab === 'bugs') loadBugs();
  if (tab === 'waitlist') loadWaitlist();
  if (tab === 'features') loadFeatures();
  ['overview','users','rooms','waitlist','bugs','features'].forEach(t => {
    const el = $(`#tab-${t}`);
    if (el) el.hidden = t !== tab;
  });
}

function gateDesktop(){
  const mobile = !isDesktop();
  $('#mobile-block').hidden = !mobile;
  if (mobile){
    $('#login-view').hidden = true;
    $('#app-view').hidden = true;
    closeDrawer();
  }
}

function bind(){
  $('#admin-login')?.addEventListener('click', login);
  $('#admin-pass')?.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
  $('#admin-user')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('#admin-pass')?.focus(); });
  $('#pass-toggle')?.addEventListener('click', () => {
    const input = $('#admin-pass');
    const btn = $('#pass-toggle');
    if (!input || !btn) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.textContent = show ? 'Hide' : 'Show';
  });
  $('#admin-logout')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    adminProfile = null;
    showLogin();
  });
  $('#crm-theme')?.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try{ localStorage.setItem('mylo:crm-theme', next); }catch(_){}
    const btn = $('#crm-theme');
    if (btn) btn.textContent = next === 'dark' ? 'Light mode' : 'Dark mode';
  });
  try{
    const saved = localStorage.getItem('mylo:crm-theme');
    if (saved === 'dark' || saved === 'light'){
      document.documentElement.setAttribute('data-theme', saved);
      const btn = $('#crm-theme');
      if (btn) btn.textContent = saved === 'dark' ? 'Light mode' : 'Dark mode';
    }
  }catch(_){}
  $$('.nav').forEach(btn => btn.addEventListener('click', () => setTab(btn.dataset.tab)));
  $('#refresh-overview')?.addEventListener('click', loadOverview);
  $('#refresh-users')?.addEventListener('click', loadUsers);
  $('#refresh-rooms')?.addEventListener('click', loadRooms);
  $('#refresh-bugs')?.addEventListener('click', loadBugs);
  $('#refresh-waitlist')?.addEventListener('click', loadWaitlist);
  $('#copy-waitlist')?.addEventListener('click', async e => {
    await navigator.clipboard.writeText(waitlistEmails.join('\n'));
    e.target.textContent = `Copied ${waitlistEmails.length}`;
    setTimeout(() => { e.target.textContent = 'Copy emails'; }, 1600);
  });
  $('#refresh-features')?.addEventListener('click', loadFeatures);
  $('#user-q')?.addEventListener('keydown', e => { if (e.key === 'Enter') loadUsers(); });
  $('#room-q')?.addEventListener('keydown', e => { if (e.key === 'Enter') loadRooms(); });
  $('#drawer-close')?.addEventListener('click', closeDrawer);
  $('#drawer')?.addEventListener('click', e => { if (e.target.id === 'drawer') closeDrawer(); });

  document.addEventListener('click', async e => {
    const open = e.target.closest('[data-open-user]');
    if (open){ openUser(open.dataset.openUser); return; }

    const delRoom = e.target.closest('[data-del-room]');
    if (delRoom){
      const title = delRoom.dataset.roomTitle || 'this room';
      if (!confirm(`Delete room “${title}”? This cannot be undone.`)) return;
      const { error } = await sb.rpc('admin_delete_room', { p_room_id: delRoom.dataset.delRoom });
      if (error) toast(errMsg(error));
      else { toast('Room deleted'); await Promise.all([loadRooms(), loadOverview()]); }
      return;
    }

    const bugFilterBtn = e.target.closest('[data-bug-filter]');
    if (bugFilterBtn){
      bugFilter = bugFilterBtn.dataset.bugFilter;
      $$('[data-bug-filter]').forEach(b => b.classList.toggle('on', b === bugFilterBtn));
      loadBugs(); return;
    }
    const featFilterBtn = e.target.closest('[data-feature-filter]');
    if (featFilterBtn){
      featureFilter = featFilterBtn.dataset.featureFilter;
      $$('[data-feature-filter]').forEach(b => b.classList.toggle('on', b === featFilterBtn));
      loadFeatures(); return;
    }
    const confirmBug = e.target.closest('[data-bug-confirm]');
    if (confirmBug){
      const ref = confirmBug.dataset.bugConfirm, who = confirmBug.dataset.bugUser;
      confirmBug.disabled = true;
      // Pay first: marking it paid when the payment failed is the worse lie.
      const pay = await sb.rpc('admin_award_myl', { p_username: who, p_amount: 100, p_note: `Bug ${ref}` });
      if (pay.error){ confirmBug.disabled = false; toast(errMsg(pay.error)); return; }
      const { error } = await sb.rpc('admin_set_bug_status', { p_ref: ref, p_status: 'confirmed', p_award: 100 });
      if (error){ toast(errMsg(error)); return; }
      toast(`${ref} confirmed — 100 $MYL to @${who}`);
      loadBugs(); return;
    }
    const bugStatus = e.target.closest('[data-bug-status]');
    if (bugStatus){
      const { error } = await sb.rpc('admin_set_bug_status', { p_ref: bugStatus.dataset.bugStatus, p_status: bugStatus.dataset.to, p_award: null });
      if (error){ toast(errMsg(error)); return; }
      toast(`${bugStatus.dataset.bugStatus} → ${bugStatus.dataset.to}`);
      loadBugs(); return;
    }
    const featStatus = e.target.closest('[data-feature-status]');
    if (featStatus){
      const { error } = await sb.rpc('admin_set_feature_status', { p_ref: featStatus.dataset.featureStatus, p_status: featStatus.dataset.to, p_note: null });
      if (error){ toast(errMsg(error)); return; }
      toast(`${featStatus.dataset.featureStatus} → ${featStatus.dataset.to}`);
      loadFeatures(); return;
    }

    const preset = e.target.closest('[data-award-preset]');
    if (preset){ const f = $('#award-amount'); if (f) f.value = preset.dataset.awardPreset; return; }

    if (e.target.closest('#award-myl') && selectedUser){
      const btn = e.target.closest('#award-myl');
      const amount = Number($('#award-amount')?.value || 0);
      const note = ($('#award-note')?.value || '').trim();
      if (!(amount > 0)){ toast('Enter an amount'); return; }
      btn.disabled = true;
      /* Paying yourself is a mint, paying anyone else is a mint plus a send.
         One control, because from here they are the same intention. */
      const self = adminProfile && selectedUser.id === adminProfile.id;
      const { error } = self
        ? await sb.rpc('admin_grant_myl', { p_amount: amount, p_reason: note || null })
        : await sb.rpc('admin_award_myl', { p_username: selectedUser.username, p_amount: amount, p_note: note || null });
      btn.disabled = false;
      if (error){ toast(errMsg(error)); return; }
      toast(`${amount.toLocaleString()} $MYL → ${self ? 'you' : '@' + selectedUser.username}`);
      if ($('#award-note')) $('#award-note').value = '';
      return;
    }

    const badge = e.target.closest('[data-set-badge]');
    if (badge && selectedUser){
      const val = badge.dataset.setBadge || null;
      const { error } = await sb.rpc('admin_set_badge', { p_username: selectedUser.username, p_badge: val });
      if (error){ toast(errMsg(error)); return; }
      selectedUser.badge = val;
      $$('[data-set-badge]').forEach(b => b.classList.toggle('is-on', (b.dataset.setBadge || null) === val));
      toast(val ? `@${selectedUser.username} is a ${val}` : 'Badge removed');
      await loadUsers();
      return;
    }

    const delta = e.target.closest('[data-credit-delta]');
    if (delta && selectedUser){
      const n = Number(delta.dataset.creditDelta || 0);
      const { data, error } = await sb.rpc('admin_adjust_user_credits', {
        p_user_id: selectedUser.id,
        p_delta: n
      });
      if (error){ toast(errMsg(error)); return; }
      selectedUser.credits = data?.credits ?? (selectedUser.credits + n);
      if ($('#edit-credits')) $('#edit-credits').value = selectedUser.credits;
      toast(`Credits → ${selectedUser.credits}`);
      return;
    }

    if (e.target.id === 'save-user'){ await saveUser(); return; }

    const unlinkTg = e.target.closest('[data-unlink-tg]');
    if (unlinkTg){
      try{
        const { error } = await sb.from('telegram_links').delete().eq('user_id', unlinkTg.dataset.unlinkTg);
        if (error) throw error;
        toast('Telegram unlinked');
      }catch(err){ toast(errMsg(err) || 'Could not unlink Telegram'); }
      return;
    }
    const unlinkWa = e.target.closest('[data-unlink-wa]');
    if (unlinkWa){
      try{
        const { error } = await sb.from('whatsapp_links').delete().eq('user_id', unlinkWa.dataset.unlinkWa);
        if (error) throw error;
        toast('WhatsApp unlinked');
      }catch(err){ toast(errMsg(err) || 'Could not unlink WhatsApp'); }
      return;
    }

    const dis = e.target.closest('[data-status-disabled]');
    if (dis && selectedUser){
      const on = dis.dataset.statusDisabled === '1';
      const { error } = await sb.rpc('admin_set_user_status', {
        p_user_id: selectedUser.id,
        p_disabled: on,
        p_banned: null
      });
      if (error) toast(errMsg(error));
      else { toast(on ? 'Account disabled' : 'Account enabled'); closeDrawer(); await loadUsers(); }
      return;
    }

    const ban = e.target.closest('[data-status-banned]');
    if (ban && selectedUser){
      const on = ban.dataset.statusBanned === '1';
      if (on && !confirm(`Ban @${selectedUser.username}?`)) return;
      const { error } = await sb.rpc('admin_set_user_status', {
        p_user_id: selectedUser.id,
        p_disabled: null,
        p_banned: on
      });
      if (error) toast(errMsg(error));
      else { toast(on ? 'User banned' : 'User unbanned'); closeDrawer(); await loadUsers(); }
      return;
    }

    if (e.target.id === 'soft-delete-user' && selectedUser){
      if (!confirm(`Soft delete @${selectedUser.username}? They will be banned and renamed.`)) return;
      const { error } = await sb.rpc('admin_soft_delete_user', { p_user_id: selectedUser.id });
      if (error) toast(errMsg(error));
      else { toast('User soft-deleted'); closeDrawer(); await Promise.all([loadUsers(), loadOverview()]); }
    }
  });

  window.addEventListener('resize', () => {
    gateDesktop();
    if (isDesktop() && adminProfile) showApp();
  });
}

async function boot(){
  gateDesktop();
  bind();
  if (!isDesktop()) return;
  const ok = await requireAdmin();
  if (!ok){ showLogin(); return; }
  showApp();
  await Promise.all([loadOverview(), loadUsers(), loadRooms()]);
}

boot();
