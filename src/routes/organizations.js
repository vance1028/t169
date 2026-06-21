'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { logCreate, logUpdate, logDelete } = require('../permissions/audit');

const router = express.Router();
router.use(authRequired);

router.get('/', perm.requirePermission('organization', 'list'), async (req, res, next) => {
  try {
    const { type, parentId, status } = req.query;
    const data = await perm.scopedList(req, 'organization', { type, status, parentId: parentId !== undefined ? Number(parentId) : undefined });
    return sendData(res, 200, data);
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requireResourcePermission('organization', 'read'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const org = await store.getOrganizationById(id);
    if (!org) return sendError(res, 404, '组织不存在');
    return sendData(res, 200, org);
  } catch (e) { return next(e); }
});

router.get('/:id/children', perm.requireResourcePermission('organization', 'read'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const children = await store.listOrganizations({ parentId: id });
    return sendData(res, 200, children);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('organization', 'create'), async (req, res, next) => {
  try {
    const { code, name, type, parentId } = req.body || {};
    if (!code || !name || !type) return sendError(res, 400, '编号、名称、类型不能为空');
    if (await store.getOrganizationByCode(code)) return sendError(res, 409, '组织编号已存在');
    if (parentId !== undefined && parentId !== null) {
      const parent = await store.getOrganizationById(Number(parentId));
      if (!parent) return sendError(res, 400, '上级组织不存在');
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'organization', Number(parentId));
      if (!inScope) return sendError(res, 403, '无权在此组织下创建子组织');
    }
    const created = await store.createOrganization(req.body);
    await logCreate(req, 'organization', created.id, created);
    return sendData(res, 201, created);
  } catch (e) { return next(e); }
});

router.put('/:id', perm.requireResourcePermission('organization', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getOrganizationById(id);
    if (!old) return sendError(res, 404, '组织不存在');
    if (req.body && req.body.parentId !== undefined && req.body.parentId !== null) {
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'organization', Number(req.body.parentId));
      if (!inScope) return sendError(res, 403, '无权将组织移动到该上级下');
    }
    const updated = await store.updateOrganization(id, req.body || {});
    perm.invalidatePolicyCache && perm.invalidatePolicyCache();
    const fieldMap = { name: 'name', type: 'type', parentId: 'parent_id', status: 'status' };
    for (const [k] of Object.entries(fieldMap)) {
      if (req.body && req.body[k] !== undefined && old[k] !== updated[k]) {
        await logUpdate(req, 'organization', id, k, old[k], updated[k]);
      }
    }
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.delete('/:id', perm.requireResourcePermission('organization', 'delete'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getOrganizationById(id);
    if (!old) return sendError(res, 404, '组织不存在');
    const children = await store.listOrganizations({ parentId: id });
    if (children.length > 0) return sendError(res, 400, '该组织下还有子组织，不能删除');
    await store.deleteOrganization(id);
    perm.invalidatePolicyCache && perm.invalidatePolicyCache();
    await logDelete(req, 'organization', id, old);
    return sendData(res, 200, { id });
  } catch (e) { return next(e); }
});

module.exports = router;
