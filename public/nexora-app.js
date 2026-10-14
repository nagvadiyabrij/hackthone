/* ═══════════════════════════════════════════════════════════
   NEXORA — Unified Application Script
   Replaces app.js + dashboard.js + member-pages.js + search.js + user-panels.js
   ═══════════════════════════════════════════════════════════ */

'use strict';

/* ── Globals ───────────────────────────────────────────────── */
let S = {}, me, es;
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const initials = name => String(name || '?').split(/\s+/).map(p => p[0] || '').join('').slice(0,2).toUpperCase();
const fmtDate = v => v ? new Date(`${v}T00:00:00`).toLocaleDateString(undefined, { month:'short', day:'numeric' }) : 'No date';
const fmtDt  = v => new Date(v).toLocaleString(undefined, { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
const user   = id => S.users?.find(u => u.id === id) || { name: 'Unknown' };
const byId   = (arr, id) => arr?.find(x => x.id === id);

/* ── API ───────────────────────────────────────────────────── */
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
  const d = await r.json();
  if (!r.ok) throw Object.assign(new Error(d.error || 'Request failed'), { data: d, status: r.status });
  return d;
}

/* ── Toast ──────────────────────────────────────────────────── */
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.textContent = msg;
  $('#toasts').append(el);
  setTimeout(() => el.remove(), 3500);
}

/* ── Modal ──────────────────────────────────────────────────── */
function openModal(id, html) {
  const el = $('#' + id);
  el.innerHTML = html;
  el.classList.remove('hidden');
  el.onclick = e => { if (e.target === el || e.target.classList.contains('dialog-close')) closeModal(); };
  el.querySelector('.dialog-close')?.addEventListener('click', closeModal);
}
function closeModal() { $$('.modal-backdrop').forEach(m => m.classList.add('hidden')); }

/* ── Form Validation ────────────────────────────────────────── */
function showFieldError(id, msg) {
  const el = $('#' + id);
  if (el) { el.textContent = msg; el.previousElementSibling?.classList.add('is-error'); }
}
function clearFieldErrors(...ids) {
  ids.forEach(id => {
    const el = $('#' + id);
    if (el) { el.textContent = ''; el.previousElementSibling?.classList.remove('is-error'); }
  });
}
function validateEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

/* ── Auth ───────────────────────────────────────────────────── */
// Password show/hide
$('#pwToggle').addEventListener('click', () => {
  const inp = $('#loginPassword');
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  $('#pwToggle').textContent = show ? 'Hide' : 'Show';
});

// Show register
$('#showRegister').addEventListener('click', () => {
  $('#login').hidden = true;
  $('#registerForm').hidden = false;
  $('#regName').focus();
});
$('#showLogin').addEventListener('click', () => {
  $('#registerForm').hidden = true;
  $('#login').hidden = false;
  $('#loginEmail').focus();
});

// Login form with validation
$('#login').addEventListener('submit', async e => {
  e.preventDefault();
  clearFieldErrors('emailError', 'passwordError');
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  let valid = true;
  if (!email) { showFieldError('emailError', 'Email is required.'); valid = false; }
  else if (!validateEmail(email)) { showFieldError('emailError', 'Please enter a valid email address.'); valid = false; }
  if (!password) { showFieldError('passwordError', 'Password is required.'); valid = false; }
  if (!valid) return;

  const btn = $('#loginBtn'); const lbl = $('#loginBtnLabel');
  btn.disabled = true; lbl.textContent = 'Signing in…';
  $('#authErr').textContent = '';
  try {
    await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    await enterWorkspace();
  } catch (err) {
    $('#authErr').textContent = err.message;
  } finally {
    btn.disabled = false; lbl.textContent = 'Enter Nexora';
  }
});

// Register form with validation
$('#registerForm').addEventListener('submit', async e => {
  e.preventDefault();
  clearFieldErrors('regNameError','regEmailError','regPasswordError','regConfirmError');
  $('#regServerError').textContent = '';
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim();
  const password = $('#regPassword').value;
  const confirm = $('#regConfirm').value;
  let valid = true;
  if (name.length < 2) { showFieldError('regNameError', 'Name must be at least 2 characters.'); valid = false; }
  if (!validateEmail(email)) { showFieldError('regEmailError', 'Please enter a valid email address.'); valid = false; }
  if (password.length < 8) { showFieldError('regPasswordError', 'Password must be at least 8 characters.'); valid = false; }
  if (password !== confirm) { showFieldError('regConfirmError', 'Passwords do not match.'); valid = false; }
  if (!valid) return;

  const btn = $('#registerBtn');
  btn.disabled = true; btn.textContent = 'Creating account…';
  try {
    await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, confirmPassword: confirm }) });
    await enterWorkspace();
  } catch (err) {
    $('#regServerError').textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Create account';
  }
});

/* ── Navigation ─────────────────────────────────────────────── */
const pageIds = new Set(['home', 'projects', 'tasks', 'team', 'calendar', 'files', 'activity', 'analytics', 'notifications', 'settings', 'account']);

function currentPage() {
  const requested = window.location.hash.replace(/^#/, '');
  return pageIds.has(requested) ? requested : 'home';
}

function show(page, updateUrl = false) {
  const target = pageIds.has(page) ? page : 'home';
  if (updateUrl && window.location.hash !== `#${target}`) {
    window.location.hash = target;
    return;
  }
  $$('.page').forEach(s => s.classList.toggle('active', s.id === target));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === target));
  $('#sidebar').classList.remove('open');
  const renderers = { home, projects, tasks, team, calendar, files, activity, analytics, notifications, settings, account };
  renderers[target]?.();
}

$('#menu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
$$('.nav-btn').forEach(b => b.addEventListener('click', () => show(b.dataset.page, true)));
$('#logout').addEventListener('click', logout);
$('#notifBtn').addEventListener('click', () => show('notifications', true));
window.addEventListener('hashchange', () => {
  if (me) show(currentPage());
});
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault(); $('#search').focus();
  }
  if (e.key === 'Escape') closeModal();
});
$('#search').addEventListener('input', debounce(handleSearch, 250));

/* ── Data Load ──────────────────────────────────────────────── */
async function load() {
  const d = await api('/api/me');
  me = d.user; S = d.state;
  $('#meName').textContent = me.name;
  $('#meAvatar').textContent = initials(me.name);
  const cnt = S.activities?.length || 0;
  $('#unread').textContent = cnt > 99 ? '99+' : cnt;
  // Workspace name
  if (S.workspace?.name) $('#wsName').textContent = S.workspace.name;
  const cur = currentPage();
  show(cur);
}

async function enterWorkspace() {
  await load();
  if (me.access === 'admin') {
    window.location.assign('/admin.html');
    return;
  }
  $('#auth').hidden = true;
  $('#app').hidden = false;
  startRealtime();
}

async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  es?.close();
  $('#app').hidden = true; $('#auth').hidden = false;
}

/* ── Realtime ───────────────────────────────────────────────── */
function startRealtime() {
  es?.close();
  es = new EventSource('/api/events');
  const reload = () => load();
  const reloadToast = msg => { toast(msg); load(); };
  es.addEventListener('task.created',   () => reloadToast('🔔 Live: a task was created'));
  es.addEventListener('task.updated',   () => reloadToast('🔔 Live: a task was updated'));
  es.addEventListener('task.deleted',   reload);
  es.addEventListener('comment.created',() => reloadToast('💬 Live: new comment'));
  es.addEventListener('project.created',reload);
  es.addEventListener('file.uploaded',  () => reloadToast('📁 Live: file uploaded'));
  es.addEventListener('workspace.updated', reload);
}

