'use strict';

const store = require('../data/store');

const ACTIONS = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  VIEW_SENSITIVE: 'VIEW_SENSITIVE',
};

function getRequestInfo(req) {
  return {
    ipAddress: req.ip || req.connection?.remoteAddress || null,
    userAgent: req.headers['user-agent'] || null,
  };
}

async function logAudit(req, { action, resourceType, resourceId, fieldName, oldValue, newValue }) {
  const user = req.user || {};
  const { ipAddress, userAgent } = getRequestInfo(req);
  return store.createAuditLog({
    userId: user.id || null,
    username: user.username || 'anonymous',
    action,
    resourceType,
    resourceId,
    fieldName,
    oldValue,
    newValue,
    ipAddress,
    userAgent,
  });
}

async function logView(req, resourceType, resourceId) {
  return logAudit(req, { action: ACTIONS.VIEW, resourceType, resourceId });
}

async function logCreate(req, resourceType, resourceId, newValue) {
  return logAudit(req, { action: ACTIONS.CREATE, resourceType, resourceId, newValue: JSON.stringify(newValue) });
}

async function logUpdate(req, resourceType, resourceId, fieldName, oldValue, newValue) {
  return logAudit(req, {
    action: ACTIONS.UPDATE,
    resourceType,
    resourceId,
    fieldName,
    oldValue: oldValue !== undefined ? String(oldValue) : null,
    newValue: newValue !== undefined ? String(newValue) : null,
  });
}

async function logDelete(req, resourceType, resourceId, oldValue) {
  return logAudit(req, { action: ACTIONS.DELETE, resourceType, resourceId, oldValue: JSON.stringify(oldValue) });
}

async function logViewSensitive(req, resourceType, resourceId, fieldName) {
  return logAudit(req, { action: ACTIONS.VIEW_SENSITIVE, resourceType, resourceId, fieldName });
}

module.exports = {
  ACTIONS,
  logAudit,
  logView,
  logCreate,
  logUpdate,
  logDelete,
  logViewSensitive,
};
