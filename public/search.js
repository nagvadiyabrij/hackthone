(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const closeSearch = () => document.querySelectorAll('.modal').forEach(modal => modal.classList.add('hidden'));
  const input = $('#search');
  if (!input) return;

  input.oninput = () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2 || !S?.users) {
      closeSearch();
      return;
    }
    const matches = [
      { type: 'Projects', kind: 'project', items: (S.projects || []).filter(item => `${item.name} ${item.description}`.toLowerCase().includes(query)).slice(0, 4), label: item => item.name, detail: item => item.description || 'Workspace project' },
      { type: 'Tasks', kind: 'task', items: (S.tasks || []).filter(item => `${item.title} ${item.description}`.toLowerCase().includes(query)).slice(0, 5), label: item => item.title, detail: item => `${item.status} · ${item.priority}` },
      { type: 'People', kind: 'person', items: (S.users || []).filter(item => `${item.name} ${item.email} ${item.role}`.toLowerCase().includes(query)).slice(0, 4), label: item => item.name, detail: item => `${item.role} · ${item.email}` },
      { type: 'Files', kind: 'file', items: (S.files || []).filter(item => `${item.name} ${item.type}`.toLowerCase().includes(query)).slice(0, 4), label: item => item.name, detail: item => `${item.type || 'File'} · ${Math.max(1, Math.round(item.size / 1024))} KB` },
      { type: 'Activity', kind: 'activity', items: (S.activities || []).filter(item => `${item.action} ${item.target} ${user(item.actorId).name}`.toLowerCase().includes(query)).slice(0, 4), label: item => `${user(item.actorId).name} ${item.action}`, detail: item => `${item.target} · ${new Date(item.at).toLocaleString()}` }
    ].filter(group => group.items.length);
    const total = matches.reduce((count, group) => count + group.items.length, 0);
    const markup = matches.map(group => `<section class="search-group"><h3>${group.type}</h3>${group.items.map(item => `<button data-result-kind="${group.kind}" data-result-id="${escapeHtml(item.id)}"><b>${escapeHtml(group.label(item))}</b><small>${escapeHtml(group.detail(item))}</small></button>`).join('')}</section>`).join('') || '<div class="search-empty"><b>No matches</b><span>Try another name, task, or file.</span></div>';
    window.modal('palette', `<div class="dialog global-search-dialog"><button class="close" aria-label="Close search">×</button><span class="dashboard-kicker">NEXORA / SEARCH</span><h2>Search results <small>${total} found</small></h2><div class="global-search-results">${markup}</div></div>`);
    $('#palette').querySelectorAll('[data-result-kind]').forEach(button => button.addEventListener('click', () => {
      const { resultKind, resultId } = button.dataset;
      closeSearch();
      if (resultKind === 'task') return window.taskDrawer(resultId);
      if (resultKind === 'file') return window.location.assign(`/api/files/${encodeURIComponent(resultId)}/download`);
      if (resultKind === 'activity') return window.show('activity');
      if (resultKind === 'person') {
        window.show('team');
        document.querySelector(`[data-member-id="${CSS.escape(resultId)}"]`)?.click();
        return;
      }
      if (resultKind === 'project') {
        window.show('projects');
        document.querySelector(`[data-open-project="${CSS.escape(resultId)}"]`)?.click();
      }
    }));
  };
})();
