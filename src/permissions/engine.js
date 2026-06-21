'use strict';

const store = require('../data/store');
const { SCOPES, isResourceInScope, getAccessibleCanteenIds, getAccessibleElderIds, getAccessibleOrgIds } = require('./scope');
const { SENSITIVITY_LEVELS, sensitivityGte, maskResource, getFieldSensitivity } = require('./masking');

const ACTIONS = {
  LIST: 'list',
  READ: 'read',
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};

const DEFAULT_POLICIES = [
  { name: 'admin_all_all', resourceType: '*', action: '*', role: 'ADMIN', scope: 'ALL', minSensitivity: 'CONFIDENTIAL' },
  { name: 'operator_org_canteen_read', resourceType: 'canteen', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_canteen_list', resourceType: 'canteen', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_canteen_create', resourceType: 'canteen', action: 'create', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_canteen_update', resourceType: 'canteen', action: 'update', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_elder_read', resourceType: 'elder', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'SENSITIVE' },
  { name: 'operator_org_elder_list', resourceType: 'elder', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'SENSITIVE' },
  { name: 'operator_org_elder_create', resourceType: 'elder', action: 'create', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'SENSITIVE' },
  { name: 'operator_org_elder_update', resourceType: 'elder', action: 'update', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'SENSITIVE' },
  { name: 'operator_org_meal_read', resourceType: 'meal', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_meal_list', resourceType: 'meal', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_meal_create', resourceType: 'meal', action: 'create', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_meal_update', resourceType: 'meal', action: 'update', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_order_read', resourceType: 'order', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_order_list', resourceType: 'order', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_order_create', resourceType: 'order', action: 'create', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_order_update', resourceType: 'order', action: 'update', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_organization_read', resourceType: 'organization', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_organization_list', resourceType: 'organization', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_organization_create', resourceType: 'organization', action: 'create', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_organization_update', resourceType: 'organization', action: 'update', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'operator_org_user_read', resourceType: 'user', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_user_list', resourceType: 'user', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_user_create', resourceType: 'user', action: 'create', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_org_user_update', resourceType: 'user', action: 'update', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'viewer_org_canteen_read', resourceType: 'canteen', action: 'read', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'viewer_org_canteen_list', resourceType: 'canteen', action: 'list', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'viewer_org_elder_read', resourceType: 'elder', action: 'read', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'viewer_org_elder_list', resourceType: 'elder', action: 'list', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'viewer_org_meal_read', resourceType: 'meal', action: 'read', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'viewer_org_meal_list', resourceType: 'meal', action: 'list', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'viewer_org_order_read', resourceType: 'order', action: 'read', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'viewer_org_order_list', resourceType: 'order', action: 'list', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'viewer_org_organization_read', resourceType: 'organization', action: 'read', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'viewer_org_organization_list', resourceType: 'organization', action: 'list', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'PUBLIC' },
  { name: 'viewer_org_user_read', resourceType: 'user', action: 'read', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'viewer_org_user_list', resourceType: 'user', action: 'list', role: 'VIEWER', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'admin_audit_log_all', resourceType: 'auditLog', action: '*', role: 'ADMIN', scope: 'ALL', minSensitivity: 'INTERNAL' },
  { name: 'operator_audit_log_list', resourceType: 'auditLog', action: 'list', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'operator_audit_log_read', resourceType: 'auditLog', action: 'read', role: 'OPERATOR', scope: 'ORG_AND_DESCENDANTS', minSensitivity: 'INTERNAL' },
  { name: 'admin_permission_policy_all', resourceType: 'permissionPolicy', action: '*', role: 'ADMIN', scope: 'ALL', minSensitivity: 'INTERNAL' },
];

let policyCache = null;
let cacheTime = 0;
const CACHE_TTL = 60000;

async function loadPolicies() {
  const now = Date.now();
  if (policyCache && now - cacheTime < CACHE_TTL) return policyCache;
  try {
    const dbPolicies = await store.listPermissionPolicies({ status: 'ACTIVE' });
    policyCache = [...DEFAULT_POLICIES, ...dbPolicies];
    cacheTime = now;
    return policyCache;
  } catch (e) {
    if (policyCache) return policyCache;
    return DEFAULT_POLICIES;
  }
}

function invalidatePolicyCache() {
  policyCache = null;
  cacheTime = 0;
}

function matchPolicy(policy, resourceType, action, role) {
  if (policy.resourceType !== '*' && policy.resourceType !== resourceType) return false;
  if (policy.action !== '*' && policy.action !== action) return false;
  if (policy.role !== role) return false;
  return true;
}

async function findApplicablePolicy(user, resourceType, action) {
  const policies = await loadPolicies();
  for (const policy of policies) {
    if (matchPolicy(policy, resourceType, action, user.role)) {
      return policy;
    }
  }
  return null;
}

async function canAccess(user, resourceType, action) {
  if (!user) return { allowed: false, reason: '未认证' };
  const policy = await findApplicablePolicy(user, resourceType, action);
  if (!policy) return { allowed: false, reason: '无匹配的权限策略' };
  return {
    allowed: true,
    scope: policy.scope,
    minSensitivity: policy.minSensitivity,
    policy: policy.name,
  };
}

async function canAccessResource(user, resourceType, action, resourceId) {
  const access = await canAccess(user, resourceType, action);
  if (!access.allowed) return access;
  const inScope = await isResourceInScope(user.orgId, access.scope, resourceType, resourceId);
  if (!inScope) return { allowed: false, reason: '数据不在授权范围内' };
  return access;
}

async function filterByScope(user, resourceType, action, listFn) {
  const access = await canAccess(user, resourceType, action);
  if (!access.allowed) return [];
  if (access.scope === SCOPES.ALL) {
    return listFn({});
  }
  if (resourceType === 'canteen') {
    const canteenIds = await getAccessibleCanteenIds(user.orgId, access.scope);
    if (canteenIds === null) return listFn({});
    return listFn({ canteenIds });
  }
  if (resourceType === 'elder') {
    const canteenIds = await getAccessibleCanteenIds(user.orgId, access.scope);
    if (canteenIds === null) return listFn({});
    return listFn({ canteenIds });
  }
  if (resourceType === 'meal') {
    const canteenIds = await getAccessibleCanteenIds(user.orgId, access.scope);
    if (canteenIds === null) return listFn({});
    return listFn({ canteenIds });
  }
  if (resourceType === 'order') {
    const elderIds = await getAccessibleElderIds(user.orgId, access.scope);
    if (elderIds === null) return listFn({});
    return listFn({ elderIds });
  }
  if (resourceType === 'organization') {
    const orgIds = await getAccessibleOrgIds(user.orgId, access.scope);
    if (orgIds === null) return listFn({});
    return listFn({ orgIds });
  }
  return [];
}

function applyMasking(data, resourceType, minSensitivity) {
  return maskResource(data, resourceType, minSensitivity);
}

async function checkFieldAccess(user, resourceType, fieldName) {
  const readAccess = await canAccess(user, resourceType, 'read');
  if (!readAccess.allowed) return { allowed: false };
  const fieldLevel = getFieldSensitivity(resourceType, fieldName);
  const allowed = sensitivityGte(readAccess.minSensitivity, fieldLevel);
  return { allowed, fieldLevel, minSensitivity: readAccess.minSensitivity };
}

module.exports = {
  ACTIONS,
  DEFAULT_POLICIES,
  loadPolicies,
  invalidatePolicyCache,
  canAccess,
  canAccessResource,
  filterByScope,
  applyMasking,
  checkFieldAccess,
};
