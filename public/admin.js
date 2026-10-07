(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = name => String(name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const loginView = $('#adminLogin');
  const consoleView = $('#adminConsole');
  const loginPassword = $('#adminLoginForm input[name="password"]');
  const loginPasswordToggle = document.createElement('button');
  loginPasswordToggle.type = 'button';
  loginPasswordToggle.className = 'admin-password-toggle';
  loginPasswordToggle.textContent = 'Show password';
  loginPassword.after(loginPasswordToggle);
  loginPasswordToggle.addEventListener('click', () => {
    const reveal = loginPassword.type === 'password';
    loginPassword.type = reveal ? 'text' : 'password';
    loginPasswordToggle.textContent = reveal ? 'Hide password' : 'Show password';
  });
  let administrator = null;
  let users = [];
  let workspaceState = {};
  let eventStream = null;
  let resettingUserId = null;

  async function request(url, options = {}) {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  function showLogin(message = '') {
    consoleView.hidden = true;
    loginView.hidden = false;
    $('#adminLoginError').textContent = message;
  }

  function showConsole() {
    loginView.hidden = true;
    consoleView.hidden = false;
    $('#adminName').textContent = administrator.name;
    $('#adminRole').textContent = administrator.role || 'Administrator';
    $('#adminAvatar').textContent = initials(administrator.name);
    if (!eventStream) {
        eventStream = new EventSource('/api/events');
        eventStream.onopen = () => { if (document.querySelector('.admin-nav button.active')?.dataset.view === 'health') renderUtility('health'); };
        eventStream.onerror = () => { if (document.querySelector('.admin-nav button.active')?.dataset.view === 'health') renderUtility('health'); };
        ['task.created', 'task.updated', 'task.deleted', 'comment.created', 'project.created', 'file.uploaded', 'file.deleted', 'user.created', 'user.updated', 'user.deleted', 'workspace.updated'].forEach(type => eventStream.addEventListener(type, () => loadUsers()));
    }
    loadUsers();
  }

  async function verifySession() {
    try {
      const { user } = await request('/api/me');
      if (user.access !== 'admin') {
        window.location.replace('/');
        return;
      }
      administrator = user;
      showConsole();
    } catch {
      showLogin();
    }
  }

  function setView(name) {
    const staticView = name === 'overview' ? 'overviewView' : name === 'accounts' ? 'accountsView' : null;
    $('#overviewView').hidden = staticView !== 'overviewView';
    $('#accountsView').hidden = staticView !== 'accountsView';
    $('#utilityView').hidden = Boolean(staticView);
    document.querySelectorAll('.admin-nav button').forEach(button => button.classList.toggle('active', button.dataset.view === name));
    if (!staticView) renderUtility(name);
  }

  function feedback(message, error = false) {
    const element = $('#adminFeedback');
    element.hidden = !message;
    element.classList.toggle('error', error);
    element.textContent = message;
  }

  function renderOverview() {
    const admins = users.filter(user => user.access === 'admin').length;
    const tasks = workspaceState.tasks || [];
    const today = new Date().toISOString().slice(0, 10);
    $('#metricTotal').textContent = users.length;
    $('#metricActive').textContent = users.filter(user => user.active).length;
    $('#metricAdmins').textContent = admins;
    $('#metricMembers').textContent = users.length - admins;
    $('#metricProjects').textContent = (workspaceState.projects || []).length;
    $('#metricTasks').textContent = tasks.length;
    $('#metricCompleted').textContent = tasks.filter(task => task.status === 'Done').length;
    $('#metricOverdue').textContent = tasks.filter(task => task.dueDate && task.dueDate < today && task.status !== 'Done').length;
    $('#metricFiles').textContent = (workspaceState.files || []).length;
    const roster = users.slice(0, 5);
    $('#overviewRoster').innerHTML = roster.map(user => `<div class="roster-row"><span class="roster-initials">${escapeHtml(initials(user.name))}</span><span class="roster-person"><b>${escapeHtml(user.name)}</b><small>${escapeHtml(user.email)}</small></span><span class="access-label ${user.access === 'admin' ? 'admin' : ''}">${user.access === 'admin' ? 'Admin' : 'Member'}</span></div>`).join('') || '<p class="empty-row">No workspace accounts yet.</p>';
    const names = new Map((workspaceState.users || []).map(user => [user.id, user.name]));
    $('#overviewActivity').innerHTML = (workspaceState.activities || []).slice(0, 5).map(item => `<div class="roster-row"><span class="roster-initials">${escapeHtml(initials(names.get(item.actorId) || 'N'))}</span><span class="roster-person"><b>${escapeHtml(names.get(item.actorId) || 'Workspace member')} ${escapeHtml(item.action)}</b><small>${escapeHtml(item.target)} · ${new Date(item.at).toLocaleString()}</small></span></div>`).join('') || '<p class="empty-row">No workspace activity recorded yet.</p>';
  }

  function renderAccounts() {
    const search = ($('#accountSearch')?.value || '').trim().toLowerCase();
    const access = $('#accessFilter')?.value || 'all';
    const filtered = users.filter(user => {
      const matchesSearch = `${user.name} ${user.email} ${user.role}`.toLowerCase().includes(search);
      return matchesSearch && (access === 'all' || user.access === access);
    });
    $('#accountCount').textContent = `${users.length} ${users.length === 1 ? 'account' : 'accounts'}`;
    $('#directoryTotal').textContent = filtered.length;
    $('#accountRows').innerHTML = filtered.map(user => `<tr data-account-row="${escapeHtml(user.id)}"><td class="account-name"><input data-name value="${escapeHtml(user.name)}" aria-label="${escapeHtml(user.name)} full name"><input data-email type="email" value="${escapeHtml(user.email)}" aria-label="${escapeHtml(user.name)} email"></td><td><input data-role value="${escapeHtml(user.role || 'Member')}" aria-label="${escapeHtml(user.name)} job title"></td><td><select data-access aria-label="${escapeHtml(user.name)} access"><option value="user" ${user.access === 'user' ? 'selected' : ''}>Member</option><option value="admin" ${user.access === 'admin' ? 'selected' : ''}>Admin</option></select></td><td><select data-active aria-label="${escapeHtml(user.name)} account status"><option value="true" ${user.active ? 'selected' : ''}>Active</option><option value="false" ${user.active ? '' : 'selected'}>Suspended</option></select></td><td><div class="row-actions"><button data-save-user="${escapeHtml(user.id)}">Save</button>${user.id !== administrator.id ? `<button data-reset-password="${escapeHtml(user.id)}">Reset</button>` : ''}<button class="delete-user" data-delete-user="${escapeHtml(user.id)}">Remove</button></div></td></tr>`).join('') || '<tr><td class="empty-row" colspan="5">No accounts match those filters.</td></tr>';
  }

  async function loadUsers(message = '') {
    try {
      const [result, workspace] = await Promise.all([request('/api/admin/users'), request('/api/me')]);
      users = result.users;
      workspaceState = workspace.state;
      renderOverview();
      renderAccounts();
      if (!$('#utilityView').hidden) renderUtility(document.querySelector('.admin-nav button.active')?.dataset.view);
      feedback(message);
    } catch (error) {
      feedback(error.message, true);
    }
  }

  function utilityHeader(kicker, title, description) {
    return `<div class="view-heading compact-heading"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${description}</p></div></div>`;
  }

  function taskSummary() {
    const tasks = workspaceState.tasks || [];
    const projects = new Map((workspaceState.projects || []).map(project => [project.id, project.name]));
    const members = new Map((workspaceState.users || []).map(user => [user.id, user.name]));
    const search = ($('#taskSearch')?.value || '').trim().toLowerCase();
    const projectId = $('#taskProjectFilter')?.value || 'all';
    const assigneeId = $('#taskAssigneeFilter')?.value || 'all';
    const status = $('#taskStatusFilter')?.value || 'all';
    const priority = $('#taskPriorityFilter')?.value || 'all';
    const filtered = tasks.filter(task => {
      const text = `${task.title} ${projects.get(task.projectId) || ''} ${members.get(task.assigneeId) || ''}`.toLowerCase();
      return (!search || text.includes(search)) && (projectId === 'all' || task.projectId === projectId) && (assigneeId === 'all' || task.assigneeId === assigneeId) && (status === 'all' || task.status === status) && (priority === 'all' || task.priority === priority);
    });
    $('#taskAdminCount').textContent = `${filtered.length} of ${tasks.length} tasks`;
    $('#adminTaskRows').innerHTML = filtered.map(task => `<tr data-admin-task="${escapeHtml(task.id)}"><td class="account-name"><b>${escapeHtml(task.title)}</b><small>${escapeHtml(projects.get(task.projectId) || 'Unassigned project')} · r${task.revision}</small></td><td>${escapeHtml(members.get(task.assigneeId) || 'Unassigned')}</td><td><select data-task-status aria-label="${escapeHtml(task.title)} status">${['Backlog', 'To Do', 'In Progress', 'Review', 'Done'].map(value => `<option ${task.status === value ? 'selected' : ''}>${value}</option>`).join('')}</select></td><td><select data-task-priority aria-label="${escapeHtml(task.title)} priority">${['Low', 'Medium', 'High', 'Urgent'].map(value => `<option ${task.priority === value ? 'selected' : ''}>${value}</option>`).join('')}</select></td><td>${escapeHtml(task.dueDate || 'No due date')}</td><td><div class="row-actions"><button data-save-task="${escapeHtml(task.id)}">Save</button><button class="delete-user" data-delete-task="${escapeHtml(task.id)}">Delete</button></div></td></tr>`).join('') || '<tr><td class="empty-row" colspan="6">No tasks match these filters.</td></tr>';
  }

  function renderUtility(name) {
    const host = $('#utilityView');
    const projects = workspaceState.projects || [];
    const tasks = workspaceState.tasks || [];
    const files = workspaceState.files || [];
    const activities = workspaceState.activities || [];
    const members = new Map((workspaceState.users || []).map(user => [user.id, user.name]));
    const projectName = new Map(projects.map(project => [project.id, project.name]));
    const today = new Date().toISOString().slice(0, 10);
    const pageTemplates = {
      roles: () => `${utilityHeader('CONTROL ROOM / ACCESS MODEL', 'Roles & permissions', 'Permissions currently enforced by this workspace.')}
        <section class="utility-panel"><div class="utility-note"><b>Current access model</b><span>The API stores two access levels: Administrator and Member. Job titles are descriptive and do not grant permissions.</span></div><div class="directory-scroll"><table class="account-table permission-table"><thead><tr><th>Capability</th><th>Administrator</th><th>Member</th></tr></thead><tbody><tr><td>View workspace data</td><td>Allowed</td><td>Allowed</td></tr><tr><td>Create projects and tasks</td><td>Allowed</td><td>Allowed</td></tr><tr><td>Update task status and comments</td><td>Allowed</td><td>Allowed</td></tr><tr><td>Manage user accounts and access</td><td>Allowed</td><td>Not allowed</td></tr><tr><td>Change own profile/password</td><td>Allowed</td><td>Allowed</td></tr><tr><td>Workspace administration</td><td>Allowed</td><td>Not allowed</td></tr></tbody></table></div></section>`,
      projects: () => `${utilityHeader('CONTROL ROOM / PORTFOLIO', 'Projects', 'Review project progress calculated from the persisted task board.')}
        <div class="utility-panel"><div class="utility-panel-heading"><div><span class="eyebrow">PROJECT REGISTER</span><h2>${projects.length} workspace projects</h2></div><span class="utility-caption">Create is available · edit and archive are not supported by the current API</span></div><form id="adminProjectForm" class="utility-create-form"><label>Project name<input name="name" required minlength="2"></label><label>Deadline<input name="deadline" type="date"></label><label>Description<input name="description" maxlength="500"></label><button class="button button-primary">Create project</button></form><div class="project-admin-grid">${projects.map(project => { const group = tasks.filter(task => task.projectId === project.id); const completed = group.filter(task => task.status === 'Done').length; const overdue = group.filter(task => task.dueDate && task.dueDate < today && task.status !== 'Done').length; const progress = group.length ? Math.round(completed / group.length * 100) : 0; const health = overdue ? 'At risk' : group.length && completed === group.length ? 'Healthy' : 'In progress'; return `<article class="project-admin-card"><div class="project-admin-head"><span class="project-symbol">▣</span><span class="health-chip ${overdue ? 'warning' : completed === group.length && group.length ? 'good' : ''}">${health}</span></div><h3>${escapeHtml(project.name)}</h3><p>${escapeHtml(project.description || 'No description provided.')}</p><div class="project-progress"><span style="width:${progress}%"></span></div><div class="project-admin-meta"><span>${completed}/${group.length} tasks complete</span><span>${escapeHtml(project.deadline || 'No deadline')}</span></div></article>`; }).join('') || '<p class="empty-row">No projects have been created.</p>'}</div></div>`,
      tasks: () => `${utilityHeader('CONTROL ROOM / WORK QUEUE', 'Task management', 'Filter workspace tasks and save changes using the existing revision check.')}
        <section class="utility-panel"><div class="directory-tools utility-tools"><label class="search-field"><span aria-hidden="true">⌕</span><input id="taskSearch" type="search" placeholder="Search task, project, assignee" aria-label="Search tasks"></label><select id="taskStatusFilter" aria-label="Filter task status"><option value="all">All statuses</option>${['Backlog', 'To Do', 'In Progress', 'Review', 'Done'].map(value => `<option>${value}</option>`).join('')}</select><select id="taskPriorityFilter" aria-label="Filter priority"><option value="all">All priorities</option>${['Low', 'Medium', 'High', 'Urgent'].map(value => `<option>${value}</option>`).join('')}</select></div><div class="utility-panel-heading"><h2 id="taskAdminCount">${tasks.length} tasks</h2><span class="utility-caption">Each save checks the current task revision.</span></div><div class="directory-scroll"><table class="account-table task-admin-table"><thead><tr><th>Task / project</th><th>Assignee</th><th>Status</th><th>Priority</th><th>Deadline</th><th>Actions</th></tr></thead><tbody id="adminTaskRows"></tbody></table></div></section>`,
      files: () => `${utilityHeader('CONTROL ROOM / STORAGE', 'Workspace files', 'Metadata from real uploads. Downloads use the existing authenticated file service.')}
        <section class="utility-panel"><div class="utility-panel-heading"><h2>${files.length} stored files</h2><span class="utility-caption">Maximum upload size: 5 MB per file</span></div><div class="directory-scroll"><table class="account-table"><thead><tr><th>File</th><th>Project</th><th>Uploaded by</th><th>Size</th><th>Date</th><th>Action</th></tr></thead><tbody>${files.map(file => `<tr><td class="account-name"><b>${escapeHtml(file.name)}</b><small>${escapeHtml(file.type || 'Unknown type')}</small></td><td>${escapeHtml(projectName.get(file.projectId) || 'Workspace')}</td><td>${escapeHtml(members.get(file.ownerId) || 'Former member')}</td><td>${Math.max(1, Math.round(file.size / 1024))} KB</td><td>${escapeHtml(file.createdAt ? new Date(file.createdAt).toLocaleDateString() : 'Unknown')}</td><td><a class="table-link" href="/api/files/${encodeURIComponent(file.id)}/download">Download</a></td></tr>`).join('') || '<tr><td class="empty-row" colspan="6">No workspace files have been uploaded yet.</td></tr>'}</tbody></table></div></section>`,
      activity: () => `${utilityHeader('CONTROL ROOM / AUDIT TRAIL', 'Activity logs', 'Chronological events recorded by workspace actions. Sign-ins are not currently recorded.')}
        <section class="utility-panel"><div class="utility-panel-heading"><h2>${activities.length} recorded events</h2><label class="filter-label">Event type<select id="activityFilter"><option value="all">All activity</option><option value="task">Tasks</option><option value="project">Projects</option><option value="file">Files</option><option value="comment">Comments</option><option value="account">Accounts</option></select></label></div><div id="adminActivityList" class="audit-list">${activities.map(item => `<article class="audit-row" data-event-action="${escapeHtml(item.action.toLowerCase())}"><span class="audit-mark">${escapeHtml(initials(members.get(item.actorId) || 'N'))}</span><div class="audit-copy"><b>${escapeHtml(members.get(item.actorId) || 'Former member')} ${escapeHtml(item.action)}</b><p>${escapeHtml(item.target)}</p></div><time>${escapeHtml(new Date(item.at).toLocaleString())}</time></article>`).join('') || '<p class="empty-row">No activity has been recorded yet.</p>'}</div></section>`,
      analytics: () => `${utilityHeader('CONTROL ROOM / INSIGHTS', 'Workspace analytics', 'A live summary derived from stored projects, tasks, and activity.')}
        <div class="analytics-grid"><section class="utility-panel"><div class="utility-panel-heading"><h2>Task distribution</h2><span class="utility-caption">${tasks.length} total tasks</span></div><div class="distribution-list">${['Backlog', 'To Do', 'In Progress', 'Review', 'Done'].map(status => { const count = tasks.filter(task => task.status === status).length; const width = tasks.length ? Math.round(count / tasks.length * 100) : 0; return `<div class="distribution-row"><span>${status}</span><div class="distribution-track"><i style="width:${width}%"></i></div><b>${count}</b></div>`; }).join('')}</div></section><section class="utility-panel"><div class="utility-panel-heading"><h2>Project delivery</h2><span class="utility-caption">Complete vs open</span></div>${projects.map(project => { const rows = tasks.filter(task => task.projectId === project.id); const done = rows.filter(task => task.status === 'Done').length; return `<div class="delivery-row"><div><b>${escapeHtml(project.name)}</b><small>${done} complete · ${rows.length - done} open</small></div><strong>${rows.length ? Math.round(done / rows.length * 100) : 0}%</strong></div>`; }).join('') || '<p class="empty-row">Create a project to see delivery analytics.</p>'}</section></div>`,
      notifications: () => `${utilityHeader('CONTROL ROOM / UPDATES', 'Notifications', 'Updates shown here are sourced from recorded workspace activity; read state is not persisted yet.')}
        <section class="utility-panel"><div class="utility-panel-heading"><h2>Recent workspace updates</h2><span class="utility-caption">${activities.length} activity-backed updates</span></div><div class="audit-list">${activities.slice(0, 20).map(item => `<article class="audit-row"><span class="audit-mark">${escapeHtml(initials(members.get(item.actorId) || 'N'))}</span><div class="audit-copy"><b>${escapeHtml(members.get(item.actorId) || 'Former member')} ${escapeHtml(item.action)}</b><p>${escapeHtml(item.target)}</p></div><time>${escapeHtml(new Date(item.at).toLocaleString())}</time></article>`).join('') || '<p class="empty-row">No workspace updates yet.</p>'}</div></section>`,
      settings: () => `${utilityHeader('CONTROL ROOM / CONFIGURATION', 'Workspace settings', 'Update the workspace name used by members and admin tools.')}
        <section class="utility-panel settings-panel"><form id="workspaceSettingsForm"><label>Workspace name<input name="name" minlength="2" maxlength="120" value="${escapeHtml(workspaceState.workspace?.name || '')}" required></label><p class="utility-caption">Workspace identifiers and stored project data are unchanged.</p><button class="button button-primary">Save workspace name</button></form></section>`,
      security: () => `${utilityHeader('CONTROL ROOM / SECURITY', 'Security & session', 'Review the active account and update its password.')}
        <div class="analytics-grid"><section class="utility-panel"><div class="security-state"><span class="health-chip good">Authenticated</span><h2>${escapeHtml(administrator.email)}</h2><p>Administrator access · Session cookie is HTTP-only. Session identifiers are not shown here.</p></div></section><section class="utility-panel"><form id="adminPasswordForm" class="security-form"><h2>Change admin password</h2><label>Current password<input name="currentPassword" type="password" autocomplete="current-password" required></label><label>New password<input name="newPassword" type="password" minlength="8" autocomplete="new-password" required></label><button class="button button-primary">Update password</button></form></section></div>`,
      health: () => { const connected = eventStream?.readyState === EventSource.OPEN; return `${utilityHeader('CONTROL ROOM / SERVICE STATUS', 'System health', 'Application-level checks from the current authenticated session; no external infrastructure is monitored.')}
        <section class="utility-panel health-list"><article><span class="health-chip good">Operational</span><div><b>Authentication</b><small>Admin session verified by the API.</small></div></article><article><span class="health-chip good">Loaded</span><div><b>Persistent workspace data</b><small>${users.length} users, ${projects.length} projects, ${tasks.length} tasks loaded from the local data store.</small></div></article><article><span class="health-chip ${connected ? 'good' : 'warning'}">${connected ? 'Connected' : 'Reconnecting'}</span><div><b>Realtime events</b><small>Server-Sent Events ${connected ? 'connected for this browser.' : 'connection is not currently open.'}</small></div></article><article><span class="health-chip ${files.length ? 'good' : ''}">${files.length ? 'In use' : 'Ready'}</span><div><b>File service</b><small>${files.length} file records · 5 MB per upload.</small></div></article><article><span class="health-chip good">Operational</span><div><b>Admin API</b><small>Protected account and workspace endpoints are responding.</small></div></article></section>`; }
    };
    if (!pageTemplates[name]) return;
    const previousSearch = $('#utilitySearch')?.value || '';
    host.innerHTML = pageTemplates[name]();
    if (name === 'tasks') {
      const search = $('#taskSearch');
      search.id = 'utilitySearch';
      search.value = previousSearch;
      const tools = $('.utility-tools');
      const projectFilter = document.createElement('select');
      projectFilter.id = 'taskProjectFilter';
      projectFilter.setAttribute('aria-label', 'Filter project');
      projectFilter.innerHTML = `<option value="all">All projects</option>${projects.map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('')}`;
      const assigneeFilter = document.createElement('select');
      assigneeFilter.id = 'taskAssigneeFilter';
      assigneeFilter.setAttribute('aria-label', 'Filter assignee');
      assigneeFilter.innerHTML = `<option value="all">All assignees</option>${(workspaceState.users || []).map(user => `<option value="${escapeHtml(user.id)}">${escapeHtml(user.name)}</option>`).join('')}`;
      tools.insertBefore(projectFilter, $('#taskStatusFilter'));
      tools.insertBefore(assigneeFilter, $('#taskStatusFilter'));
      taskSummary();
      search.addEventListener('input', taskSummary);
      projectFilter.addEventListener('change', taskSummary);
      assigneeFilter.addEventListener('change', taskSummary);
      $('#taskStatusFilter').addEventListener('change', taskSummary);
      $('#taskPriorityFilter').addEventListener('change', taskSummary);
      $('#adminTaskRows').addEventListener('click', handleTaskActions);
    }
    if (name === 'projects') {
      $('#adminProjectForm').addEventListener('submit', createProject);
      const grid = $('.project-admin-grid');
      if (grid) {
        const searchField = document.createElement('label');
        searchField.className = 'search-field utility-project-search';
        searchField.innerHTML = '<span aria-hidden="true">⌕</span><input type="search" placeholder="Find a project" aria-label="Find a project">';
        grid.before(searchField);
        const cards = [...grid.querySelectorAll('.project-admin-card')];
        cards.forEach((card, index) => { const project = projects[index]; card.dataset.projectSearch = `${project.name} ${project.description || ''}`.toLowerCase(); });
        searchField.querySelector('input').addEventListener('input', event => {
          const query = event.currentTarget.value.trim().toLowerCase();
          cards.forEach(card => { card.hidden = !card.dataset.projectSearch.includes(query); });
        });
      }
    }
    if (name === 'files') attachFileFilters(files, members, projectName);
    if (name === 'activity') $('#activityFilter').addEventListener('change', filterActivities);
    if (name === 'settings') $('#workspaceSettingsForm').addEventListener('submit', saveWorkspace);
    if (name === 'security') $('#adminPasswordForm').addEventListener('submit', updateAdminPassword);
  }

  async function createProject(event) {
    event.preventDefault();
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    button.textContent = 'Creating…';
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await request('/api/projects', { method: 'POST', body: JSON.stringify(values) });
      await loadUsers('Project created.');
    } catch (error) {
      feedback(error.message, true);
    } finally {
      button.disabled = false;
      button.textContent = 'Create project';
    }
  }

  async function handleTaskActions(event) {
    const saveButton = event.target.closest('[data-save-task]');
    const deleteButton = event.target.closest('[data-delete-task]');
    if (saveButton) {
      const row = saveButton.closest('[data-admin-task]');
      const task = (workspaceState.tasks || []).find(item => item.id === saveButton.dataset.saveTask);
      if (!task) return feedback('This task is no longer available. Refresh the list and try again.', true);
      saveButton.disabled = true;
      try {
        await request(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'PATCH', body: JSON.stringify({ revision: task.revision, status: row.querySelector('[data-task-status]').value, priority: row.querySelector('[data-task-priority]').value }) });
        await loadUsers('Task updated.');
      } catch (error) {
        feedback(error.message === 'CONFLICT' ? 'This task changed elsewhere. The latest version is being loaded.' : error.message, true);
        await loadUsers();
      } finally {
        saveButton.disabled = false;
      }
    }
    if (deleteButton) {
      const task = (workspaceState.tasks || []).find(item => item.id === deleteButton.dataset.deleteTask);
      if (!task || !await confirmAction('Delete task?', `Delete “${task.title}”? This removes the task from the workspace.`, 'Delete task')) return;
      try {
        await request(`/api/tasks/${encodeURIComponent(task.id)}`, { method: 'DELETE' });
        await loadUsers('Task deleted.');
      } catch (error) {
        feedback(error.message, true);
      }
    }
  }

  async function filterActivities() {
    const filter = $('#activityFilter').value;
    document.querySelectorAll('#adminActivityList [data-event-action]').forEach(row => {
    const action = row.dataset.eventAction;
      const matches = filter === 'all' || (filter === 'task' && action.includes('task')) || (filter === 'project' && action.includes('project')) || (filter === 'file' && action.includes('file')) || (filter === 'comment' && action.includes('comment')) || (filter === 'account' && action.includes('account'));
      row.hidden = !matches;
    });
  }

  async function saveWorkspace(event) {
    event.preventDefault();
    try {
      await request('/api/admin/workspace', { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      await loadUsers('Workspace name updated.');
    } catch (error) {
      feedback(error.message, true);
    }
  }

  async function updateAdminPassword(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await request('/api/account', { method: 'PATCH', body: JSON.stringify({ name: administrator.name, ...values }) });
      event.currentTarget.reset();
      feedback('Password updated.');
    } catch (error) {
      feedback(error.message, true);
    }
  }

  function confirmAction(title, message, actionLabel) {
    const dialog = $('#adminConfirm');
    $('#confirmTitle').textContent = title;
    $('#confirmMessage').textContent = message;
    $('#confirmAction').textContent = actionLabel;
    dialog.returnValue = 'cancel';
    dialog.showModal();
    return new Promise(resolve => dialog.addEventListener('close', () => resolve(dialog.returnValue === 'confirm'), { once: true }));
  }

  function attachFileFilters(files, members, projectName) {
    const table = $('#utilityView .account-table');
    const directory = table?.closest('.directory-scroll');
    if (!table || !directory) return;
    const categories = [...new Set(files.map(file => file.type?.split('/')[0] || 'unknown'))].sort();
    const controls = document.createElement('div');
    controls.className = 'directory-tools utility-tools';
    controls.innerHTML = `<label class="search-field"><span aria-hidden="true">⌕</span><input id="fileSearch" type="search" placeholder="Find a file" aria-label="Find a file"></label><select id="fileProjectFilter" aria-label="Filter project"><option value="all">All projects</option>${(workspaceState.projects || []).map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('')}</select><select id="fileTypeFilter" aria-label="Filter file type"><option value="all">All file types</option>${categories.map(category => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('')}</select>`;
    directory.before(controls);
    const rows = [...table.querySelectorAll('tbody tr')];
    rows.slice(0, files.length).forEach((row, index) => {
      const file = files[index];
      row.dataset.fileSearch = `${file.name} ${file.type} ${projectName.get(file.projectId) || ''} ${members.get(file.ownerId) || ''}`.toLowerCase();
      row.dataset.fileProject = file.projectId || '';
      row.dataset.fileType = file.type?.split('/')[0] || 'unknown';
    });
    const filter = () => {
      const query = $('#fileSearch').value.trim().toLowerCase();
      const projectId = $('#fileProjectFilter').value;
      const type = $('#fileTypeFilter').value;
      rows.slice(0, files.length).forEach(row => { row.hidden = Boolean((query && !row.dataset.fileSearch.includes(query)) || (projectId !== 'all' && row.dataset.fileProject !== projectId) || (type !== 'all' && row.dataset.fileType !== type)); });
    };
    $('#fileSearch').addEventListener('input', filter);
    $('#fileProjectFilter').addEventListener('change', filter);
    $('#fileTypeFilter').addEventListener('change', filter);
  }

  $('#adminLoginForm').addEventListener('submit', async event => {
    event.preventDefault();
    $('#adminLoginError').textContent = '';
    const submit = event.currentTarget.querySelector('button[type="submit"]');
    submit.disabled = true;
    submit.textContent = 'Checking access…';
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      await request('/api/auth/login', { method: 'POST', body: JSON.stringify(values) });
      const { user } = await request('/api/me');
      if (user.access !== 'admin') {
        await request('/api/auth/logout', { method: 'POST' });
        return showLogin('This account does not have administrator access.');
      }
      administrator = user;
      showConsole();
    } catch (error) {
      showLogin(error.message);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Sign in to Control →';
    }
  });

  document.querySelectorAll('.admin-nav button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
  document.querySelectorAll('[data-open-accounts]').forEach(button => button.addEventListener('click', () => setView('accounts')));
  document.querySelectorAll('[data-view-link]').forEach(button => button.addEventListener('click', () => setView(button.dataset.viewLink)));
  $('#topCreate').addEventListener('click', () => {
    setView('accounts');
    $('#createAccountForm [name="name"]').focus();
  });
  $('#accountSearch').addEventListener('input', renderAccounts);
  $('#accessFilter').addEventListener('change', renderAccounts);

  $('#createAccountForm').addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await request('/api/admin/users', { method: 'POST', body: JSON.stringify(values) });
      event.currentTarget.reset();
      event.currentTarget.elements.role.value = 'Member';
      await loadUsers('Account created. They can sign in with the email and password you set.');
    } catch (error) {
      feedback(error.message, true);
    }
  });

  $('#accountRows').addEventListener('click', async event => {
    const saveButton = event.target.closest('[data-save-user]');
    const resetButton = event.target.closest('[data-reset-password]');
    const deleteButton = event.target.closest('[data-delete-user]');
    if (saveButton) {
      const row = saveButton.closest('[data-account-row]');
      const account = users.find(user => user.id === saveButton.dataset.saveUser);
      const nextActive = row.querySelector('[data-active]').value === 'true';
      if (account?.active && !nextActive && !await confirmAction('Suspend account?', `${account.name} will be signed out and will not be able to sign in until reactivated.`, 'Suspend account')) return;
      try {
        await request(`/api/admin/users/${encodeURIComponent(saveButton.dataset.saveUser)}`, {
          method: 'PATCH',
          body: JSON.stringify({ name: row.querySelector('[data-name]').value, email: row.querySelector('[data-email]').value, role: row.querySelector('[data-role]').value, access: row.querySelector('[data-access]').value, active: nextActive })
        });
        await loadUsers('Account details updated.');
      } catch (error) {
        feedback(error.message, true);
      }
    }
    if (resetButton) {
      const account = users.find(user => user.id === resetButton.dataset.resetPassword);
      if (!account) return;
      resettingUserId = account.id;
      $('#resetAccountName').textContent = account.name;
      $('#passwordResetForm').reset();
      $('#passwordResetError').textContent = '';
      $('#passwordResetDialog').showModal();
      $('#passwordResetForm [name="newPassword"]').focus();
    }
    if (deleteButton) {
      const target = users.find(user => user.id === deleteButton.dataset.deleteUser);
      if (!target || !await confirmAction('Remove account?', `Remove ${target.name} from this workspace? Accounts with assigned tasks cannot be removed.`, 'Remove account')) return;
      try {
        await request(`/api/admin/users/${encodeURIComponent(deleteButton.dataset.deleteUser)}`, { method: 'DELETE' });
        await loadUsers('Account removed from the workspace.');
      } catch (error) {
        feedback(error.message, true);
      }
    }
  });

  $('#cancelPasswordReset').addEventListener('click', () => $('#passwordResetDialog').close('cancel'));
  $('#passwordResetForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!resettingUserId) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Resetting…';
    try {
      await request(`/api/admin/users/${encodeURIComponent(resettingUserId)}`, { method: 'PATCH', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      $('#passwordResetDialog').close('confirm');
      resettingUserId = null;
      await loadUsers('Password reset; the user must sign in again.');
    } catch (error) {
      $('#passwordResetError').textContent = error.message;
    } finally {
      button.disabled = false;
      button.textContent = 'Reset password';
    }
  });

  async function signOut() {
    eventStream?.close();
    try { await request('/api/auth/logout', { method: 'POST' }); } finally { window.location.replace('/'); }
  }
  $('#adminLogout').addEventListener('click', signOut);
  $('#topLogout').addEventListener('click', signOut);
  $('#workspaceLink').addEventListener('click', event => {
    event.preventDefault();
    signOut();
  });

  verifySession();
})();
