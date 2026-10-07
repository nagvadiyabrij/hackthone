const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

test('account and admin routes enforce access and support user management', { timeout: 20000 }, async t => {
  const root = path.resolve(__dirname, '..');
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexora-admin-test-'));
  fs.copyFileSync(path.join(root, 'server.js'), path.join(temporaryRoot, 'server.js'));
  fs.copyFileSync(path.join(root, 'admin.js'), path.join(temporaryRoot, 'admin.js'));
  fs.cpSync(path.join(root, 'public'), path.join(temporaryRoot, 'public'), { recursive: true });
  fs.cpSync(path.join(root, 'data'), path.join(temporaryRoot, 'data'), { recursive: true });

  const port = await unusedPort();
  const child = spawn(process.execPath, ['server.js'], {
    cwd: temporaryRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', chunk => { output += chunk; });
  child.stderr.on('data', chunk => { output += chunk; });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      await fetch(base);
      ready = true;
      break;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }
  assert.equal(ready, true, `temporary server did not start: ${output}`);

  async function call(url, { method = 'GET', body, cookie } = {}) {
    const response = await fetch(`${base}${url}`, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    return { response, data: await response.json() };
  }

  const registration = await call('/api/auth/register', {
    method: 'POST',
    body: { name: 'New Member', email: 'new-member@nexora.local', password: 'MemberTest26!' }
  });
  assert.equal(registration.response.status, 201);
  assert.equal(registration.data.user.role, 'Member');
  const registrationCookie = registration.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/me', { cookie: registrationCookie })).data.user.access, 'user');

  const adminLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: 'alex@nexora.local', password: 'NexoraDemo26!' }
  });
  assert.equal(adminLogin.response.status, 200);
  const adminCookie = adminLogin.response.headers.get('set-cookie').split(';')[0];

  const listing = await call('/api/admin/users', { cookie: adminCookie });
  assert.equal(listing.response.status, 200);
  assert.equal(listing.data.users.find(user => user.id === 'alex').access, 'admin');
  assert.equal('hash' in listing.data.users[0], false);
  const workspaceUpdate = await call('/api/admin/workspace', {
    method: 'PATCH', cookie: adminCookie, body: { name: 'Test Workspace' }
  });
  assert.equal(workspaceUpdate.response.status, 200);
  assert.equal(workspaceUpdate.data.workspace.name, 'Test Workspace');
  const projectCreate = await call('/api/projects', {
    method: 'POST', cookie: adminCookie, body: { name: 'Admin Test Project', description: 'Created through the workspace API.' }
  });
  assert.equal(projectCreate.response.status, 201);
  const adminState = await call('/api/me', { cookie: adminCookie });
  const existingTask = adminState.data.state.tasks[0];
  const taskUpdate = await call(`/api/tasks/${existingTask.id}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { revision: existingTask.revision, status: 'Review', priority: existingTask.priority }
  });
  assert.equal(taskUpdate.response.status, 200);
  assert.equal(taskUpdate.data.revision, existingTask.revision + 1);
  assert.equal((await call(`/api/tasks/${existingTask.id}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { revision: existingTask.revision, status: 'Done' }
  })).response.status, 409);
  assert.equal((await call('/api/admin/users', { method: 'POST', cookie: adminCookie, body: {
    name: 'Duplicate', email: 'alex@nexora.local', password: 'PanelTest26!'
  } })).response.status, 409);

  const created = await call('/api/admin/users', {
    method: 'POST', cookie: adminCookie,
    body: { name: 'Panel Test', email: 'panel-test@nexora.local', password: 'PanelTest26!', role: 'QA', access: 'user' }
  });
  assert.equal(created.response.status, 201);
  const accountUpdate = await call(`/api/admin/users/${created.data.user.id}`, {
    method: 'PATCH', cookie: adminCookie,
    body: { name: 'Panel Teammate', email: 'panel-user@nexora.local', role: 'Quality', access: 'user' }
  });
  assert.equal(accountUpdate.response.status, 200);
  assert.equal(accountUpdate.data.user.name, 'Panel Teammate');
  assert.equal(accountUpdate.data.user.role, 'Quality');
  const userLogin = await call('/api/auth/login', {
    method: 'POST', body: { email: 'panel-user@nexora.local', password: 'PanelTest26!' }
  });
  const userCookie = userLogin.response.headers.get('set-cookie').split(';')[0];
  const eventResponse = await fetch(`${base}/api/events`, { headers: { Cookie: userCookie } });
  assert.equal(eventResponse.status, 200);
  const eventReader = eventResponse.body.getReader();
  assert.match(new TextDecoder().decode((await eventReader.read()).value), /event: connected/);
  assert.equal((await call(`/api/admin/users/${created.data.user.id}`, { method: 'PATCH', cookie: adminCookie, body: { active: false } })).response.status, 200);
  let streamTimeout;
  const streamClose = await Promise.race([eventReader.read(), new Promise(resolve => { streamTimeout = setTimeout(() => resolve({ done: false }), 1000); })]);
  clearTimeout(streamTimeout);
  assert.equal(streamClose.done, true);
  assert.equal((await call('/api/me', { cookie: userCookie })).response.status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'panel-user@nexora.local', password: 'PanelTest26!' } })).response.status, 401);
  assert.equal((await call(`/api/admin/users/${created.data.user.id}`, { method: 'PATCH', cookie: adminCookie, body: { active: true } })).response.status, 200);
  const reactivatedLogin = await call('/api/auth/login', {
    method: 'POST', body: { email: 'panel-user@nexora.local', password: 'PanelTest26!' }
  });
  assert.equal(reactivatedLogin.response.status, 200);
  const activeUserCookie = reactivatedLogin.response.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('/api/admin/users', { cookie: activeUserCookie })).response.status, 403);
  assert.equal((await call('/api/admin/workspace', { method: 'PATCH', cookie: activeUserCookie, body: { name: 'Member Attempt' } })).response.status, 403);
  assert.equal((await call('/api/account', { method: 'PATCH', cookie: activeUserCookie, body: { name: 'Panel Tester' } })).response.status, 200);

  const userId = created.data.user.id;
  assert.equal((await call(`/api/admin/users/${userId}`, {
    method: 'PATCH', cookie: adminCookie, body: { access: 'admin' }
  })).response.status, 200);
  assert.equal((await call('/api/admin/users', { cookie: activeUserCookie })).response.status, 200);
  assert.equal((await call(`/api/admin/users/${userId}`, { method: 'PATCH', cookie: adminCookie, body: { newPassword: 'ResetPanel26!' } })).response.status, 200);
  assert.equal((await call('/api/me', { cookie: activeUserCookie })).response.status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'panel-user@nexora.local', password: 'PanelTest26!' } })).response.status, 401);
  assert.equal((await call('/api/auth/login', { method: 'POST', body: { email: 'panel-user@nexora.local', password: 'ResetPanel26!' } })).response.status, 200);
  assert.equal((await call(`/api/admin/users/${userId}`, {
    method: 'PATCH', cookie: adminCookie, body: { access: 'user' }
  })).response.status, 200);
  assert.equal((await call(`/api/admin/users/${userId}`, { method: 'DELETE', cookie: adminCookie })).response.status, 200);
  assert.equal((await call('/api/admin/users/alex', { method: 'PATCH', cookie: adminCookie, body: { access: 'user' } })).response.status, 409);
  assert.equal((await call('/api/admin/users/alex', { method: 'PATCH', cookie: adminCookie, body: { active: false } })).response.status, 409);
  assert.equal((await call('/api/admin/users/priya', { method: 'DELETE', cookie: adminCookie })).response.status, 409);
});
