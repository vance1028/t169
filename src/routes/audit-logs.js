'use strict';

const express = require('express');
const store = require('../data/store');
const { authRequired } = require('../auth');
const { sendData, sendError, parseId } = require('../utils/http');
const perm = require('../permissions');

const router = express.Router();
router.use(authRequired, perm.requirePermission('auditLog', 'list'));

router.get('/', perm.maskResponse('auditLog'), async (req, res, next) => {
  try {
    const { userId, resourceType, resourceId, action, startTime, endTime, page = 1, pageSize = 20 } = req.query;
    const limit = Math.min(Number(pageSize) || 20, 100);
    const offset = (Math.max(Number(page) || 1, 1) - 1) * limit;

    const access = await perm.canAccess(req.user, 'auditLog', 'list');
    let userIds = null;
    if (access.allowed && access.scope !== 'ALL') {
      const orgIds = await perm.getAccessibleOrgIds(req.user.orgId, access.scope);
      if (orgIds !== null) {
        const allUsers = await store.listUsers();
        userIds = allUsers.filter((u) => orgIds.includes(u.orgId)).map((u) => u.id);
      }
    }

    const filters = {
      userId: userId !== undefined ? Number(userId) : undefined,
      userIds,
      resourceType,
      resourceId: resourceId !== undefined ? resourceId : undefined,
      action,
      startTime,
      endTime,
    };
    const [list, total] = await Promise.all([
      store.listAuditLogs({ ...filters, limit, offset }),
      store.countAuditLogs(filters),
    ]);
    return sendData(res, 200, list, { total, page: Number(page) || 1, pageSize: limit });
  } catch (e) { return next(e); }
});

router.get('/:id', perm.requirePermission('auditLog', 'read'), async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    const logs = await store.listAuditLogs({ limit: 1, offset: 0 });
    const log = logs.find((l) => l.id === id);
    if (!log) return sendError(res, 404, '审计日志不存在');
    return sendData(res, 200, log);
  } catch (e) { return next(e); }
});

module.exports = router;
