(() => {
  const $ = selector => document.querySelector(selector);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const initials = name => String(name || '?').split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  const request = async (url, options = {}) => {
    const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  };

  const app = $('#app');
  let workspaceEvents = null;
  const loginForm = $('#login');
  loginForm.elements.email.value = 'priya@nexora.local';
  $('#auth .eyebrow').textContent = 'MEMBER WORKSPACE SIGN IN';
  $('#auth .hint').textContent = 'Member demo: priya@nexora.local / NexoraDemo26!';
  const adminLink = document.createElement('a');
  adminLink.className = 'user-admin-link';
  adminLink.href = '/admin.html';
  adminLink.textContent = 'Administrator sign-in';
  loginForm.append(adminLink);
  const registerToggle = document.createElement('button');
  registerToggle.type = 'button';
  registerToggle.className = 'user-register-toggle';
  registerToggle.textContent = 'Create a member account';
  loginForm.append(registerToggle);
  const registrationForm = document.createElement('form');
  registrationForm.id = 'registerForm';
  registrationForm.className = 'user-register-form';
  registrationForm.hidden = true;
  registrationForm.innerHTML = '<p class="user-register-kicker">NEW TO NEXORA</p><h2>Create your workspace account</h2><label>Full name<input name="name" autocomplete="name" minlength="2" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Password<input name="password" type="password" autocomplete="new-password" minlength="8" required></label><label>Confirm password<input name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required></label><p class="user-register-error" role="alert"></p><button class="user-register-submit" type="submit">Create account</button><button class="user-register-back" type="button">Back to sign in</button>';
  loginForm.after(registrationForm);
  registerToggle.addEventListener('click', () => {
    loginForm.hidden = true;
    registrationForm.hidden = false;
    registrationForm.elements.name.focus();
  });
  registrationForm.querySelector('.user-register-back').addEventListener('click', () => {
    registrationForm.hidden = true;
    loginForm.hidden = false;
    loginForm.elements.email.focus();
  });
  registrationForm.addEventListener('submit', async event => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(registrationForm));
    if (values.password !== values.confirmPassword) {
      registrationForm.querySelector('.user-register-error').textContent = 'Passwords do not match.';
      return;
    }
    const submit = registrationForm.querySelector('.user-register-submit');
    submit.disabled = true;
    submit.textContent = 'Creating account…';
    registrationForm.querySelector('.user-register-error').textContent = '';
    try {
      await request('/api/auth/register', { method: 'POST', body: JSON.stringify(values) });
      $('#auth').hidden = true;
      app.hidden = false;
      await load();
      realtime();
    } catch (error) {
      registrationForm.querySelector('.user-register-error').textContent = error.message;
    } finally {
      submit.disabled = false;
      submit.textContent = 'Create account';
    }
  });
  const loginPassword = loginForm.querySelector('input[name="password"]');
  const loginPasswordToggle = document.createElement('button');
  loginPasswordToggle.type = 'button';
  loginPasswordToggle.className = 'user-password-toggle';
  loginPasswordToggle.textContent = 'Show';
  loginPassword.after(loginPasswordToggle);
  loginPasswordToggle.addEventListener('click', () => {
    const showing = loginPassword.type === 'password';
    loginPassword.type = showing ? 'text' : 'password';
    loginPasswordToggle.textContent = showing ? 'Hide' : 'Show';
  });
  const loginSubmit = [...loginForm.querySelectorAll('button')].find(button => button.type === 'submit');
  const loginSubmitMarkup = loginSubmit.innerHTML;
  const existingLoginHandler = loginForm.onsubmit;
  loginForm.onsubmit = async event => {
    loginSubmit.disabled = true;
    loginSubmit.textContent = 'Opening workspace…';
    try {
      await existingLoginHandler.call(loginForm, event);
    } finally {
      loginSubmit.disabled = false;
      loginSubmit.innerHTML = loginSubmitMarkup;
    }
  };
  const accountNav = document.createElement('button');
  accountNav.dataset.page = 'account';
  accountNav.innerHTML = '♙ <span>My Account</span>';
  document.querySelector('nav').append(accountNav);

  const accountPage = document.createElement('section');
  accountPage.id = 'account';
  accountPage.className = 'page';
  document.querySelector('main').append(accountPage);

  function openAccount() {
    document.querySelectorAll('.page').forEach(page => page.classList.toggle('active', page.id === 'account'));
    document.querySelectorAll('nav button').forEach(button => button.classList.toggle('active', button === accountNav));
    $('aside').classList.remove('open');
    renderAccount();
  }

  accountNav.addEventListener('click', openAccount);

  async function syncRole() {
    if (app.hidden) {
      workspaceEvents?.close();
      workspaceEvents = null;
      return;
    }
    try {
      const { user, state } = await request('/api/me');
      const workspace = document.querySelector('.workspace');
      if (workspace && state.workspace?.name) {
        let label = workspace.querySelector('.workspace-label');
        if (!label) {
          label = document.createElement('span');
          label.className = 'workspace-label';
          workspace.firstChild.textContent = '◈ ';
          workspace.insertBefore(label, workspace.querySelector('small'));
        }
        label.textContent = state.workspace.name;
      }
      if (!workspaceEvents) {
        workspaceEvents = new EventSource('/api/events');
        workspaceEvents.addEventListener('workspace.updated', async () => {
          try {
            const { state: updated } = await request('/api/me');
            const label = document.querySelector('.workspace-label');
            if (label && updated.workspace?.name) label.textContent = updated.workspace.name;
          } catch {
            return;
          }
        });
      }
      if (user.access === 'admin' && window.location.pathname !== '/admin.html') window.location.replace('/admin.html');
    } catch {
      return;
    }
  }

  new MutationObserver(syncRole).observe(app, { attributes: true, attributeFilter: ['hidden'] });
  syncRole();

  async function renderAccount(message = '', isError = false) {
    accountPage.innerHTML = '<div class="panel-loading">Loading your account…</div>';
    try {
      const { user, state } = await request('/api/me');
      const tasks = state.tasks.filter(task => task.assigneeId === user.id);
      const completed = tasks.filter(task => task.status === 'Done').length;
      const active = tasks.filter(task => task.status !== 'Done').length;
      accountPage.innerHTML = `
        <div class="user-page-heading"><div><span class="user-kicker">NEXORA / PERSONAL WORKSPACE</span><h1>My account</h1><p>Your profile, assignments, and sign-in details.</p></div></div>
        ${message ? `<p class="user-feedback ${isError ? 'error' : ''}" role="status">${escapeHtml(message)}</p>` : ''}
        <section class="user-profile-banner"><span class="user-large-avatar">${escapeHtml(initials(user.name))}</span><div class="user-profile-copy"><span class="user-kicker">WORKSPACE MEMBER</span><h2>${escapeHtml(user.name)}</h2><p>${escapeHtml(user.email)} <span>·</span> ${escapeHtml(user.role || 'Member')}</p></div><span class="user-access-chip">${user.access === 'admin' ? 'Administrator' : 'Member'}</span></section>
        <div class="user-metric-grid"><article class="user-metric"><span>Assigned to me</span><strong>${tasks.length}</strong><small>Tasks across the workspace</small></article><article class="user-metric metric-accent"><span>In progress</span><strong>${active}</strong><small>Still needing your attention</small></article><article class="user-metric"><span>Completed</span><strong>${completed}</strong><small>${tasks.length ? `${Math.round(completed / tasks.length * 100)}% of your assignments` : 'Ready when work is assigned'}</small></article></div>
        <div class="user-account-grid"><section class="user-panel"><div class="user-panel-heading"><div><span class="user-kicker">YOUR DETAILS</span><h2>Profile & security</h2></div><span class="panel-mark">01</span></div><p class="user-panel-copy">Update your name or change your password. Your email is managed by your workspace administrator.</p><form id="accountProfile" class="user-form">
          <label>Display name<input name="name" value="${escapeHtml(user.name)}" required minlength="2"></label>
          <label>Email address<input value="${escapeHtml(user.email)}" readonly></label>
          <div class="password-heading"><span class="user-kicker">CHANGE PASSWORD</span><small>Leave these fields blank to keep your current password.</small></div>
          <label>Current password<input name="currentPassword" type="password" autocomplete="current-password"></label>
          <label>New password<input name="newPassword" type="password" minlength="8" autocomplete="new-password"></label>
          <label>Confirm new password<input name="confirmPassword" type="password" minlength="8" autocomplete="new-password"></label>
          <button class="user-save-button">Save profile <span aria-hidden="true">→</span></button>
        </form></section><section class="user-panel user-task-panel"><div class="user-panel-heading"><div><span class="user-kicker">PERSONAL QUEUE</span><h2>My assignments</h2></div><span class="panel-mark">02</span></div><p class="user-panel-copy">Work currently assigned to your account.</p><div class="user-task-list">${tasks.length ? tasks.map(task => `<article class="user-task-row"><span class="task-status-dot ${task.status === 'Done' ? 'done' : ''}"></span><div><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.status)} · ${escapeHtml(task.priority)} priority</small></div><time>${escapeHtml(task.dueDate || 'No due date')}</time></article>`).join('') : '<div class="user-empty-state"><span>✓</span><b>You’re all caught up</b><p>New assignments will appear here.</p></div>'}</div></section></div>`;

      $('#accountProfile').addEventListener('submit', async event => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const newPassword = String(form.get('newPassword') || '');
        if (newPassword !== String(form.get('confirmPassword') || '')) return renderAccount('New password and confirmation do not match.', true);
        try {
          await request('/api/account', { method: 'PATCH', body: JSON.stringify({ name: form.get('name'), currentPassword: form.get('currentPassword'), newPassword }) });
          renderAccount('Profile saved.');
        } catch (error) {
          renderAccount(error.message, true);
        }
      });
    } catch (error) {
      accountPage.innerHTML = `<section class="user-panel"><p class="user-feedback error">${escapeHtml(error.message)}</p></section>`;
    }
  }
})();