/* ── Auto-login check ───────────────────────────────────────── */
(async () => {
  try {
    const d = await api('/api/me');
    if (d.user) {
      // Redirect admins to admin panel
      if (d.user.access === 'admin' && window.location.pathname !== '/admin.html') {
        window.location.replace('/admin.html'); return;
      }
      me = d.user; S = d.state;
      $('#auth').hidden = true; $('#app').hidden = false;
      await load(); startRealtime();
    }
  } catch { /* not logged in */ }
})();

/* ── Stat helper ────────────────────────────────────────────── */
function stat(p) {
  const ts = S.tasks.filter(t => t.projectId === p.id);
  const done = ts.filter(t => t.status === 'Done').length;
  const today = new Date().toISOString().slice(0, 10);
  const over = ts.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Done');
  const urgent = over.filter(t => t.priority === 'Urgent' || t.priority === 'High');
  const pct = ts.length ? Math.round(done / ts.length * 100) : 0;
  const health = urgent.length ? 'Critical' : over.length || pct < 35 ? 'At Risk' : 'Healthy';
  return { ts, done, pct, over, health };
}
function healthBadge(h) {
  const cls = h === 'At Risk' ? 'atrisk' : h === 'Critical' ? 'critical' : 'healthy';
  return `<span class="badge-health ${cls}">${esc(h)}</span>`;
}
function priorityBadge(p = 'Medium') {
  return `<span class="badge-priority ${esc(p.toLowerCase())}">${esc(p)}</span>`;
}
function debounce(fn, ms) {
  let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

/* ══════════════════════════════════════════════════════════════
   PAGE RENDERERS
   ══════════════════════════════════════════════════════════════ */

/* ── Home ───────────────────────────────────────────────────── */
function home() {
  const tasks = S.tasks || [], projects = S.projects || [], users = S.users || [], activities = S.activities || [];
  const today = new Date().toISOString().slice(0, 10);
  const done  = tasks.filter(t => t.status === 'Done').length;
  const active = tasks.length - done;
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Done');
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const todayActs = activities.filter(a => a.at?.slice(0,10) === today).length;
  const upcoming = tasks.filter(t => t.dueDate && t.dueDate >= today && t.status !== 'Done')
    .sort((a,b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);

  $('#home').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / WORKSPACE PULSE</span>
        <h1>Welcome back, ${esc(me.name.split(' ')[0])} 👋</h1>
        <p>Your workspace is live and synced across all connected sessions.</p>
      </div>
      <button class="btn btn-primary" id="createTaskBtn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        New Task
      </button>
    </div>

    <!-- Hero banner -->
    <div class="hero-banner" style="margin-bottom:20px">
      <div class="hero-copy">
        <div class="hero-eyebrow">WORKSPACE INTELLIGENCE</div>
        <div class="hero-title">Move work forward.<br><em>Together.</em></div>
        <div class="hero-desc">Projects, tasks, files and people — connected in one living workspace. Every change is real-time and conflict-safe.</div>
      </div>
      <div class="hero-pulse">
        <div class="pulse-ring" style="--pct:${pct}%">
          <div class="pulse-ring-inner">
            <b>${pct}%</b>
            <small>complete</small>
          </div>
        </div>
        <div class="pulse-meta">
          <b>${users.length}</b> teammates · <b>${active}</b> open tasks
        </div>
      </div>
    </div>

    <!-- KPI cards -->
    <div class="grid-4" style="margin-bottom:20px">
      <div class="card">
        <div class="card-label">PROJECTS</div>
        <div class="card-value">${projects.length}</div>
        <div class="card-sub card-good">▣ ${projects.length === 1 ? 'One initiative' : 'Across the workspace'}</div>
      </div>
      <div class="card">
        <div class="card-label">ACTIVE TASKS</div>
        <div class="card-value">${active}</div>
        <div class="card-sub ${overdue.length ? 'card-danger' : 'card-good'}">${overdue.length ? `⚠ ${overdue.length} overdue` : '✓ All on track'}</div>
      </div>
      <div class="card">
        <div class="card-label">COMPLETED</div>
        <div class="card-value">${done}</div>
        <div class="card-sub card-good">↑ ${pct}% of all tasks</div>
      </div>
      <div class="card">
        <div class="card-label">TODAY'S ACTIVITY</div>
        <div class="card-value">${todayActs}</div>
        <div class="card-sub">Live workspace events</div>
      </div>
    </div>

    <!-- Lower grid -->
    <div class="grid-21" style="gap:16px">
      <!-- Project health -->
      <div class="panel">
        <div class="panel-header">
          <div class="panel-title">Project health</div>
          <button class="panel-link btn-show-page" data-go="projects">All projects →</button>
        </div>
        <div class="panel-sub">Progress calculated from task completion and overdue work.</div>
        ${projects.length ? projects.map(p => {
          const x = stat(p);
          return `<div class="row">
            <div class="row-icon">▣</div>
            <div class="row-body">
              <b>${esc(p.name)}</b>
              <small>Due ${fmtDate(p.deadline)} · ${x.done}/${x.ts.length} tasks done</small>
              <div class="bar" style="margin-top:6px"><div class="bar-fill ${x.pct===100?'green':x.health==='Critical'?'rose':x.health==='At Risk'?'amber':''}" style="width:${x.pct}%"></div></div>
            </div>
            ${healthBadge(x.health)}
          </div>`;
        }).join('') : '<div class="empty-state"><div class="empty-state-icon">▣</div><b>No projects yet</b><p>Create a project to start organizing work.</p></div>'}
      </div>

      <!-- Right column -->
      <div style="display:flex;flex-direction:column;gap:14px">
        <!-- Upcoming deadlines -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Upcoming deadlines</div>
            <button class="panel-link btn-show-page" data-go="calendar">Calendar →</button>
          </div>
          ${upcoming.length ? upcoming.map(t => `
            <div class="row" style="cursor:pointer" data-open-task="${esc(t.id)}">
              <div class="row-body">
                <b>${esc(t.title)}</b>
                <small>${fmtDate(t.dueDate)} · ${esc(t.status)}</small>
              </div>
              ${priorityBadge(t.priority)}
            </div>
          `).join('') : '<div class="empty-state" style="padding:20px 0"><b>No upcoming deadlines</b><p>Add due dates to tasks.</p></div>'}
        </div>

        <!-- Live activity -->
        <div class="panel">
          <div class="panel-header">
            <div class="panel-title">Live activity</div>
            <button class="panel-link btn-show-page" data-go="activity">Full log →</button>
          </div>
          ${activities.slice(0,4).map(a => {
            const u = user(a.actorId);
            return `<div class="row">
              <div class="avatar">${esc(initials(u.name))}</div>
              <div class="row-body">
                <b>${esc(u.name)} <span style="font-weight:400;color:var(--text-2)">${esc(a.action)}</span> ${esc(a.target)}</b>
                <small>${fmtDt(a.at)}</small>
              </div>
            </div>`;
          }).join('') || '<div class="empty-state" style="padding:20px 0"><b>No activity yet</b></div>'}
        </div>
      </div>
    </div>
  `;
  $('#createTaskBtn')?.addEventListener('click', () => openTaskForm());
  $$('#home .btn-show-page').forEach(b => b.addEventListener('click', () => show(b.dataset.go, true)));
  $$('#home [data-open-task]').forEach(b => b.addEventListener('click', () => openTaskDrawer(b.dataset.openTask)));
}

/* ── Projects ───────────────────────────────────────────────── */
function projects() {
  const ps = S.projects || [];
  $('#projects').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / PORTFOLIO</span>
        <h1>Projects</h1>
        <p>Shared goals with progress calculated from real workspace tasks.</p>
      </div>
      <button class="btn btn-primary" id="newProjectBtn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        New Project
      </button>
    </div>
    <div class="project-grid">
      ${ps.length ? ps.map(p => {
        const x = stat(p);
        return `<button class="project-card" data-pid="${esc(p.id)}">
          <div class="project-card-top">
            <div class="project-icon">▣</div>
            ${healthBadge(x.health)}
          </div>
          <div class="project-name">${esc(p.name)}</div>
          <div class="project-desc">${esc(p.description || 'No description provided.')}</div>
          <div class="project-progress-wrap">
            <div class="project-meta">
              <span>${x.done} / ${x.ts.length} tasks done</span>
              <span>${x.pct}%</span>
            </div>
            <div class="bar"><div class="bar-fill ${x.pct===100?'green':x.health==='Critical'?'rose':x.health==='At Risk'?'amber':''}" style="width:${x.pct}%"></div></div>
          </div>
          <div class="project-footer">
            <span>Due ${fmtDate(p.deadline)}</span>
            <span>View tasks →</span>
          </div>
        </button>`;
      }).join('') : `<div class="panel" style="grid-column:1/-1;text-align:center;padding:48px">
        <div class="empty-state-icon">▣</div>
        <b style="font-size:16px;color:var(--text)">No projects yet</b>
        <p style="color:var(--text-2);margin:8px 0 16px">Create your first project and start moving work forward.</p>
        <button class="btn btn-primary" id="newProjectEmpty">Create a project</button>
      </div>`}
    </div>
  `;
  $('#newProjectBtn')?.addEventListener('click', openProjectForm);
  $('#newProjectEmpty')?.addEventListener('click', openProjectForm);
  $$('#projects [data-pid]').forEach(b => b.addEventListener('click', () => openProjectDetail(b.dataset.pid)));
}

function openProjectDetail(pid) {
  const p = byId(S.projects, pid); if (!p) return;
  const tasks = S.tasks.filter(t => t.projectId === pid);
  const done = tasks.filter(t => t.status === 'Done').length;
  const pct = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  openModal('projectModal', `<div class="dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <span class="dialog-kicker">PROJECT / ${esc(p.deadline ? 'DUE ' + fmtDate(p.deadline) : 'NO DEADLINE')}</span>
    <h2>${esc(p.name)}</h2>
    <p style="color:var(--text-2);font-size:12px;margin-bottom:16px;line-height:1.6">${esc(p.description || 'No description provided.')}</p>
    <div style="background:var(--bg3);border-radius:8px;padding:14px;margin-bottom:18px;display:flex;align-items:center;gap:14px">
      <div><b style="font-family:var(--font-display);font-size:22px;color:var(--indigo)">${pct}%</b><small style="display:block;color:var(--text-2);font-size:10px">Complete</small></div>
      <div style="flex:1"><div class="bar" style="height:8px"><div class="bar-fill" style="width:${pct}%"></div></div></div>
      <div style="text-align:right"><b style="color:var(--text);font-size:13px">${done} / ${tasks.length}</b><small style="display:block;color:var(--text-2);font-size:10px">Tasks done</small></div>
    </div>
    <h3 style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">Tasks in this project</h3>
    <div>
      ${tasks.map(t => `<button class="project-task-btn" data-tid="${esc(t.id)}">
        <span class="task-status-dot ${t.status==='Done'?'done':''}"></span>
        <span><b>${esc(t.title)}</b><small>${esc(t.status)} · ${esc(t.priority)} priority · ${fmtDate(t.dueDate)}</small></span>
        ${priorityBadge(t.priority)}
        <i>→</i>
      </button>`).join('') || '<p style="color:var(--text-2);font-size:12px;padding:10px 0">No tasks in this project yet.</p>'}
    </div>
    <div class="dialog-actions">
      <button class="btn btn-secondary" id="goTaskBoard">Open task board</button>
    </div>
  </div>`);
  $$('#projectModal [data-tid]').forEach(b => b.addEventListener('click', () => { closeModal(); openTaskDrawer(b.dataset.tid); }));
  $('#goTaskBoard')?.addEventListener('click', () => { closeModal(); show('tasks'); });
}

/* ── Tasks (Kanban) ─────────────────────────────────────────── */
function tasks() {
  const states = ['Backlog','To Do','In Progress','Review','Done'];
  let filterPriority = $('#taskPriFilter')?.value || '';
  let filterAssignee = $('#taskAssFilter')?.value || '';
  const visible = S.tasks.filter(t =>
    (!filterPriority || t.priority === filterPriority) &&
    (!filterAssignee || t.assigneeId === filterAssignee)
  );
  $('#tasks').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / BOARD</span>
        <h1>Task Board</h1>
        <p>Drag cards to update status. Changes are saved and broadcast instantly.</p>
      </div>
      <button class="btn btn-primary" id="newTaskBtn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        New Task
      </button>
    </div>
    <div class="board-toolbar">
      <select id="taskPriFilter">
        <option value="">All priorities</option>
        ${['Low','Medium','High','Urgent'].map(x => `<option ${filterPriority===x?'selected':''}>${x}</option>`).join('')}
      </select>
      <select id="taskAssFilter">
        <option value="">All assignees</option>
        ${S.users.map(u => `<option value="${esc(u.id)}" ${filterAssignee===u.id?'selected':''}>${esc(u.name)}</option>`).join('')}
      </select>
      <span class="board-count">${visible.length} task${visible.length===1?'':'s'} shown</span>
    </div>
    <div class="board">
      ${states.map(s => {
        const col = visible.filter(t => t.status === s);
        const colors = { Backlog:'var(--text-3)', 'To Do':'var(--blue)', 'In Progress':'var(--amber)', Review:'var(--violet)', Done:'var(--emerald)' };
        return `<div class="column" data-status="${s}">
          <div class="col-head">
            <span style="color:${colors[s]}">${s.toUpperCase()}</span>
            <span class="col-count">${col.length}</span>
          </div>
          ${col.map(t => `
            <div class="task-card" draggable="true" data-task="${esc(t.id)}">
              <div class="task-card-top">
                ${priorityBadge(t.priority)}
              </div>
              <h3>${esc(t.title)}</h3>
              ${t.description ? `<p>${esc(t.description)}</p>` : ''}
              <div class="task-card-foot">
                <div class="avatar" title="${esc(user(t.assigneeId).name)}">${esc(initials(user(t.assigneeId).name))}</div>
                <span class="task-date">${t.dueDate || 'No date'}</span>
              </div>
            </div>
          `).join('')}
        </div>`;
      }).join('')}
    </div>
  `;
  $('#newTaskBtn')?.addEventListener('click', openTaskForm);
  $('#taskPriFilter')?.addEventListener('change', tasks);
  $('#taskAssFilter')?.addEventListener('change', tasks);
  $$('.task-card').forEach(c => {
    c.addEventListener('click', () => openTaskDrawer(c.dataset.task));
    c.addEventListener('dragstart', e => e.dataTransfer.setData('task', c.dataset.task));
  });
  $$('.column').forEach(col => {
    col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', () => col.classList.remove('drag-over'));
    col.addEventListener('drop', async e => {
      col.classList.remove('drag-over');
      const t = S.tasks.find(t => t.id === e.dataTransfer.getData('task'));
      if (!t) return;
      try {
        await api('/api/tasks/' + t.id, { method:'PATCH', body: JSON.stringify({ ...t, status: col.dataset.status }) });
        toast('Status updated');
        await load();
      } catch (err) { toast(err.message); }
    });
  });
}

/* ── Team ───────────────────────────────────────────────────── */
function team() {
  const people = S.users || [];
  const roles = [...new Set(people.map(p => p.role || 'Member'))].sort();
  $('#team').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / PEOPLE</span>
        <h1>Your Team</h1>
        <p>People, roles, and workload across this workspace — ${people.length} members total.</p>
      </div>
    </div>
    <div class="team-tools">
      <div class="team-search">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input id="teamSearch" type="search" placeholder="Search people…" aria-label="Search team">
      </div>
      <select class="team-filter" id="teamRoleFilter">
        <option value="all">All roles</option>
        ${roles.map(r => `<option value="${esc(r)}">${esc(r)}</option>`).join('')}
      </select>
      <select class="team-filter" id="teamSort">
        <option value="name">Sort: Name</option>
        <option value="tasks">Sort: Most tasks</option>
      </select>
    </div>
    <div class="team-grid" id="teamCards"></div>
  `;
  function renderTeamCards() {
    const q = $('#teamSearch').value.trim().toLowerCase();
    const role = $('#teamRoleFilter').value;
    const sort = $('#teamSort').value;
    let filtered = people.filter(p =>
      (q === '' || `${p.name} ${p.email} ${p.role}`.toLowerCase().includes(q)) &&
      (role === 'all' || (p.role || 'Member') === role)
    );
    if (sort === 'tasks') {
      filtered.sort((a,b) => S.tasks.filter(t => t.assigneeId === b.id && t.status !== 'Done').length
                           - S.tasks.filter(t => t.assigneeId === a.id && t.status !== 'Done').length);
    }
    const cards = filtered.map(p => {
      const assigned = S.tasks.filter(t => t.assigneeId === p.id);
      const done = assigned.filter(t => t.status === 'Done').length;
      const recent = S.activities.find(a => a.actorId === p.id);
      return `<button class="team-card" data-mid="${esc(p.id)}">
        <div class="team-avatar">${esc(initials(p.name))}</div>
        <div class="team-info">
          <b>${esc(p.name)}</b>
          <small>${esc(p.role || 'Member')} · ${esc(p.email)}</small>
        </div>
        <span class="team-badge ${p.access==='admin'?'admin':''}">${p.access==='admin'?'Admin':'Member'}</span>
        <div class="team-stats">
          <div class="team-stat"><b>${assigned.length}</b><small>Assigned</small></div>
          <div class="team-stat"><b>${done}</b><small>Done</small></div>
          <div class="team-stat"><b>${assigned.length - done}</b><small>Open</small></div>
        </div>
        <div class="team-recent">${recent ? `Recent: ${esc(recent.action)} ${esc(recent.target)}` : 'No recent activity'}</div>
      </button>`;
    });
    $('#teamCards').innerHTML = cards.join('') || '<div class="panel" style="grid-column:1/-1;text-align:center;padding:32px"><b>No members match</b></div>';
    $$('#teamCards [data-mid]').forEach(b => b.addEventListener('click', () => openMemberProfile(b.dataset.mid)));
  }
  $('#teamSearch').addEventListener('input', renderTeamCards);
  $('#teamRoleFilter').addEventListener('change', renderTeamCards);
  $('#teamSort').addEventListener('change', renderTeamCards);
  renderTeamCards();
}

function openMemberProfile(mid) {
  const p = byId(S.users, mid); if (!p) return;
  const ptasks = S.tasks.filter(t => t.assigneeId === mid);
  const done = ptasks.filter(t => t.status === 'Done').length;
  const recent = S.activities.filter(a => a.actorId === mid).slice(0, 4);
  openModal('projectModal', `<div class="dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <div class="profile-banner" style="margin-bottom:16px">
      <div class="profile-banner-avatar">${esc(initials(p.name))}</div>
      <div class="profile-banner-info">
        <span style="font-family:var(--font-mono);font-size:9px;color:var(--indigo);letter-spacing:1px">WORKSPACE MEMBER</span>
        <h2>${esc(p.name)}</h2>
        <p>${esc(p.role || 'Member')} · ${esc(p.email)}</p>
      </div>
      <span class="access-chip">${p.access==='admin'?'Admin':'Member'}</span>
    </div>
    <div class="metric-grid" style="margin-bottom:16px">
      <div class="metric-card"><b>${ptasks.length}</b><small>Assigned</small></div>
      <div class="metric-card"><b>${done}</b><small>Completed</small></div>
      <div class="metric-card"><b>${ptasks.length - done}</b><small>Open</small></div>
    </div>
    <h3 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text)">Assigned tasks</h3>
    ${ptasks.map(t => `<button class="project-task-btn" data-tid="${esc(t.id)}">
      <span class="task-status-dot ${t.status==='Done'?'done':''}"></span>
      <span><b>${esc(t.title)}</b><small>${esc(t.status)} · ${esc(t.priority)}</small></span>
      ${priorityBadge(t.priority)}
      <i>→</i>
    </button>`).join('') || '<p style="color:var(--text-2);font-size:12px">No tasks assigned.</p>'}
    <h3 style="font-size:13px;font-weight:600;margin:16px 0 8px;color:var(--text)">Recent activity</h3>
    ${recent.map(a => `<div class="row"><div class="avatar">${esc(initials(p.name))}</div><div class="row-body"><b>${esc(a.action)} ${esc(a.target)}</b><small>${fmtDt(a.at)}</small></div></div>`).join('') || '<p style="color:var(--text-2);font-size:12px">No recent activity.</p>'}
  </div>`);
  $$('#projectModal [data-tid]').forEach(b => b.addEventListener('click', () => { closeModal(); openTaskDrawer(b.dataset.tid); }));
}

/* ── Calendar ───────────────────────────────────────────────── */
let calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
function calendar() {
  const year = calMonth.getFullYear(), month = calMonth.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = Math.ceil((startDay + daysInMonth) / 7) * 7;
  const today = new Date().toISOString().slice(0,10);
  const events = [
    ...(S.tasks||[]).filter(t => t.dueDate).map(t => ({ id:t.id, title:t.title, date:t.dueDate, kind:'task', detail:`${t.status} · ${t.priority}` })),
    ...(S.projects||[]).filter(p => p.deadline).map(p => ({ id:p.id, title:p.name, date:p.deadline, kind:'project', detail:'Project deadline' }))
  ];
  const monthPfx = `${year}-${String(month+1).padStart(2,'0')}-`;
  const upcoming = events.filter(e => e.date >= today).sort((a,b) => a.date.localeCompare(b.date)).slice(0,10);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  $('#calendar').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / PLANNING</span>
        <h1>Calendar</h1>
        <p>Task due dates and project deadlines from your workspace.</p>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button class="cal-today-btn" id="calToday">Today</button>
        <button class="cal-btn" id="calPrev">←</button>
        <button class="cal-btn" id="calNext">→</button>
      </div>
    </div>
    <div class="cal-head">
      <span class="cal-month-label">${calMonth.toLocaleDateString(undefined, {month:'long',year:'numeric'})}</span>
    </div>
    <div class="cal-layout">
      <div class="panel" style="padding:12px">
        <div class="cal-weekdays">${days.map(d => `<div class="cal-weekday">${d}</div>`).join('')}</div>
        <div class="cal-grid">
          ${Array.from({length:cells}, (_,i) => {
            const day = i - startDay + 1;
            if (day < 1 || day > daysInMonth) return '<div class="cal-day outside"></div>';
            const date = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayEvents = events.filter(e => e.date === date);
            return `<div class="cal-day ${date===today?'today':''}">
              <div class="cal-day-num">${day}</div>
              ${dayEvents.map(e => `<button class="cal-event ${e.kind}" data-ek="${e.kind}" data-eid="${esc(e.id)}" title="${esc(e.title)} — ${esc(e.detail)}">
                <span class="cal-event-dot"></span>${esc(e.title)}
              </button>`).join('')}
            </div>`;
          }).join('')}
        </div>
      </div>
      <div class="upcoming-panel">
        <h2>Upcoming</h2>
        ${upcoming.map(e => `<button class="upcoming-item" data-ek="${e.kind}" data-eid="${esc(e.id)}">
          <div class="upcoming-date-box">
            <b>${new Date(e.date+'T00:00:00').getDate()}</b>
            <small>${new Date(e.date+'T00:00:00').toLocaleDateString(undefined,{month:'short'})}</small>
          </div>
          <div class="upcoming-info">
            <b>${esc(e.title)}</b>
            <small>${esc(e.detail)}</small>
          </div>
        </button>`).join('') || '<div class="empty-state" style="padding:24px 0"><b>No upcoming deadlines</b></div>'}
      </div>
    </div>
  `;
  $('#calPrev').addEventListener('click', () => { calMonth = new Date(year, month-1, 1); calendar(); });
  $('#calNext').addEventListener('click', () => { calMonth = new Date(year, month+1, 1); calendar(); });
  $('#calToday').addEventListener('click', () => { calMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1); calendar(); });
  $$('#calendar [data-ek]').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.ek === 'task') { openTaskDrawer(b.dataset.eid); }
    else { show('projects'); setTimeout(() => $('#projects [data-pid="'+b.dataset.eid+'"]')?.click(), 50); }
  }));
}

/* ── Files ──────────────────────────────────────────────────── */
function files() {
  const fileList = S.files || [];
  const fileTypes = { 'image': '🖼', 'video': '🎬', 'audio': '🎵', 'pdf': '📄', 'zip': '📦', 'doc': '📝', 'xls': '📊', default: '📁' };
  function fileIcon(type='') {
    for (const [k,v] of Object.entries(fileTypes)) if (type.includes(k)) return v;
    return fileTypes.default;
  }
  $('#files').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / FILES</span>
        <h1>Files</h1>
        <p>Private uploads stored securely and accessible to workspace members.</p>
      </div>
      <button class="btn btn-primary" id="uploadBtn">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 9V1M3 5l4-4 4 4M1 11v1a1 1 0 001 1h10a1 1 0 001-1v-1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
        Upload File
      </button>
    </div>
    <div class="file-toolbar">
      <div class="file-search">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 10l3 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        <input id="fileSearch" type="search" placeholder="Search files…">
      </div>
      <select id="fileProjectFilter" style="height:38px;padding:0 12px;background:var(--surface);border:1.5px solid var(--border);border-radius:6px;color:var(--text);font-size:12px">
        <option value="all">All projects</option>
        ${(S.projects||[]).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}
      </select>
    </div>
    <div class="panel">
      ${fileList.length ? fileList.map(f => `
        <div class="file-row" data-fname="${esc((f.name||'').toLowerCase())}" data-fproject="${esc(f.projectId||'')}">
          <div class="file-icon">${fileIcon(f.type||'')}</div>
          <div class="file-info">
            <b>${esc(f.name)}</b>
            <small>${Math.round((f.size||0)/1024)} KB · ${esc(user(f.ownerId).name)} · ${fmtDate(f.createdAt)}</small>
          </div>
          <div class="file-actions">
            <a class="btn btn-secondary btn-sm" href="/api/files/${f.id}/download">Download</a>
            ${f.ownerId === me.id ? `<button class="btn btn-danger btn-sm" data-del="${esc(f.id)}">Delete</button>` : ''}
          </div>
        </div>
      `).join('') : `<div class="empty-state"><div class="empty-state-icon">📁</div><b>No files yet</b><p>Upload project artifacts to share them with the team.</p></div>`}
    </div>
    <input id="filePick" type="file" hidden>
  `;
  $('#uploadBtn')?.addEventListener('click', () => $('#filePick').click());
  $('#filePick')?.addEventListener('change', e => uploadFile(e.target.files[0]));
  $$('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete this file?')) return;
    await api('/api/files/' + b.dataset.del, { method:'DELETE' }); await load(); toast('File deleted');
  }));
  function applyFileFilters() {
    const q = $('#fileSearch').value.trim().toLowerCase();
    const pid = $('#fileProjectFilter').value;
    $$('.file-row').forEach(r => {
      r.hidden = Boolean((q && !r.dataset.fname.includes(q)) || (pid !== 'all' && r.dataset.fproject !== pid));
    });
  }
  $('#fileSearch').addEventListener('input', applyFileFilters);
  $('#fileProjectFilter').addEventListener('change', applyFileFilters);
}

