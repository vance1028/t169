'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { logCreate, logUpdate, logDelete } = require('../permissions/audit');

const router = express.Router();
router.use(authRequired);

router.get('/', perm.requirePermission('canteen', 'list'), perm.maskResponse('canteen'), async (req, res, next) => {
  try {
    const { district, status, keyword } = req.query;
    const data = await perm.scopedList(req, 'canteen', { district, status, keyword });
    return sendData(res, 200, data);
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requireResourcePermission('canteen', 'read'), perm.maskResponse('canteen'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const c = await store.getCanteenById(id);
    if (!c) return sendError(res, 404, '助餐点不存在');
    return sendData(res, 200, c);
  } catch (e) { return next(e); }
});

router.get('/:id/elders', perm.requireResourcePermission('canteen', 'read'), perm.maskResponse('elder'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!(await store.getCanteenById(id))) return sendError(res, 404, '助餐点不存在');
    const elders = await store.listElders({ canteenId: id });
    return sendData(res, 200, elders);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('canteen', 'create'), async (req, res, next) => {
  try {
    const { code, name, district, orgId } = req.body || {};
    if (!code || !name || !district) return sendError(res, 400, '编号、名称、区域不能为空');
    if (await store.getCanteenByCode(code)) return sendError(res, 409, '助餐点编号已存在');
    if (orgId !== undefined && orgId !== null) {
      const org = await store.getOrganizationById(Number(orgId));
      if (!org) return sendError(res, 400, '所属组织不存在');
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'organization', Number(orgId));
      if (!inScope) return sendError(res, 403, '无权在此组织下创建助餐点');
    }
    const created = await store.createCanteen(req.body);
    await logCreate(req, 'canteen', created.id, created);
    return sendData(res, 201, created);
  } catch (e) { return next(e); }
});

router.put('/:id', perm.requireResourcePermission('canteen', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getCanteenById(id);
    if (!old) return sendError(res, 404, '助餐点不存在');
    if (req.body && req.body.orgId !== undefined && req.body.orgId !== null) {
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'organization', Number(req.body.orgId));
      if (!inScope) return sendError(res, 403, '无权将助餐点划转到此组织');
    }
    const updated = await store.updateCanteen(id, req.body || {});
    const fieldMap = { name: 'name', district: 'district', orgId: 'org_id', address: 'address', capacity: 'capacity', status: 'status' };
    for (const [k] of Object.entries(fieldMap)) {
      if (req.body && req.body[k] !== undefined && old[k] !== updated[k]) {
        await logUpdate(req, 'canteen', id, k, old[k], updated[k]);
      }
    }
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.delete('/:id', perm.requireResourcePermission('canteen', 'delete'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getCanteenById(id);
    if (!old) return sendError(res, 404, '助餐点不存在');
    await store.deleteCanteen(id);
    await logDelete(req, 'canteen', id, old);
    return sendData(res, 200, { id });
  } catch (e) { return next(e); }
});

module.exports = router;
