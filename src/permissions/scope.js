'use strict';

const store = require('../data/store');

const ORG_TYPES = {
  CITY: 'CITY',
  DISTRICT: 'DISTRICT',
  CANTEEN: 'CANTEEN',
};

const SCOPES = {
  ALL: 'ALL',
  ORG_AND_DESCENDANTS: 'ORG_AND_DESCENDANTS',
  ORG_ONLY: 'ORG_ONLY',
};

async function getAccessibleOrgIds(userOrgId, scope = SCOPES.ORG_AND_DESCENDANTS) {
  if (scope === SCOPES.ALL) return null;
  if (!userOrgId) return [];
  if (scope === SCOPES.ORG_ONLY) return [userOrgId];
  return store.getDescendantOrgIds(userOrgId);
}

async function getAccessibleCanteenIds(userOrgId, scope = SCOPES.ORG_AND_DESCENDANTS) {
  const orgIds = await getAccessibleOrgIds(userOrgId, scope);
  if (orgIds === null) return null;
  if (!orgIds.length) return [];
  const canteens = await store.listCanteensByOrgIds(orgIds);
  return canteens.map((c) => c.id);
}

async function getAccessibleElderIds(userOrgId, scope = SCOPES.ORG_AND_DESCENDANTS) {
  const canteenIds = await getAccessibleCanteenIds(userOrgId, scope);
  if (canteenIds === null) return null;
  if (!canteenIds.length) return [];
  const elders = await store.listEldersByCanteenIds(canteenIds);
  return elders.map((e) => e.id);
}

async function getResourceOrgId(resourceType, resourceId) {
  switch (resourceType) {
    case 'organization':
      return resourceId;
    case 'canteen':
      return store.getCanteenOrgId(resourceId);
    case 'elder': {
      const canteenId = await store.getElderCanteenId(resourceId);
      if (!canteenId) return null;
      return store.getCanteenOrgId(canteenId);
    }
    case 'meal': {
      const canteenId = await store.getMealCanteenId(resourceId);
      if (!canteenId) return null;
      return store.getCanteenOrgId(canteenId);
    }
    case 'order': {
      const elderId = await store.getOrderElderId(resourceId);
      if (!elderId) return null;
      const canteenId = await store.getElderCanteenId(elderId);
      if (!canteenId) return null;
      return store.getCanteenOrgId(canteenId);
    }
    case 'user': {
      const user = await store.getUserById(resourceId);
      return user ? user.orgId : null;
    }
    case 'permissionPolicy':
      return null;
    case 'auditLog':
      return null;
    default:
      return null;
  }
}

async function isResourceInScope(userOrgId, scope, resourceType, resourceId) {
  if (scope === SCOPES.ALL) return true;
  if (!userOrgId) return false;
  const resourceOrgId = await getResourceOrgId(resourceType, resourceId);
  if (!resourceOrgId) return false;
  const accessibleOrgIds = await getAccessibleOrgIds(userOrgId, scope);
  return accessibleOrgIds.includes(resourceOrgId);
}

module.exports = {
  ORG_TYPES,
  SCOPES,
  getAccessibleOrgIds,
  getAccessibleCanteenIds,
  getAccessibleElderIds,
  getResourceOrgId,
  isResourceInScope,
};
