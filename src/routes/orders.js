'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');
const { logCreate, logUpdate } = require('../permissions/audit');

const router = express.Router();
router.use(authRequired);

router.get('/', perm.requirePermission('order', 'list'), perm.maskResponse('order'), async (req, res, next) => {
  try {
    const { elderId, mealId, status } = req.query;
    const f = { status };
    if (elderId !== undefined) f.elderId = Number(elderId);
    if (mealId !== undefined) f.mealId = Number(mealId);
    const data = await perm.scopedList(req, 'order', f);
    return sendData(res, 200, data);
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requireResourcePermission('order', 'read'), perm.maskResponse('order'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const o = await store.getOrderById(id);
    if (!o) return sendError(res, 404, '订餐记录不存在');
    return sendData(res, 200, o);
  } catch (e) { return next(e); }
});

router.post('/', perm.requirePermission('order', 'create'), async (req, res, next) => {
  try {
    const { elderId, mealId, diningType = 'DINE_IN', qty = 1 } = req.body || {};
    if (elderId === undefined || mealId === undefined) return sendError(res, 400, '长者和餐次不能为空');
    const elder = await store.getElderById(Number(elderId));
    if (!elder) return sendError(res, 400, '长者不存在');
    const elderInScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'elder', Number(elderId));
    if (!elderInScope) return sendError(res, 403, '无权为此长者订餐');
    const meal = await store.getMealById(Number(mealId));
    if (!meal) return sendError(res, 400, '餐次不存在');
    if (meal.status !== 'PUBLISHED') return sendError(res, 409, '该餐次未开放订餐');
    const mealInScope = await perm.isResourceInScope(req.user.orgId, req.permission.scope, 'meal', Number(mealId));
    if (!mealInScope) return sendError(res, 403, '无权订此助餐点的餐次');
    const amount = meal.priceCents * (Number(qty) || 1);
    const order = await store.createOrder({
      elderId: Number(elderId), mealId: Number(mealId), diningType, qty: Number(qty) || 1,
      amountCents: amount, subsidyCents: 0, payCents: amount, status: 'RESERVED',
    });
    await logCreate(req, 'order', order.id, order);
    return sendData(res, 201, order);
  } catch (e) { return next(e); }
});

router.post('/:id/serve', perm.requireResourcePermission('order', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const o = await store.getOrderById(id);
    if (!o) return sendError(res, 404, '订餐记录不存在');
    if (o.status !== 'RESERVED') return sendError(res, 409, '该订餐已核销或已取消');
    const updated = await store.updateOrder(id, { status: 'SERVED' });
    await logUpdate(req, 'order', id, 'status', o.status, 'SERVED');
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

router.post('/:id/cancel', perm.requireResourcePermission('order', 'update'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const o = await store.getOrderById(id);
    if (!o) return sendError(res, 404, '订餐记录不存在');
    if (o.status === 'SERVED') return sendError(res, 409, '已核销的订餐不能取消');
    const updated = await store.updateOrder(id, { status: 'CANCELLED' });
    await logUpdate(req, 'order', id, 'status', o.status, 'CANCELLED');
    return sendData(res, 200, updated);
  } catch (e) { return next(e); }
});

module.exports = router;