async function uploadFile(f) {
  if (!f) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try {
      await api('/api/files', { method:'POST', body: JSON.stringify({ name:f.name, type:f.type, data:reader.result, projectId: S.projects[0]?.id }) });
      await load(); toast('File uploaded successfully');
    } catch (e) { toast(e.message); }
  };
  reader.readAsDataURL(f);
}

/* ── Activity ───────────────────────────────────────────────── */
function activity() {
  const acts = S.activities || [];
  const filters = [['all','All activity'],['task','Tasks'],['project','Projects'],['file','Files'],['comment','Comments']];
  $('#activity').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / AUDIT TRAIL</span>
        <h1>Activity</h1>
        <p>A real-time auditable log of every change in this workspace.</p>
      </div>
    </div>
    <div class="activity-filter-bar">
      ${filters.map(([v,l]) => `<button class="filter-chip ${v==='all'?'active':''}" data-filter="${v}">${l}</button>`).join('')}
    </div>
    <div class="panel">
      <div class="activity-list" id="activityList">
        ${acts.map(a => {
          const u = user(a.actorId);
          const kind = a.action?.toLowerCase().includes('task') ? 'task' : a.action?.toLowerCase().includes('project') ? 'project' : a.action?.toLowerCase().includes('file') ? 'file' : a.action?.toLowerCase().includes('comment') ? 'comment' : 'account';
          return `<div class="activity-item" data-kind="${kind}">
            <div class="avatar">${esc(initials(u.name))}</div>
            <div class="activity-line">
              <b>${esc(u.name)} ${esc(a.action)}</b>
              <p>${esc(a.target)}</p>
              <time>${fmtDt(a.at)}</time>
            </div>
          </div>`;
        }).join('') || `<div class="empty-state"><div class="empty-state-icon">📋</div><b>No activity yet</b><p>Actions taken in the workspace will appear here.</p></div>`}
      </div>
    </div>
  `;
  $$('.filter-chip').forEach(chip => chip.addEventListener('click', () => {
    $$('.filter-chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const f = chip.dataset.filter;
    $$('.activity-item').forEach(r => { r.hidden = f !== 'all' && r.dataset.kind !== f; });
  }));
}

/* ── Analytics ──────────────────────────────────────────────── */
function analytics() {
  const tasks = S.tasks || [], users = S.users || [], projects = S.projects || [];
  const states = ['Backlog','To Do','In Progress','Review','Done'];
  const priorities = ['Urgent','High','Medium','Low'];
  const today = new Date().toISOString().slice(0,10);
  const overdue = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'Done');
  const done = tasks.filter(t => t.status === 'Done').length;
  const pct = tasks.length ? Math.round(done/tasks.length*100) : 0;
  const maxUser = Math.max(1, ...users.map(u => tasks.filter(t => t.assigneeId === u.id).length));

  $('#analytics').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / INSIGHTS</span>
        <h1>Analytics</h1>
        <p>Every metric is derived live from the workspace database.</p>
      </div>
    </div>

    <!-- Top KPIs -->
    <div class="grid-4" style="margin-bottom:20px">
      <div class="card">
        <div class="card-label">OVERALL PROGRESS</div>
        <div class="card-value">${pct}%</div>
        <div class="card-sub card-good">of ${tasks.length} total tasks complete</div>
      </div>
      <div class="card">
        <div class="card-label">OVERDUE</div>
        <div class="card-value ${overdue.length ? 'card-danger' : ''}">${overdue.length}</div>
        <div class="card-sub">${overdue.length ? `⚠ Needs attention` : '✓ Nothing overdue'}</div>
      </div>
      <div class="card">
        <div class="card-label">TEAM SIZE</div>
        <div class="card-value">${users.length}</div>
        <div class="card-sub">Active workspace members</div>
      </div>
      <div class="card">
        <div class="card-label">PROJECTS</div>
        <div class="card-value">${projects.length}</div>
        <div class="card-sub">${projects.filter(p=>stat(p).health==='Healthy').length} healthy</div>
      </div>
    </div>

    <div class="grid-2" style="gap:16px">
      <!-- Task distribution by status -->
      <div class="panel">
        <div class="panel-title">Tasks by status</div>
        <div class="panel-sub">Distribution across all workflow stages.</div>
        ${states.map(s => {
          const n = tasks.filter(t => t.status === s).length;
          const w = tasks.length ? Math.round(n/tasks.length*100) : 0;
          return `<div class="analytics-bar-wrap">
            <div class="analytics-bar-label"><span>${s}</span><b>${n} tasks</b></div>
            <div class="analytics-bar"><div class="analytics-bar-fill" style="width:${w}%"></div></div>
          </div>`;
        }).join('')}
      </div>

      <!-- Tasks by priority -->
      <div class="panel">
        <div class="panel-title">Tasks by priority</div>
        <div class="panel-sub">Priority breakdown across all tasks.</div>
        ${priorities.map(p => {
          const n = tasks.filter(t => t.priority === p).length;
          const w = tasks.length ? Math.round(n/tasks.length*100) : 0;
          const colors = { Urgent:'var(--rose)', High:'var(--amber)', Medium:'var(--indigo)', Low:'var(--text-3)' };
          return `<div class="analytics-bar-wrap">
            <div class="analytics-bar-label"><span>${p}</span><b>${n} tasks</b></div>
            <div class="analytics-bar"><div class="analytics-bar-fill" style="width:${w}%;background:${colors[p]}"></div></div>
          </div>`;
        }).join('')}
      </div>

      <!-- Team workload -->
      <div class="panel">
        <div class="panel-title">Team workload</div>
        <div class="panel-sub">Task distribution across team members.</div>
        ${users.map(u => {
          const n = tasks.filter(t => t.assigneeId === u.id).length;
          const d = tasks.filter(t => t.assigneeId === u.id && t.status==='Done').length;
          const w = Math.round(n/maxUser*100);
          return `<div class="analytics-bar-wrap">
            <div class="analytics-bar-label">
              <span style="display:flex;align-items:center;gap:6px">
                <span class="avatar" style="width:20px;height:20px;font-size:8px">${esc(initials(u.name))}</span>
                ${esc(u.name)}
              </span>
              <b>${n} tasks · ${d} done</b>
            </div>
            <div class="analytics-bar"><div class="analytics-bar-fill" style="width:${w}%"></div></div>
          </div>`;
        }).join('') || '<div class="empty-state" style="padding:24px 0"><b>No team members</b></div>'}
      </div>

      <!-- Project delivery -->
      <div class="panel">
        <div class="panel-title">Project delivery</div>
        <div class="panel-sub">Progress and health for each project.</div>
        ${projects.map(p => {
          const x = stat(p);
          return `<div class="analytics-bar-wrap">
            <div class="analytics-bar-label"><span>${esc(p.name)}</span>${healthBadge(x.health)}</div>
            <div class="analytics-bar"><div class="analytics-bar-fill ${x.pct===100?'green':x.health==='Critical'?'rose':x.health==='At Risk'?'amber':''}" style="width:${x.pct}%"></div></div>
          </div>`;
        }).join('') || '<div class="empty-state" style="padding:24px 0"><b>No projects</b></div>'}
      </div>
    </div>
  `;
}

