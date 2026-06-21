'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { logCreate, logUpdate, logDelete } = require('../permissions/audit');

const router = express.Router();
const ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'];

router.use(authRequired, perm.requirePermission('user', 'list'));

router.get('/', perm.maskResponse('user'), async (req, res, next) => {
  try {
    const allUsers = await store.listUsers();
    if (req.user.role === 'ADMIN') {
      return sendData(res, 200, allUsers);
    }
    const accessibleOrgIds = await perm.getAccessibleOrgIds(req.user.orgId, req.permission.scope);
    const filtered = allUsers.filter((u) => accessibleOrgIds.includes(u.orgId));
    return sendData(res, 200, filtered);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('user', 'create'), async (req, res, next) => {
  try {
    const { username, password, name, role = 'VIEWER', orgId } = req.body || {};
    if (!username || !password || !name) return sendError(res, 400, '用户名、密码、姓名不能为空');
    if (!ROLES.includes(role)) return sendError(res, 400, '非法的角色');
    if (await store.getUserByUsername(username)) return sendError(res, 409, '用户名已存在');
    if (orgId !== undefined && orgId !== null) {
      const org = await store.getOrganizationById(Number(orgId));
      if (!org) return sendError(res, 400, '所属组织不存在');
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'organization', Number(orgId));
      if (!inScope) return sendError(res, 403, '无权在此组织下创建用户');
    }
    const created = await store.createUser({ username, password, name, role, orgId: orgId ?? null });
    await logCreate(req, 'user', created.id, { username: created.username, name: created.name, role: created.role });
    return sendData(res, 201, created);
  } catch (e) { return next(e); }
});

router.put('/:id', perm.requireResourcePermission('user', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getUserById(id);
    if (!old) return sendError(res, 404, '用户不存在');
    if (req.body && req.body.role !== undefined && !ROLES.includes(req.body.role)) return sendError(res, 400, '非法的角色');
    if (req.body && req.body.orgId !== undefined && req.body.orgId !== null) {
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'organization', Number(req.body.orgId));
      if (!inScope) return sendError(res, 403, '无权将用户移动到此组织');
    }
    const updated = await store.updateUser(id, req.body || {});
    const fieldMap = { name: 'name', role: 'role', orgId: 'org_id', status: 'status' };
    for (const [k] of Object.entries(fieldMap)) {
      if (req.body && req.body[k] !== undefined && old[k] !== updated[k]) {
        await logUpdate(req, 'user', id, k, old[k], updated[k]);
      }
    }
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.delete('/:id', perm.requireResourcePermission('user', 'delete'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (id === req.user.id) return sendError(res, 400, '不能删除当前登录用户');
    const old = await store.getUserById(id);
    if (!old) return sendError(res, 404, '用户不存在');
    await store.deleteUser(id);
    await logDelete(req, 'user', id, old);
    return sendData(res, 200, { id });
  } catch (e) { return next(e); }
});

module.exports = router;
