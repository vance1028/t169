'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { invalidatePolicyCache } = require('../permissions/engine');
const { logCreate, logUpdate, logDelete } = require('../permissions/audit');

const router = express.Router();
router.use(authRequired, perm.requirePermission('permissionPolicy', 'list'));

const VALID_SCOPES = ['ALL', 'ORG_AND_DESCENDANTS', 'ORG_ONLY'];
const VALID_SENSITIVITIES = ['PUBLIC', 'INTERNAL', 'SENSITIVE', 'CONFIDENTIAL'];
const VALID_ROLES = ['ADMIN', 'OPERATOR', 'VIEWER'];
const VALID_ACTIONS = ['*', 'list', 'read', 'create', 'update', 'delete'];

router.get('/', perm.maskResponse('permissionPolicy'), async (req, res, next) => {
  try {
    const { resourceType, action, role, status } = req.query;
    const data = await store.listPermissionPolicies({ resourceType, action, role, status });
    return sendData(res, 200, data);
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requirePermission('permissionPolicy', 'read'), perm.maskResponse('permissionPolicy'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const policy = await store.getPermissionPolicyById(id);
    if (!policy) return sendError(res, 404, '权限策略不存在');
    return sendData(res, 200, policy);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('permissionPolicy', 'create'), async (req, res, next) => {
  try {
    const { name, resourceType, action, role, scope, minSensitivity, status } = req.body || {};
    if (!name || !resourceType || !action || !role) return sendError(res, 400, '名称、资源类型、操作、角色不能为空');
    if (!VALID_ACTIONS.includes(action) && action !== '*') return sendError(res, 400, '非法的操作类型');
    if (!VALID_ROLES.includes(role)) return sendError(res, 400, '非法的角色');
    if (scope && !VALID_SCOPES.includes(scope)) return sendError(res, 400, '非法的范围');
    if (minSensitivity && !VALID_SENSITIVITIES.includes(minSensitivity)) return sendError(res, 400, '非法的敏感级别');
    if (await store.getPermissionPolicyByName(name)) return sendError(res, 409, '策略名称已存在');
    const created = await store.createPermissionPolicy({ name, resourceType, action, role, scope, minSensitivity, status });
    invalidatePolicyCache();
    await logCreate(req, 'permissionPolicy', created.id, created);
    return sendData(res, 201, created);
  } catch (e) { return next(e); }
});

router.put('/:id', perm.requirePermission('permissionPolicy', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getPermissionPolicyById(id);
    if (!old) return sendError(res, 404, '权限策略不存在');
    const { scope, minSensitivity, status } = req.body || {};
    if (req.body && req.body.action !== undefined && !VALID_ACTIONS.includes(req.body.action) && req.body.action !== '*') {
      return sendError(res, 400, '非法的操作类型');
    }
    if (req.body && req.body.role !== undefined && !VALID_ROLES.includes(req.body.role)) {
      return sendError(res, 400, '非法的角色');
    }
    if (scope && !VALID_SCOPES.includes(scope)) return sendError(res, 400, '非法的范围');
    if (minSensitivity && !VALID_SENSITIVITIES.includes(minSensitivity)) return sendError(res, 400, '非法的敏感级别');
    if (req.body && req.body.name !== undefined) {
      const exists = await store.getPermissionPolicyByName(req.body.name);
      if (exists && exists.id !== id) return sendError(res, 409, '策略名称已存在');
    }
    const updated = await store.updatePermissionPolicy(id, req.body || {});
    invalidatePolicyCache();
    const fieldMap = { name: 'name', resourceType: 'resourceType', action: 'action', role: 'role', scope: 'scope', minSensitivity: 'minSensitivity', status: 'status' };
    for (const [k] of Object.entries(fieldMap)) {
      if (req.body && req.body[k] !== undefined && old[k] !== updated[k]) {
        await logUpdate(req, 'permissionPolicy', id, k, old[k], updated[k]);
      }
    }
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.delete('/:id', perm.requirePermission('permissionPolicy', 'delete'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getPermissionPolicyById(id);
    if (!old) return sendError(res, 404, '权限策略不存在');
    await store.deletePermissionPolicy(id);
    invalidatePolicyCache();
    await logDelete(req, 'permissionPolicy', id, old);
    return sendData(res, 200, { id });
  } catch (e) { return next(e); }
});

router.post('/reload', perm.requirePermission('permissionPolicy', 'update'), async (req, res, next) => {
  try {
    invalidatePolicyCache();
    return sendData(res, 200, { reloaded: true });
  } catch (e) { return next(e); }
});

module.exports = router;