/* ── Notifications ──────────────────────────────────────────── */
function notifications() {
  const acts = S.activities?.slice(0,20) || [];
  $('#notifications').innerHTML = `
    <div class="ph">
      <div class="ph-left">
        <span class="ph-kicker">NEXORA / REALTIME</span>
        <h1>Notifications</h1>
        <p>Live events delivered to every connected session.</p>
      </div>
    </div>
    <div class="panel">
      ${acts.map(a => {
        const u = user(a.actorId);
        return `<div class="activity-item">
          <div class="avatar">${esc(initials(u.name))}</div>
          <div class="activity-line">
            <b>${esc(u.name)} ${esc(a.action)}</b>
            <p>${esc(a.target)}</p>
            <time>${fmtDt(a.at)}</time>
          </div>
        </div>`;
      }).join('') || `<div class="empty-state"><div class="empty-state-icon">🔔</div><b>All caught up!</b><p>New workspace events will appear here.</p></div>`}
    </div>
  `;
}

/* ── Settings / Account ────────────────────────────────────── */
function settings() { account(); }
function account() {
  const pg = $('#settings') || $('#account');
  if (!pg) return;
  pg.innerHTML = `<div style="padding:8px 0 20px"><span class="ph-kicker">NEXORA / PERSONAL WORKSPACE</span></div>
    <div id="settingsFeedback"></div>
    <div class="profile-banner">
      <div class="profile-banner-avatar">${esc(initials(me.name))}</div>
      <div class="profile-banner-info">
        <span style="font-family:var(--font-mono);font-size:9px;color:var(--indigo);letter-spacing:1px">WORKSPACE MEMBER</span>
        <h2>${esc(me.name)}</h2>
        <p>${esc(me.email)} · ${esc(me.role || 'Member')}</p>
      </div>
      <span class="access-chip">${me.access==='admin'?'Administrator':'Member'}</span>
    </div>
    <div class="metric-grid" style="margin-bottom:20px">
      ${(() => {
        const mine = S.tasks.filter(t => t.assigneeId === me.id);
        const done = mine.filter(t => t.status === 'Done').length;
        return `
          <div class="metric-card"><b>${mine.length}</b><small>Assigned to me</small></div>
          <div class="metric-card"><b>${done}</b><small>Completed</small></div>
          <div class="metric-card"><b>${mine.length-done}</b><small>In progress</small></div>
        `;
      })()}
    </div>
    <div class="settings-grid">
      <div class="settings-panel">
        <div class="settings-panel-title">Profile &amp; Security</div>
        <div class="settings-panel-sub">Update your display name or change your password. Your email is managed by your workspace administrator.</div>
        <form id="profileForm" novalidate>
          <div class="settings-field">
            <label class="settings-label" for="sfName">Display name</label>
            <input id="sfName" class="settings-input" name="name" value="${esc(me.name)}" required minlength="2" placeholder="Your name">
            <span class="field-error" id="sfNameErr"></span>
          </div>
          <div class="settings-field">
            <label class="settings-label">Email address</label>
            <input class="settings-input" value="${esc(me.email)}" readonly>
          </div>
          <hr class="settings-divider">
          <div class="settings-panel-sub" style="margin-top:0">Change password — leave blank to keep current.</div>
          <div class="settings-field">
            <label class="settings-label" for="sfCurPw">Current password</label>
            <input id="sfCurPw" class="settings-input" name="currentPassword" type="password" autocomplete="current-password" placeholder="Required to change password">
          </div>
          <div class="settings-field">
            <label class="settings-label" for="sfNewPw">New password</label>
            <input id="sfNewPw" class="settings-input" name="newPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Min. 8 characters">
            <span class="field-error" id="sfNewPwErr"></span>
          </div>
          <div class="settings-field">
            <label class="settings-label" for="sfConfPw">Confirm new password</label>
            <input id="sfConfPw" class="settings-input" name="confirmPassword" type="password" minlength="8" autocomplete="new-password" placeholder="Repeat new password">
            <span class="field-error" id="sfConfPwErr"></span>
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%;justify-content:center">Save profile →</button>
        </form>
        <hr class="settings-divider">
        <button class="btn btn-secondary" style="width:100%;justify-content:center" id="settingsLogout">Sign out of NEXORA</button>
      </div>
      <div class="settings-panel">
        <div class="settings-panel-title">My Assignments</div>
        <div class="settings-panel-sub">Work currently assigned to your account.</div>
        ${(() => {
          const mine = S.tasks.filter(t => t.assigneeId === me.id);
          return mine.length ? mine.map(t => `
            <button class="project-task-btn" data-tid="${esc(t.id)}">
              <span class="task-status-dot ${t.status==='Done'?'done':''}"></span>
              <span><b>${esc(t.title)}</b><small>${esc(t.status)} · ${esc(t.priority)} · ${fmtDate(t.dueDate)}</small></span>
              ${priorityBadge(t.priority)}
              <i>→</i>
            </button>
          `).join('') : `<div class="empty-state"><div class="empty-state-icon">✓</div><b>You're all caught up!</b><p>New assignments will appear here.</p></div>`;
        })()}
      </div>
    </div>
  `;
  $('#profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearFieldErrors('sfNameErr','sfNewPwErr','sfConfPwErr');
    const name = $('#sfName').value.trim();
    const newPw = $('#sfNewPw').value;
    const confPw = $('#sfConfPw').value;
    let ok = true;
    if (name.length < 2) { showFieldError('sfNameErr','Name must be at least 2 characters.'); ok = false; }
    if (newPw && newPw.length < 8) { showFieldError('sfNewPwErr','Password must be at least 8 characters.'); ok = false; }
    if (newPw && newPw !== confPw) { showFieldError('sfConfPwErr','Passwords do not match.'); ok = false; }
    if (!ok) return;
    try {
      await api('/api/account', { method:'PATCH', body: JSON.stringify({ name, currentPassword: $('#sfCurPw').value, newPassword: newPw }) });
      await load();
      const fb = $('#settingsFeedback');
      if (fb) { fb.innerHTML = '<div class="settings-feedback">✓ Profile saved successfully.</div>'; setTimeout(()=>fb.innerHTML='',3000); }
    } catch (err) {
      const fb = $('#settingsFeedback');
      if (fb) fb.innerHTML = `<div class="settings-feedback error">${esc(err.message)}</div>`;
    }
  });
  $('#settingsLogout').addEventListener('click', logout);
  $$('#settings [data-tid], #account [data-tid]').forEach(b => b.addEventListener('click', () => { show('tasks'); setTimeout(() => openTaskDrawer(b.dataset.tid), 100); }));
}

/* ── Task Forms & Drawer ────────────────────────────────────── */
function openTaskForm() {
  const opts = (S.projects||[]).map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
  const assignees = (S.users||[]).map(u => `<option value="${esc(u.id)}">${esc(u.name)}</option>`).join('');
  openModal('taskModal', `<div class="dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <h2>Create task</h2>
    <form id="taskCreateForm" class="formgrid" novalidate>
      <label class="wide">Task title<input name="title" placeholder="What needs to be done?" required><span class="field-error-msg" id="tcTitleErr"></span></label>
      <label class="wide">Description<textarea name="description" placeholder="Optional details…"></textarea></label>
      <label>Project<select name="projectId"><option value="">No project</option>${opts}</select></label>
      <label>Assignee<select name="assigneeId"><option value="">Unassigned</option>${assignees}</select></label>
      <label>Status<select name="status"><option>To Do</option><option>Backlog</option><option>In Progress</option><option>Review</option><option>Done</option></select></label>
      <label>Priority<select name="priority"><option>Medium</option><option>Low</option><option>High</option><option>Urgent</option></select></label>
      <label class="wide">Due date<input name="dueDate" type="date"></label>
      <div class="dialog-actions wide">
        <button class="btn btn-secondary" type="button" id="cancelTask">Cancel</button>
        <button class="btn btn-primary" type="submit">Create task</button>
      </div>
    </form>
  </div>`);
  $('#cancelTask').addEventListener('click', closeModal);
  $('#taskCreateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const title = e.target.elements.title.value.trim();
    $('#tcTitleErr').textContent = '';
    if (!title) { $('#tcTitleErr').textContent = 'Task title is required.'; return; }
    try {
      await api('/api/tasks', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
      closeModal(); await load(); toast('Task created');
    } catch (err) { toast(err.message); }
  });
}

function openProjectForm() {
  openModal('projectModal', `<div class="dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <h2>Create project</h2>
    <form id="projectCreateForm" class="formgrid" novalidate>
      <label class="wide">Project name<input name="name" placeholder="Name this initiative" required><span class="field-error-msg" id="pcNameErr"></span></label>
      <label class="wide">Description<textarea name="description" placeholder="What is this project about?"></textarea></label>
      <label class="wide">Deadline<input name="deadline" type="date"></label>
      <div class="dialog-actions wide">
        <button class="btn btn-secondary" type="button" id="cancelProject">Cancel</button>
        <button class="btn btn-primary" type="submit">Create project</button>
      </div>
    </form>
  </div>`);
  $('#cancelProject').addEventListener('click', closeModal);
  $('#projectCreateForm').addEventListener('submit', async e => {
    e.preventDefault();
    const name = e.target.elements.name.value.trim();
    $('#pcNameErr').textContent = '';
    if (!name) { $('#pcNameErr').textContent = 'Project name is required.'; return; }
    try {
      await api('/api/projects', { method:'POST', body: JSON.stringify(Object.fromEntries(new FormData(e.target))) });
      closeModal(); await load(); toast('Project created');
    } catch (err) { toast(err.message); }
  });
}

function openTaskDrawer(taskId) {
  const t = S.tasks.find(x => x.id === taskId);
  if (!t) return;
  const assignees = (S.users||[]).map(u => `<option value="${esc(u.id)}" ${u.id===t.assigneeId?'selected':''}>${esc(u.name)}</option>`).join('');
  const comments = (S.comments||[]).filter(c => c.taskId === t.id);
  openModal('taskModal', `<div class="dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <div class="dialog-kicker">● LIVE COLLABORATION · REVISION ${t.revision}</div>
    <h2>Edit task</h2>
    <form id="taskEditForm" class="formgrid" novalidate>
      <label class="wide">Title<input name="title" value="${esc(t.title)}" required><span class="field-error-msg" id="teTitleErr"></span></label>
      <label class="wide">Description<textarea name="description">${esc(t.description||'')}</textarea></label>
      <label>Status<select name="status">${['Backlog','To Do','In Progress','Review','Done'].map(s=>`<option ${t.status===s?'selected':''}>${s}</option>`).join('')}</select></label>
      <label>Priority<select name="priority">${['Low','Medium','High','Urgent'].map(s=>`<option ${t.priority===s?'selected':''}>${s}</option>`).join('')}</select></label>
      <label>Assignee<select name="assigneeId"><option value="">Unassigned</option>${assignees}</select></label>
      <label>Due date<input name="dueDate" type="date" value="${esc(t.dueDate||'')}"></label>
      <div class="dialog-actions wide">
        <button class="btn btn-danger btn-sm" type="button" id="deleteTaskBtn">Delete</button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" type="button" id="cancelEdit">Cancel</button>
          <button class="btn btn-primary" type="submit">Save revision ${t.revision}</button>
        </div>
      </div>
    </form>
    <div class="comments">
      <h3>Comments &amp; activity</h3>
      ${comments.map(c => `<div class="comment">
        <div class="comment-meta">
          <div class="avatar" style="width:24px;height:24px;font-size:9px">${esc(initials(user(c.authorId).name))}</div>
          <b>${esc(user(c.authorId).name)}</b>
          <time>${fmtDt(c.createdAt)}</time>
          ${c.authorId===me.id?`<div class="comment-actions">
            <button class="btn btn-ghost btn-sm" data-edit-c="${esc(c.id)}">Edit</button>
            <button class="btn btn-ghost btn-sm" style="color:var(--rose)" data-del-c="${esc(c.id)}">Delete</button>
          </div>`:''}
        </div>
        <div class="comment-text">${esc(c.text)}</div>
      </div>`).join('') || '<p style="font-size:12px;color:var(--text-2)">No comments yet.</p>'}
      <form id="addComment" style="display:flex;gap:8px;margin-top:12px">
        <input class="settings-input" name="text" placeholder="Write a comment…" required style="flex:1">
        <button class="btn btn-primary btn-sm" type="submit">Send</button>
      </form>
    </div>
  </div>`);
  $('#cancelEdit').addEventListener('click', closeModal);
  $('#taskEditForm').addEventListener('submit', e => saveTask(e, t));
  $('#deleteTaskBtn').addEventListener('click', async () => {
    if (!confirm('Delete this task?')) return;
    await api('/api/tasks/' + t.id, { method:'DELETE' }); closeModal(); await load(); toast('Task deleted');
  });
  $('#addComment').addEventListener('submit', async e => {
    e.preventDefault();
    const text = e.target.elements.text.value.trim();
    if (!text) return;
    try { await api('/api/tasks/' + t.id + '/comments', { method:'POST', body: JSON.stringify({ text }) }); await load(); openTaskDrawer(t.id); toast('Comment added'); }
    catch (err) { toast(err.message); }
  });
  $$('[data-edit-c]').forEach(b => b.addEventListener('click', async () => {
    const c = S.comments.find(x => x.id === b.dataset.editC);
    const txt = prompt('Edit comment', c?.text); if (txt === null) return;
    try { await api('/api/comments/' + c.id, { method:'PATCH', body: JSON.stringify({ text: txt }) }); await load(); openTaskDrawer(t.id); toast('Comment updated'); }
    catch (err) { toast(err.message); }
  }));
  $$('[data-del-c]').forEach(b => b.addEventListener('click', async () => {
    if (!confirm('Delete comment?')) return;
    try { await api('/api/comments/' + b.dataset.delC, { method:'DELETE' }); await load(); openTaskDrawer(t.id); toast('Comment deleted'); }
    catch (err) { toast(err.message); }
  }));
}

async function saveTask(e, t) {
  e.preventDefault();
  const title = e.target.elements.title.value.trim();
  $('#teTitleErr').textContent = '';
  if (!title) { $('#teTitleErr').textContent = 'Title is required.'; return; }
  const data = Object.fromEntries(new FormData(e.target));
  data.revision = t.revision;
  try {
    await api('/api/tasks/' + t.id, { method:'PATCH', body: JSON.stringify(data) });
    closeModal(); await load(); toast('Task saved — revision updated');
  } catch (err) {
    if (err.status === 409) return showConflict(t, data, err.data);
    toast(err.message);
  }
}

function showConflict(t, data, c) {
  const server = c.serverTask;
  openModal('taskModal', `<div class="dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <div class="conflict-box">⚡ <b>Task Updated Elsewhere</b><br>Another teammate saved revision ${server?.revision}. Your draft is preserved below.</div>
    <h2>Resolve conflict</h2>
    <div class="compare-grid">
      <div class="compare-col"><b>Your version</b><p><b>Title:</b> ${esc(data.title)}</p><p><b>Status:</b> ${esc(data.status)}</p><p><b>Description:</b> ${esc(data.description)}</p></div>
      <div class="compare-col"><b>Server version (rev. ${server?.revision})</b><p><b>Title:</b> ${esc(server?.title)}</p><p><b>Status:</b> ${esc(server?.status)}</p><p><b>Description:</b> ${esc(server?.description)}</p></div>
    </div>
    <div class="dialog-actions">
      <button class="btn btn-secondary" id="cfRefresh">Load server version</button>
      <button class="btn btn-primary" id="cfForce">Keep my changes</button>
    </div>
  </div>`);
  $('#cfRefresh').addEventListener('click', async () => { await load(); openTaskDrawer(t.id); toast('Server version loaded'); });
  $('#cfForce').addEventListener('click', async () => {
    try { await api('/api/tasks/' + t.id, { method:'PATCH', body: JSON.stringify({ ...data, revision: server?.revision }) }); closeModal(); await load(); toast('Your changes saved as new revision'); }
    catch (err) { toast(err.message); }
  });
}

/* ── Global Search ──────────────────────────────────────────── */
function handleSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (q.length < 2) return;
  const tasks = S.tasks?.filter(x => x.title?.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q)) || [];
  const ps = S.projects?.filter(x => x.name?.toLowerCase().includes(q)) || [];
  const us = S.users?.filter(x => x.name?.toLowerCase().includes(q)) || [];
  openModal('palette', `<div class="dialog palette-dialog">
    <button class="dialog-close" aria-label="Close">×</button>
    <h2>Search <small style="font-size:13px;color:var(--text-2);font-weight:400">"${esc(q)}"</small></h2>
    <div class="palette-results">
      ${tasks.length ? `<div class="palette-group"><h3>Tasks (${tasks.length})</h3>${tasks.map(t=>`<button class="palette-item" data-task="${esc(t.id)}"><b>${esc(t.title)}</b><small>${esc(t.status)} · ${esc(t.priority)}</small></button>`).join('')}</div>` : ''}
      ${ps.length ? `<div class="palette-group"><h3>Projects (${ps.length})</h3>${ps.map(p=>`<button class="palette-item" data-go="projects" data-pid="${esc(p.id)}"><b>${esc(p.name)}</b><small>${esc(p.description||'')}</small></button>`).join('')}</div>` : ''}
      ${us.length ? `<div class="palette-group"><h3>People (${us.length})</h3>${us.map(u=>`<button class="palette-item" data-go="team" data-mid="${esc(u.id)}"><b>${esc(u.name)}</b><small>${esc(u.role||'Member')} · ${esc(u.email)}</small></button>`).join('')}</div>` : ''}
      ${!tasks.length && !ps.length && !us.length ? `<div class="palette-empty">No results for "${esc(q)}"</div>` : ''}
    </div>
  </div>`);
  $$('#palette [data-task]').forEach(b => b.addEventListener('click', () => { closeModal(); openTaskDrawer(b.dataset.task); }));
  $$('#palette [data-go]').forEach(b => b.addEventListener('click', () => { closeModal(); show(b.dataset.go); }));
}
