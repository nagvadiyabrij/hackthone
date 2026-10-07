(() => {
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const avatarLetters = person => String(person?.name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const localDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No date';

  window.home = function renderDashboard() {
    const tasks = S.tasks || [];
    const projects = S.projects || [];
    const files = S.files || [];
    const people = S.users || [];
    const activities = S.activities || [];
    const today = new Date().toISOString().slice(0, 10);
    const done = tasks.filter(task => task.status === 'Done').length;
    const active = tasks.filter(task => task.status !== 'Done').length;
    const overdue = tasks.filter(task => task.dueDate && task.dueDate < today && task.status !== 'Done');
    const productivity = tasks.length ? Math.round(done / tasks.length * 100) : 0;
    const upcoming = tasks.filter(task => task.dueDate && task.dueDate >= today && task.status !== 'Done').sort((left, right) => left.dueDate.localeCompare(right.dueDate)).slice(0, 4);
    const userById = new Map(people.map(person => [person.id, person]));
    const activityText = activities[0] ? `${userById.get(activities[0].actorId)?.name || 'A teammate'} ${activities[0].action} ${activities[0].target}` : 'Your workspace is ready for its first update.';

    document.querySelector('#home').innerHTML = `
      <section class="dashboard-hero">
        <div class="dashboard-hero-copy"><span class="dashboard-kicker">NEXORA / WORKSPACE PULSE</span><h1>Move work forward.<br><em>Together.</em></h1><p>Projects, tasks, people, and files, connected in one living workspace.</p><button class="dashboard-create" id="createTask">Create a task <span aria-hidden="true">+</span></button></div>
        <div class="pulse-module"><div class="pulse-ring" style="--pulse:${productivity}%"><span><b>${productivity}%</b><small>complete</small></span></div><div class="pulse-caption"><i></i><span><b>Workspace pulse</b><small>${people.length} teammates · ${active} active tasks</small></span></div><p class="pulse-latest">LATEST · ${escapeHtml(activityText)}</p></div>
      </section>
      <section class="dashboard-kpis" aria-label="Workspace summary">
        <article class="dashboard-kpi"><span class="kpi-icon blue">▣</span><small>PROJECTS</small><strong>${projects.length}</strong><span>${projects.length === 1 ? 'One shared initiative' : 'Across the workspace'}</span></article>
        <article class="dashboard-kpi"><span class="kpi-icon coral">↗</span><small>ACTIVE TASKS</small><strong>${active}</strong><span>${overdue.length ? `${overdue.length} need deadline attention` : 'No overdue work'}</span></article>
        <article class="dashboard-kpi"><span class="kpi-icon green">✓</span><small>COMPLETED</small><strong>${done}</strong><span>${productivity}% of tracked work</span></article>
        <article class="dashboard-kpi"><span class="kpi-icon gold">♙</span><small>TEAM MEMBERS</small><strong>${people.length}</strong><span>People in ${escapeHtml(S.workspace?.name || 'your workspace')}</span></article>
        <article class="dashboard-kpi"><span class="kpi-icon blue">⇧</span><small>FILES</small><strong>${files.length}</strong><span>Shared workspace files</span></article>
        <article class="dashboard-kpi"><span class="kpi-icon coral">◷</span><small>UPCOMING</small><strong>${upcoming.length}</strong><span>Open deadlines ahead</span></article>
      </section>
      <section class="dashboard-lower-grid">
        <div class="dashboard-panel project-pulse-panel"><div class="dashboard-section-head"><div><span class="dashboard-kicker">PORTFOLIO</span><h2>Project health</h2></div><button class="dashboard-link" data-go="projects">All projects <span aria-hidden="true">→</span></button></div>
          ${projects.length ? projects.map(project => { const group = tasks.filter(task => task.projectId === project.id); const complete = group.filter(task => task.status === 'Done').length; const late = group.some(task => task.dueDate && task.dueDate < today && task.status !== 'Done'); const progress = group.length ? Math.round(complete / group.length * 100) : 0; const state = late ? 'At risk' : group.length && complete === group.length ? 'Healthy' : 'In progress'; return `<button class="project-pulse-row" data-go="projects"><span class="project-glyph">▣</span><span class="project-pulse-copy"><b>${escapeHtml(project.name)}</b><small>${complete} of ${group.length} tasks complete · Due ${escapeHtml(localDate(project.deadline))}</small><i class="project-pulse-bar"><u style="width:${progress}%"></u></i></span><span class="project-health ${late ? 'late' : ''}">${state}</span></button>`; }).join('') : '<div class="dashboard-empty"><b>No projects yet</b><p>Create a project to start organizing shared work.</p><button class="dashboard-link" data-go="projects">Open projects →</button></div>'}
        </div>
        <div class="dashboard-panel deadline-panel"><div class="dashboard-section-head"><div><span class="dashboard-kicker">COMING UP</span><h2>Deadline queue</h2></div><button class="dashboard-link" data-go="calendar">Calendar <span aria-hidden="true">→</span></button></div>
          ${upcoming.length ? upcoming.map(task => `<button class="deadline-row" data-task-open="${escapeHtml(task.id)}"><span class="deadline-date"><b>${new Date(`${task.dueDate}T00:00:00`).getDate()}</b><small>${new Date(`${task.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}</small></span><span class="deadline-copy"><b>${escapeHtml(task.title)}</b><small>${escapeHtml(projects.find(project => project.id === task.projectId)?.name || 'Workspace task')}</small></span><span class="deadline-priority ${escapeHtml(task.priority.toLowerCase())}">${escapeHtml(task.priority)}</span></button>`).join('') : '<div class="dashboard-empty"><b>Nothing due soon</b><p>New task deadlines will appear here.</p></div>'}
        </div>
        <div class="dashboard-panel workload-panel"><div class="dashboard-section-head"><div><span class="dashboard-kicker">TEAM CAPACITY</span><h2>Workload at a glance</h2></div><button class="dashboard-link" data-go="team">Meet the team <span aria-hidden="true">→</span></button></div>
          ${people.slice(0, 5).map(person => { const assigned = tasks.filter(task => task.assigneeId === person.id); const ratio = tasks.length ? Math.round(assigned.length / Math.max(1, Math.ceil(tasks.length / Math.max(1, people.length))) * 100) : 0; return `<div class="workload-row"><span class="workload-avatar">${escapeHtml(avatarLetters(person))}</span><span class="workload-person"><b>${escapeHtml(person.name)}</b><small>${assigned.length} assigned · ${assigned.filter(task => task.status === 'Done').length} complete</small></span><span class="workload-meter"><i style="width:${Math.min(ratio, 100)}%"></i></span></div>`; }).join('') || '<div class="dashboard-empty"><b>Your team appears here</b><p>Invite workspace members to see team workload.</p></div>'}
        </div>
        <div class="dashboard-panel activity-pulse-panel"><div class="dashboard-section-head"><div><span class="dashboard-kicker">LIVE ACTIVITY</span><h2>Recent movement</h2></div><button class="dashboard-link" data-go="activity">Activity log <span aria-hidden="true">→</span></button></div>
          ${activities.slice(0, 5).map(item => { const person = userById.get(item.actorId); return `<div class="activity-pulse-row"><span class="workload-avatar">${escapeHtml(avatarLetters(person || { name: 'N' }))}</span><span class="activity-pulse-copy"><b>${escapeHtml(person?.name || 'Workspace member')} ${escapeHtml(item.action)}</b><small>${escapeHtml(item.target)} · ${new Date(item.at).toLocaleString()}</small></span></div>`; }).join('') || '<div class="dashboard-empty"><b>Your activity appears here</b><p>Changes made by the team are recorded in this timeline.</p></div>'}
        </div>
      </section>`;

    document.querySelector('#createTask').addEventListener('click', () => window.taskForm());
    document.querySelectorAll('#home [data-go]').forEach(button => button.addEventListener('click', () => window.show(button.dataset.go)));
    document.querySelectorAll('#home [data-task-open]').forEach(button => button.addEventListener('click', () => window.taskDrawer(button.dataset.taskOpen)));
  };

  window.projects = function renderProjects() {
    const projects = S.projects || [];
    const tasks = S.tasks || [];
    const today = new Date().toISOString().slice(0, 10);
    document.querySelector('#projects').innerHTML = `<div class="projects-page-head"><div><span class="dashboard-kicker">NEXORA / PORTFOLIO</span><h1>Projects</h1><p>Shared goals with progress calculated from real workspace tasks.</p></div><button class="dashboard-create" id="openProjectCreate">Create a project <span aria-hidden="true">+</span></button></div><section class="user-project-grid">${projects.map(project => { const group = tasks.filter(task => task.projectId === project.id); const complete = group.filter(task => task.status === 'Done').length; const late = group.some(task => task.dueDate && task.dueDate < today && task.status !== 'Done'); const progress = group.length ? Math.round(complete / group.length * 100) : 0; return `<button class="user-project-card" data-open-project="${escapeHtml(project.id)}"><span class="user-project-card-top"><span class="user-project-mark">▣</span><span class="project-health ${late ? 'late' : ''}">${late ? 'At risk' : group.length && progress === 100 ? 'Healthy' : 'In progress'}</span></span><b>${escapeHtml(project.name)}</b><p>${escapeHtml(project.description || 'No project description yet.')}</p><span class="user-project-progress"><i style="width:${progress}%"></i></span><span class="user-project-meta"><span>${complete} / ${group.length} tasks complete</span><span>Due ${escapeHtml(localDate(project.deadline))}</span></span><span class="user-project-open">Open project <i aria-hidden="true">→</i></span></button>`; }).join('') || '<div class="user-project-empty"><b>No projects yet</b><p>Create your first project and start moving work forward.</p><button class="dashboard-create" id="openProjectCreateEmpty">Create a project <span aria-hidden="true">+</span></button></div>'}</section>`;
    document.querySelector('#openProjectCreate')?.addEventListener('click', () => window.projectForm());
    document.querySelector('#openProjectCreateEmpty')?.addEventListener('click', () => window.projectForm());
    document.querySelectorAll('#projects [data-open-project]').forEach(button => button.addEventListener('click', () => openProject(button.dataset.openProject)));
  };

  function openProject(projectId) {
    const project = S.projects.find(item => item.id === projectId);
    if (!project) return;
    const tasks = S.tasks.filter(task => task.projectId === projectId);
    const complete = tasks.filter(task => task.status === 'Done').length;
    const progress = tasks.length ? Math.round(complete / tasks.length * 100) : 0;
    window.modal('projectModal', `<div class="dialog project-detail-dialog"><button class="close" aria-label="Close project details">×</button><span class="dashboard-kicker">PROJECT / ${escapeHtml(project.deadline ? `DUE ${localDate(project.deadline)}` : 'NO DEADLINE')}</span><h2>${escapeHtml(project.name)}</h2><p class="project-detail-description">${escapeHtml(project.description || 'No description provided.')}</p><div class="project-detail-progress"><div><b>${progress}%</b><span>Complete</span></div><i><u style="width:${progress}%"></u></i></div><div class="project-detail-heading"><h3>Project tasks</h3><span>${complete} of ${tasks.length} done</span></div><div class="project-detail-tasks">${tasks.map(task => `<button data-project-task="${escapeHtml(task.id)}"><span class="task-status-dot ${task.status === 'Done' ? 'done' : ''}"></span><span><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.status)} · ${escapeHtml(task.priority)} priority</small></span><i aria-hidden="true">→</i></button>`).join('') || '<p class="project-detail-empty">No tasks have been added to this project.</p>'}</div><button class="dashboard-link" id="openProjectBoard">Open task board →</button></div>`);
    document.querySelectorAll('#projectModal [data-project-task]').forEach(button => button.addEventListener('click', () => { window.close(); window.taskDrawer(button.dataset.projectTask); }));
    document.querySelector('#openProjectBoard').addEventListener('click', () => { window.close(); window.show('tasks'); });
  }
})();
