const emailPattern = /^\S+@\S+\.\S+$/;

function accessOf(user) {
  return user.access || (user.id === 'alex' ? 'admin' : 'user');
}

function safeUser(user) {
  const { hash, salt, ...publicUser } = user;
  return { ...publicUser, access: accessOf(user), active: user.active !== false };
}

function passwordMatches(password, user) {
  return require('crypto').scryptSync(password, user.salt, 64).toString('hex') === user.hash;
}

module.exports = async function adminApi(req, res, pathname, context) {
  const { db, me, save, clean, id, hash, activity, emit, snapshot, sessions, json, body, sessionId, revokeUserSessions } = context;

  if (req.method === 'GET' && pathname === '/api/me') {
    const account = db.users.find(user => user.id === me);
    if (!account) return json(res, 401, { error: 'AUTH_REQUIRED' }), true;
    const state = snapshot();
    state.users = state.users.map(item => safeUser(db.users.find(user => user.id === item.id) || item));
    json(res, 200, { user: safeUser(account), state });
    return true;
  }

  if (pathname === '/api/account' && req.method === 'PATCH') {
    const account = db.users.find(user => user.id === me);
    if (!account) return json(res, 401, { error: 'AUTH_REQUIRED' }), true;
    const values = await body(req);
    const name = clean(values.name);
    if (name.length < 2) return json(res, 422, { error: 'Name must be at least 2 characters.' }), true;

    const currentPassword = clean(values.currentPassword);
    const newPassword = clean(values.newPassword);
    if (currentPassword || newPassword) {
      if (!currentPassword || !newPassword) return json(res, 422, { error: 'Enter your current and new password.' }), true;
      if (!passwordMatches(currentPassword, account)) return json(res, 401, { error: 'Current password is incorrect.' }), true;
      if (newPassword.length < 8) return json(res, 422, { error: 'New password must be at least 8 characters.' }), true;
      Object.assign(account, hash(newPassword));
      revokeUserSessions(account.id, sessionId);
    }

    account.name = name;
    activity(me, 'updated account', name);
    save();
    json(res, 200, { user: safeUser(account) });
    return true;
  }

  if (!pathname.startsWith('/api/admin/')) return false;
  const administrator = db.users.find(user => user.id === me);
  if (!administrator) return json(res, 401, { error: 'AUTH_REQUIRED' }), true;
  if (accessOf(administrator) !== 'admin') return json(res, 403, { error: 'ADMIN_REQUIRED' }), true;

  if (req.method === 'GET' && pathname === '/api/admin/users') {
    json(res, 200, { users: db.users.map(safeUser) });
    return true;
  }

  if (req.method === 'PATCH' && pathname === '/api/admin/workspace') {
    const values = await body(req);
    const name = clean(values.name).slice(0, 120);
    if (name.length < 2) return json(res, 422, { error: 'Workspace name must be at least 2 characters.' }), true;
    db.workspace.name = name;
    activity(me, 'updated workspace', name);
    save();
    emit('workspace.updated', db.workspace);
    json(res, 200, { workspace: db.workspace });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/admin/users') {
    const values = await body(req);
    const name = clean(values.name);
    const email = clean(values.email).toLowerCase();
    const password = clean(values.password);
    const access = values.access === 'admin' ? 'admin' : 'user';
    if (name.length < 2 || !emailPattern.test(email) || password.length < 8) {
      return json(res, 422, { error: 'Enter a name, valid email, and password of at least 8 characters.' }), true;
    }
    if (db.users.some(user => user.email.toLowerCase() === email)) {
      return json(res, 409, { error: 'This email is already registered.' }), true;
    }
    const account = { id: id(), name, email, role: clean(values.role) || 'Member', access, active: true, ...hash(password) };
    db.users.push(account);
    activity(me, 'created account', account.email);
    save();
    emit('user.created', safeUser(account));
    json(res, 201, { user: safeUser(account) });
    return true;
  }

  const match = pathname.match(/^\/api\/admin\/users\/([^/]+)$/);
  if (!match) return json(res, 404, { error: 'NOT_FOUND' }), true;
  const target = db.users.find(user => user.id === decodeURIComponent(match[1]));
  if (!target) return json(res, 404, { error: 'USER_NOT_FOUND' }), true;

  if (req.method === 'PATCH') {
    const values = await body(req);
    if (values.access !== undefined && !['admin', 'user'].includes(values.access)) return json(res, 422, { error: 'Access must be admin or user.' }), true;
    if (values.active !== undefined && typeof values.active !== 'boolean') return json(res, 422, { error: 'Active status must be true or false.' }), true;
    if (values.name !== undefined && clean(values.name).length < 2) return json(res, 422, { error: 'Name must be at least 2 characters.' }), true;
    if (values.email !== undefined && !emailPattern.test(clean(values.email).toLowerCase())) return json(res, 422, { error: 'Enter a valid email address.' }), true;
    if (values.email !== undefined && db.users.some(user => user.id !== target.id && user.email.toLowerCase() === clean(values.email).toLowerCase())) return json(res, 409, { error: 'This email is already registered.' }), true;
    if (values.newPassword !== undefined && clean(values.newPassword).length < 8) return json(res, 422, { error: 'The new password must be at least 8 characters.' }), true;
    const previousAccess = accessOf(target);
    const previousActive = target.active !== false;
    let updateAction = 'updated account';
    if (values.access !== undefined) {
      if (values.access !== 'admin' && accessOf(target) === 'admin' && target.active !== false && db.users.filter(user => accessOf(user) === 'admin' && user.active !== false).length <= 1) {
        return json(res, 409, { error: 'The workspace must keep at least one active admin.' }), true;
      }
      if (target.id === me && values.access !== 'admin') return json(res, 409, { error: 'You cannot remove your own admin access.' }), true;
      target.access = values.access;
      if (previousAccess !== values.access) updateAction = 'changed account access';
    }
    if (values.active !== undefined) {
      if (target.id === me && values.active === false) return json(res, 409, { error: 'You cannot suspend your own account.' }), true;
      const activeAdmins = db.users.filter(account => accessOf(account) === 'admin' && account.active !== false);
      if (values.active === false && accessOf(target) === 'admin' && activeAdmins.length <= 1) return json(res, 409, { error: 'The workspace must keep at least one active admin.' }), true;
      target.active = values.active;
      if (previousActive !== values.active) updateAction = values.active ? 'reactivated account' : 'suspended account';
      if (!target.active) revokeUserSessions(target.id);
    }
    if (values.name !== undefined) {
      const name = clean(values.name);
      target.name = name;
    }
    if (values.email !== undefined) {
      const email = clean(values.email).toLowerCase();
      target.email = email;
    }
    if (values.role !== undefined) target.role = clean(values.role) || 'Member';
    if (values.newPassword !== undefined) {
      const password = clean(values.newPassword);
      Object.assign(target, hash(password));
      updateAction = 'reset account password';
      revokeUserSessions(target.id, target.id === me ? sessionId : undefined);
    }
    activity(me, updateAction, target.email);
    save();
    emit('user.updated', safeUser(target));
    json(res, 200, { user: safeUser(target) });
    return true;
  }

  if (req.method === 'DELETE') {
    if (target.id === me) return json(res, 409, { error: 'You cannot delete your own account.' }), true;
    if (accessOf(target) === 'admin' && target.active !== false && db.users.filter(user => accessOf(user) === 'admin' && user.active !== false).length <= 1) {
      return json(res, 409, { error: 'The workspace must keep at least one active admin.' }), true;
    }
    if (db.tasks.some(task => task.assigneeId === target.id)) return json(res, 409, { error: 'Reassign this user’s tasks before deleting the account.' }), true;
    db.users = db.users.filter(user => user.id !== target.id);
    revokeUserSessions(target.id);
    activity(me, 'deleted account', target.email);
    save();
    emit('user.deleted', { id: target.id });
    json(res, 200, { ok: true });
    return true;
  }

  return json(res, 405, { error: 'METHOD_NOT_ALLOWED' }), true;
};
