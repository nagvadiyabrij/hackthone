(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = value => String(value || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  let calendarMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  window.team = function renderTeam() {
    const people = S.users || [];
    const roles = [...new Set(people.map(person => person.role || 'Member'))].sort();
    const target = document.querySelector('#team');
    target.innerHTML = `<div class="team-page-head"><div><span class="dashboard-kicker">NEXORA / PEOPLE</span><h1>Your team</h1><p>People, roles, and workload across this workspace.</p></div><span class="team-total">${people.length} members</span></div><div class="team-tools"><label class="team-search"><span aria-hidden="true">⌕</span><input id="teamSearch" type="search" placeholder="Search people" aria-label="Search people"></label><select id="teamRoleFilter" aria-label="Filter by role"><option value="all">All roles</option>${roles.map(role => `<option value="${escapeHtml(role)}">${escapeHtml(role)}</option>`).join('')}</select><select id="teamSort" aria-label="Sort team"><option value="name">Sort: name</option><option value="workload">Sort: workload</option></select></div><section id="teamCards" class="team-card-grid"></section>`;

    const drawCards = () => {
      const query = document.querySelector('#teamSearch').value.trim().toLowerCase();
      const role = document.querySelector('#teamRoleFilter').value;
      const sort = document.querySelector('#teamSort').value;
      const filtered = people.filter(person => `${person.name} ${person.email} ${person.role}`.toLowerCase().includes(query) && (role === 'all' || (person.role || 'Member') === role));
      if (sort === 'workload') filtered.sort((left, right) => S.tasks.filter(task => task.assigneeId === right.id && task.status !== 'Done').length - S.tasks.filter(task => task.assigneeId === left.id && task.status !== 'Done').length);
      document.querySelector('#teamCards').innerHTML = filtered.map(person => {
        const assigned = S.tasks.filter(task => task.assigneeId === person.id);
        const completed = assigned.filter(task => task.status === 'Done').length;
        const activity = S.activities.find(item => item.actorId === person.id);
        return `<button class="team-member-card" data-member-id="${escapeHtml(person.id)}"><span class="team-avatar">${escapeHtml(initials(person.name))}</span><span class="team-member-heading"><b>${escapeHtml(person.name)}</b><small>${escapeHtml(person.role || 'Member')}</small></span><span class="team-member-access">${person.access === 'admin' ? 'Admin' : 'Member'}</span><span class="team-workload"><b>${assigned.length}</b><small>assigned</small></span><span class="team-workload"><b>${completed}</b><small>complete</small></span><span class="team-recent">${activity ? `Recent: ${escapeHtml(activity.action)} ${escapeHtml(activity.target)}` : 'No activity recorded yet'}</span></button>`;
      }).join('') || '<div class="team-empty"><b>No team members match</b><p>Try another name or role.</p></div>';
      document.querySelectorAll('#teamCards [data-member-id]').forEach(button => button.addEventListener('click', () => openMember(button.dataset.memberId)));
    };
    document.querySelector('#teamSearch').addEventListener('input', drawCards);
    document.querySelector('#teamRoleFilter').addEventListener('change', drawCards);
    document.querySelector('#teamSort').addEventListener('change', drawCards);
    drawCards();
  };

  window.calendar = function renderCalendar() {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const monthDays = new Date(year, month + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const cellCount = Math.ceil((startOffset + monthDays) / 7) * 7;
    const today = new Date().toISOString().slice(0, 10);
    const tasks = S.tasks || [];
    const projects = S.projects || [];
    const events = [
      ...tasks.filter(task => task.dueDate).map(task => ({ id: task.id, title: task.title, date: task.dueDate, type: 'task', detail: `${task.status} · ${task.priority}` })),
      ...projects.filter(project => project.deadline).map(project => ({ id: project.id, title: project.name, date: project.deadline, type: 'project', detail: 'Project deadline' }))
    ];
    const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}-`;
    const monthEvents = events.filter(event => event.date.startsWith(monthPrefix));
    const upcoming = events.filter(event => event.date >= today).sort((left, right) => left.date.localeCompare(right.date)).slice(0, 8);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const cells = Array.from({ length: cellCount }, (_, index) => {
      const day = index - startOffset + 1;
      if (day < 1 || day > monthDays) return '<div class="month-day outside" aria-hidden="true"></div>';
      const date = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = monthEvents.filter(event => event.date === date);
      return `<div class="month-day ${date === today ? 'today' : ''}"><span class="month-day-number">${day}</span>${dayEvents.map(event => `<button class="month-event ${event.type}" data-calendar-kind="${event.type}" data-calendar-id="${escapeHtml(event.id)}" title="${escapeHtml(`${event.title} · ${event.detail}`)}"><i></i><span>${escapeHtml(event.title)}</span></button>`).join('')}</div>`;
    }).join('');
    document.querySelector('#calendar').innerHTML = `<div class="calendar-page-head"><div><span class="dashboard-kicker">NEXORA / PLANNING</span><h1>Calendar</h1><p>Task and project deadlines from your workspace.</p></div><div class="calendar-controls"><button id="calendarToday">Today</button><button id="calendarPrevious" aria-label="Previous month">←</button><button id="calendarNext" aria-label="Next month">→</button></div></div><div class="calendar-month-label">${calendarMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</div><div class="calendar-layout"><section class="month-calendar"><div class="month-weekdays">${days.map(day => `<span>${day}</span>`).join('')}</div><div class="month-grid">${cells}</div></section><aside class="upcoming-panel"><span class="dashboard-kicker">NEXT ON THE CALENDAR</span><h2>Upcoming deadlines</h2>${upcoming.map(event => `<button class="upcoming-event" data-calendar-kind="${event.type}" data-calendar-id="${escapeHtml(event.id)}"><span class="upcoming-date"><b>${new Date(`${event.date}T00:00:00`).getDate()}</b><small>${new Date(`${event.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</small></span><span><b>${escapeHtml(event.title)}</b><small>${event.type === 'task' ? escapeHtml(event.detail) : 'Project deadline'}</small></span></button>`).join('') || '<div class="calendar-empty"><b>No upcoming deadlines</b><p>New due dates will appear here.</p></div>'}</aside></div>`;
    document.querySelector('#calendarPrevious').addEventListener('click', () => { calendarMonth = new Date(year, month - 1, 1); renderCalendar(); });
    document.querySelector('#calendarNext').addEventListener('click', () => { calendarMonth = new Date(year, month + 1, 1); renderCalendar(); });
    document.querySelector('#calendarToday').addEventListener('click', () => { calendarMonth = new Date(); calendarMonth.setDate(1); renderCalendar(); });
    document.querySelectorAll('#calendar [data-calendar-kind]').forEach(button => button.addEventListener('click', () => {
      if (button.dataset.calendarKind === 'task') return window.taskDrawer(button.dataset.calendarId);
      window.show('projects');
      document.querySelector(`#projects [data-open-project="${CSS.escape(button.dataset.calendarId)}"]`)?.click();
    }));
  };

  const baseFilesRenderer = window.files;
  window.files = function renderFiles() {
    baseFilesRenderer();
    const target = document.querySelector('#files');
    const files = S.files || [];
    const search = document.createElement('label');
    search.className = 'user-file-search';
    search.innerHTML = '<span aria-hidden="true">⌕</span><input id="userFileSearch" type="search" placeholder="Search workspace files" aria-label="Search workspace files">';
    const filter = document.createElement('select');
    filter.id = 'userFileProjectFilter';
    filter.setAttribute('aria-label', 'Filter files by project');
    filter.innerHTML = `<option value="all">All projects</option>${(S.projects || []).map(project => `<option value="${escapeHtml(project.id)}">${escapeHtml(project.name)}</option>`).join('')}`;
    const controls = document.createElement('div');
    controls.className = 'user-file-controls';
    controls.append(search, filter);
    target.querySelector('.panel')?.before(controls);
    const rows = [...target.querySelectorAll('.file-row')];
    rows.forEach((row, index) => {
      const file = files[index];
      if (!file) return;
      row.dataset.fileProject = file.projectId || '';
      row.dataset.fileText = `${file.name} ${file.type || ''} ${user(file.ownerId).name}`.toLowerCase();
    });
    const applyFilters = () => {
      const query = $('#userFileSearch').value.trim().toLowerCase();
      const projectId = $('#userFileProjectFilter').value;
      rows.forEach(row => { row.hidden = Boolean((query && !row.dataset.fileText.includes(query)) || (projectId !== 'all' && row.dataset.fileProject !== projectId)); });
    };
    $('#userFileSearch').addEventListener('input', applyFilters);
    filter.addEventListener('change', applyFilters);
  };

  window.activity = function renderActivity() {
    const filterOptions = [['all', 'All activity'], ['task', 'Tasks'], ['project', 'Projects'], ['file', 'Files'], ['comment', 'Comments'], ['account', 'Accounts']];
    const activities = S.activities || [];
    document.querySelector('#activity').innerHTML = `<div class="user-page-heading"><div><span class="user-kicker">NEXORA / AUDIT TRAIL</span><h1>Activity</h1><p>Changes recorded across your workspace.</p></div><label class="activity-filter">Filter<select id="userActivityFilter">${filterOptions.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label></div><section id="userActivityRows" class="user-activity-list">${activities.map(item => `<article class="user-activity-row" data-activity-action="${escapeHtml(item.action.toLowerCase())}"><span class="workload-avatar">${escapeHtml(initials(user(item.actorId).name))}</span><div><b>${escapeHtml(user(item.actorId).name)} ${escapeHtml(item.action)}</b><p>${escapeHtml(item.target)}</p></div><time>${new Date(item.at).toLocaleString()}</time></article>`).join('') || '<div class="user-empty-state"><span>✓</span><b>No activity yet</b><p>Workspace changes will appear here.</p></div>'}</section>`;
    $('#userActivityFilter').addEventListener('change', event => {
      const type = event.currentTarget.value;
      document.querySelectorAll('[data-activity-action]').forEach(row => { row.hidden = type !== 'all' && !row.dataset.activityAction.includes(type); });
    });
  };

  function openMember(memberId) {
    const person = S.users.find(user => user.id === memberId);
    if (!person) return;
    const tasks = S.tasks.filter(task => task.assigneeId === memberId);
    const completed = tasks.filter(task => task.status === 'Done').length;
    const recent = S.activities.filter(activity => activity.actorId === memberId).slice(0, 3);
    window.modal('projectModal', `<div class="dialog team-profile-dialog"><button class="close" aria-label="Close member profile">×</button><div class="team-profile-top"><span class="team-avatar large">${escapeHtml(initials(person.name))}</span><div><span class="dashboard-kicker">WORKSPACE MEMBER</span><h2>${escapeHtml(person.name)}</h2><p>${escapeHtml(person.role || 'Member')} · ${escapeHtml(person.email)}</p></div></div><div class="team-profile-metrics"><span><b>${tasks.length}</b><small>Assigned</small></span><span><b>${completed}</b><small>Completed</small></span><span><b>${tasks.length - completed}</b><small>Open</small></span></div><h3>Assigned tasks</h3><div class="team-profile-tasks">${tasks.map(task => `<button data-member-task="${escapeHtml(task.id)}"><span class="task-status-dot ${task.status === 'Done' ? 'done' : ''}"></span><span><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.status)} · ${escapeHtml(task.priority)} priority</small></span><i aria-hidden="true">→</i></button>`).join('') || '<p class="project-detail-empty">No tasks are currently assigned.</p>'}</div><h3>Recent activity</h3><div class="team-profile-activity">${recent.map(activity => `<p><b>${escapeHtml(activity.action)}</b> ${escapeHtml(activity.target)}<small>${new Date(activity.at).toLocaleString()}</small></p>`).join('') || '<p class="project-detail-empty">No activity recorded yet.</p>'}</div></div>`);
    document.querySelectorAll('#projectModal [data-member-task]').forEach(button => button.addEventListener('click', () => { document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden')); window.taskDrawer(button.dataset.memberTask); }));
  }
})();
