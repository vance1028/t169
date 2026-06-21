'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { logCreate, logUpdate, logDelete } = require('../permissions/audit');

const router = express.Router();
router.use(authRequired);

router.get('/', perm.requirePermission('meal', 'list'), perm.maskResponse('meal'), async (req, res, next) => {
  try {
    const { canteenId, serveDate, mealType, status } = req.query;
    const f = { serveDate, mealType, status };
    if (canteenId !== undefined) f.canteenId = Number(canteenId);
    const data = await perm.scopedList(req, 'meal', f);
    return sendData(res, 200, data);
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requireResourcePermission('meal', 'read'), perm.maskResponse('meal'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const m = await store.getMealById(id);
    if (!m) return sendError(res, 404, '餐次不存在');
    return sendData(res, 200, m);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('meal', 'create'), async (req, res, next) => {
  try {
    const { canteenId, serveDate, dishName } = req.body || {};
    if (canteenId === undefined || !serveDate || !dishName) return sendError(res, 400, '助餐点、供应日期、菜品名不能为空');
    const canteen = await store.getCanteenById(Number(canteenId));
    if (!canteen) return sendError(res, 400, '助餐点不存在');
    const inScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'canteen', Number(canteenId));
    if (!inScope) return sendError(res, 403, '无权在此助餐点下创建餐次');
    const created = await store.createMeal({ ...req.body, canteenId: Number(canteenId) });
    await logCreate(req, 'meal', created.id, created);
    return sendData(res, 201, created);
  } catch (e) { return next(e); }
});

router.put('/:id', perm.requireResourcePermission('meal', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getMealById(id);
    if (!old) return sendError(res, 404, '餐次不存在');
    const updated = await store.updateMeal(id, req.body || {});
    const fieldMap = { serveDate: 'serve_date', mealType: 'meal_type', dishName: 'dish_name', priceCents: 'price_cents', status: 'status' };
    for (const [k] of Object.entries(fieldMap)) {
      if (req.body && req.body[k] !== undefined && old[k] !== updated[k]) {
        await logUpdate(req, 'meal', id, k, old[k], updated[k]);
      }
    }
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.delete('/:id', perm.requireResourcePermission('meal', 'delete'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const old = await store.getMealById(id);
    if (!old) return sendError(res, 404, '餐次不存在');
    await store.deleteMeal(id);
    await logDelete(req, 'meal', id, old);
    return sendData(res, 200, { id });
  } catch (e) { return next(e); }
});

module.exports = router;
