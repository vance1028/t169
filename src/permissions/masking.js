'use strict';

const SENSITIVITY_LEVELS = {
  PUBLIC: 'PUBLIC',
  INTERNAL: 'INTERNAL',
  SENSITIVE: 'SENSITIVE',
  CONFIDENTIAL: 'CONFIDENTIAL',
};

const SENSITIVITY_WEIGHT = {
  PUBLIC: 0,
  INTERNAL: 1,
  SENSITIVE: 2,
  CONFIDENTIAL: 3,
};

function sensitivityGte(levelA, levelB) {
  return SENSITIVITY_WEIGHT[levelA] >= SENSITIVITY_WEIGHT[levelB];
}

const RESOURCE_FIELDS = {
  organization: {
    id: 'PUBLIC',
    code: 'PUBLIC',
    name: 'PUBLIC',
    type: 'PUBLIC',
    parentId: 'INTERNAL',
    status: 'PUBLIC',
    createdAt: 'PUBLIC',
    updatedAt: 'PUBLIC',
  },
  elder: {
    id: 'PUBLIC',
    code: 'PUBLIC',
    name: 'PUBLIC',
    gender: 'PUBLIC',
    age: 'PUBLIC',
    idCard: 'CONFIDENTIAL',
    phone: 'SENSITIVE',
    healthRecord: 'CONFIDENTIAL',
    subsidyLevel: 'INTERNAL',
    dietary: 'INTERNAL',
    canteenId: 'PUBLIC',
    status: 'PUBLIC',
    createdAt: 'PUBLIC',
    updatedAt: 'PUBLIC',
  },
  user: {
    id: 'PUBLIC',
    username: 'INTERNAL',
    name: 'PUBLIC',
    role: 'INTERNAL',
    orgId: 'INTERNAL',
    status: 'PUBLIC',
    createdAt: 'PUBLIC',
  },
  canteen: {
    id: 'PUBLIC',
    code: 'PUBLIC',
    name: 'PUBLIC',
    district: 'PUBLIC',
    orgId: 'INTERNAL',
    address: 'PUBLIC',
    capacity: 'PUBLIC',
    status: 'PUBLIC',
    createdAt: 'PUBLIC',
    updatedAt: 'PUBLIC',
  },
  meal: {
    id: 'PUBLIC',
    canteenId: 'PUBLIC',
    serveDate: 'PUBLIC',
    mealType: 'PUBLIC',
    dishName: 'PUBLIC',
    priceCents: 'PUBLIC',
    status: 'PUBLIC',
    createdAt: 'PUBLIC',
    updatedAt: 'PUBLIC',
  },
  order: {
    id: 'PUBLIC',
    elderId: 'PUBLIC',
    mealId: 'PUBLIC',
    diningType: 'PUBLIC',
    qty: 'PUBLIC',
    amountCents: 'INTERNAL',
    subsidyCents: 'INTERNAL',
    payCents: 'INTERNAL',
    status: 'PUBLIC',
    createdAt: 'PUBLIC',
    updatedAt: 'PUBLIC',
  },
  auditLog: {
    id: 'INTERNAL',
    userId: 'INTERNAL',
    username: 'INTERNAL',
    action: 'INTERNAL',
    resourceType: 'INTERNAL',
    resourceId: 'INTERNAL',
    fieldName: 'INTERNAL',
    oldValue: 'SENSITIVE',
    newValue: 'SENSITIVE',
    ipAddress: 'SENSITIVE',
    userAgent: 'INTERNAL',
    createdAt: 'INTERNAL',
  },
  permissionPolicy: {
    id: 'INTERNAL',
    name: 'INTERNAL',
    resourceType: 'INTERNAL',
    action: 'INTERNAL',
    role: 'INTERNAL',
    scope: 'INTERNAL',
    minSensitivity: 'INTERNAL',
    status: 'INTERNAL',
    createdAt: 'INTERNAL',
    updatedAt: 'INTERNAL',
  },
};

function getFieldSensitivity(resourceType, fieldName) {
  const fields = RESOURCE_FIELDS[resourceType];
  if (!fields) return 'PUBLIC';
  return fields[fieldName] || 'PUBLIC';
}

function maskValue(value, fieldName, sensitivity) {
  if (value === null || value === undefined || value === '') return value;
  const str = String(value);
  if (sensitivity === 'SENSITIVE') {
    if (fieldName === 'phone' && str.length >= 7) {
      return str.slice(0, 3) + '****' + str.slice(-4);
    }
    if (str.length <= 2) return str[0] + '*';
    const keep = Math.ceil(str.length / 4);
    return str.slice(0, keep) + '*'.repeat(str.length - keep * 2) + str.slice(-keep);
  }
  if (sensitivity === 'CONFIDENTIAL') {
    return '*'.repeat(Math.min(str.length, 8));
  }
  return value;
}

function maskResource(resource, resourceType, minSensitivity = 'PUBLIC') {
  if (!resource) return resource;
  if (Array.isArray(resource)) {
    return resource.map((item) => maskResource(item, resourceType, minSensitivity));
  }
  const result = { ...resource };
  for (const key of Object.keys(result)) {
    const fieldLevel = getFieldSensitivity(resourceType, key);
    if (!sensitivityGte(minSensitivity, fieldLevel)) {
      result[key] = maskValue(result[key], key, fieldLevel);
    }
  }
  return result;
}

function addSensitiveFields(resourceType, fieldConfig) {
  if (!RESOURCE_FIELDS[resourceType]) {
    RESOURCE_FIELDS[resourceType] = {};
  }
  Object.assign(RESOURCE_FIELDS[resourceType], fieldConfig);
}

module.exports = {
  SENSITIVITY_LEVELS,
  SENSITIVITY_WEIGHT,
  sensitivityGte,
  RESOURCE_FIELDS,
  getFieldSensitivity,
  maskValue,
  maskResource,
  addSensitiveFields,
};
