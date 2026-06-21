'use strict';

const { canAccess, canAccessResource, applyMasking, filterByScope } = require('./engine');
const { sendError } = require('../utils/http');
const store = require('../data/store');
const { logViewSensitive } = require('./audit');

function requirePermission(resourceType, action) {
  return async (req, res, next) => {
    try {
      const access = await canAccess(req.user, resourceType, action);
      if (!access.allowed) {
        return sendError(res, 403, `权限不足：${access.reason}`);
      }
      req.permission = access;
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

function requireResourcePermission(resourceType, action, idParam = 'id') {
  return async (req, res, next) => {
    try {
      const resourceId = req.params[idParam];
      if (!resourceId) return sendError(res, 400, '缺少资源ID');
      const access = await canAccessResource(req.user, resourceType, action, Number(resourceId));
      if (!access.allowed) {
        return sendError(res, 403, `权限不足：${access.reason}`);
      }
      req.permission = access;
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

function maskResponse(resourceType) {
  return (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      if (body && body.data && req.permission) {
        body.data = applyMasking(body.data, resourceType, req.permission.minSensitivity);
      }
      return originalJson(body);
    };
    next();
  };
}

async function scopedList(req, resourceType, options = {}) {
  const access = await canAccess(req.user, resourceType, 'list');
  if (!access.allowed) return [];

  const { SCOPES, getAccessibleCanteenIds, getAccessibleElderIds, getAccessibleOrgIds } = require('./scope');

  if (access.scope === SCOPES.ALL) {
    switch (resourceType) {
      case 'canteen': return store.listCanteens(options);
      case 'elder': return store.listElders(options);
      case 'meal': return store.listMeals(options);
      case 'order': return store.listOrders(options);
      case 'organization': return store.listOrganizations(options);
      default: return [];
    }
  }

  switch (resourceType) {
    case 'canteen': {
      const orgIds = await getAccessibleOrgIds(req.user.orgId, access.scope);
      return store.listCanteensByOrgIds(orgIds);
    }
    case 'elder': {
      const canteenIds = await getAccessibleCanteenIds(req.user.orgId, access.scope);
      return store.listEldersByCanteenIds(canteenIds, options);
    }
    case 'meal': {
      const canteenIds = await getAccessibleCanteenIds(req.user.orgId, access.scope);
      return store.listMealsByCanteenIds(canteenIds, options);
    }
    case 'order': {
      const elderIds = await getAccessibleElderIds(req.user.orgId, access.scope);
      return store.listOrdersByElderIds(elderIds, options);
    }
    case 'organization': {
      const orgIds = await getAccessibleOrgIds(req.user.orgId, access.scope);
      const all = await store.listOrganizations(options);
      return all.filter((o) => orgIds.includes(o.id));
    }
    default:
      return [];
  }
}

module.exports = {
  requirePermission,
  requireResourcePermission,
  maskResponse,
  scopedList,
};
