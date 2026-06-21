'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { logCreate, logUpdate, logDelete, logViewSensitive } = require('../permissions/audit');

const router = express.Router();
router.use(authRequired);

router.get('/', perm.requirePermission('elder', 'list'), perm.maskResponse('elder'), async (req, res, next) => {
  try {
    const { canteenId, subsidyLevel, status, keyword } = req.query;
    const f = { subsidyLevel, status, keyword };
    if (canteenId !== undefined) f.canteenId = Number(canteenId);
    const data = await perm.scopedList(req, 'elder', f);
    return sendData(res, 200, data);
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requireResourcePermission('elder', 'read'), perm.maskResponse('elder'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const el = await store.getElderById(id);
    if (!el) return sendError(res, 404, '长者档案不存在');
    const sensitiveFields = ['idCard', 'phone', 'healthRecord'];
    for (const field of sensitiveFields) {
      const fieldAccess = await perm.checkFieldAccess(req.user, 'elder', field);
      if (fieldAccess.allowed) {
        await logViewSensitive(req, 'elder', id, field);
      }
    }
    return sendData(res, 200, el);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('elder', 'create'), async (req, res, next) => {
  try {
    const { code, name, canteenId } = req.body || {};
    if (!code || !name) return sendError(res, 400, '编号和姓名不能为空');
    if (await store.getElderByCode(code)) return sendError(res, 409, '长者编号已存在');
    if (canteenId !== undefined && canteenId !== null) {
      const canteen = await store.getCanteenById(Number(canteenId));
      if (!canteen) return sendError(res, 400, '所属助餐点不存在');
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'canteen', Number(canteenId));
      if (!inScope) return sendError(res, 403, '无权在此助餐点下创建长者档案');
    }
    const created = await store.createElder(req.body);
    await logCreate(req, 'elder', created.id, created);
    return sendData(res, 201, created);
  } catch (e) { return next(e); }
});

router.put('/:id', perm.requireResourcePermission('elder', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getElderById(id);
    if (!old) return sendError(res, 404, '长者档案不存在');
    if (req.body && req.body.canteenId !== undefined && req.body.canteenId !== null) {
      const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'canteen', Number(req.body.canteenId));
      if (!inScope) return sendError(res, 403, '无权将长者迁移到此助餐点');
    }
    const updated = await store.updateElder(id, req.body || {});
    const fieldMap = {
      name: 'name', gender: 'gender', age: 'age', idCard: 'id_card',
      phone: 'phone', healthRecord: 'health_record', subsidyLevel: 'subsidy_level',
      dietary: 'dietary', canteenId: 'canteen_id', status: 'status',
    };
    for (const [k] of Object.entries(fieldMap)) {
      if (req.body && req.body[k] !== undefined && old[k] !== updated[k]) {
        await logUpdate(req, 'elder', id, k, old[k], updated[k]);
      }
    }
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.delete('/:id', perm.requireResourcePermission('elder', 'delete'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getElderById(id);
    if (!old) return sendError(res, 404, '长者档案不存在');
    await store.deleteElder(id);
    await logDelete(req, 'elder', id, old);
    return sendData(res, 200, { id });
  } catch (e) { return next(e); }
});

module.exports = router;
