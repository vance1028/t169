'use strict';

const { getPool } = require('../db');
const { hashPassword } = require('../utils/password');

/** 数据仓储层：SQL 集中此处，路由层只调用这些 async 方法，对外返回 camelCase。 */

/* ----------------------------- 映射 ----------------------------- */
function mapUser(r) {
  if (!r) return null;
  return { id: r.id, username: r.username, name: r.name, role: r.role, orgId: r.org_id, status: r.status, createdAt: r.created_at };
}
function mapUserWithHash(r) { return r ? { ...mapUser(r), passwordHash: r.password_hash } : null; }
function mapOrganization(r) {
  if (!r) return null;
  return { id: r.id, code: r.code, name: r.name, type: r.type, parentId: r.parent_id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapCanteen(r) {
  if (!r) return null;
  return { id: r.id, code: r.code, name: r.name, district: r.district, orgId: r.org_id, address: r.address, capacity: r.capacity, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapElder(r) {
  if (!r) return null;
  return { id: r.id, code: r.code, name: r.name, gender: r.gender, age: r.age, idCard: r.id_card, phone: r.phone, healthRecord: r.health_record, subsidyLevel: r.subsidy_level, dietary: r.dietary, canteenId: r.canteen_id, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapMeal(r) {
  if (!r) return null;
  return { id: r.id, canteenId: r.canteen_id, serveDate: r.serve_date, mealType: r.meal_type, dishName: r.dish_name, priceCents: r.price_cents, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapOrder(r) {
  if (!r) return null;
  return { id: r.id, elderId: r.elder_id, mealId: r.meal_id, diningType: r.dining_type, qty: r.qty, amountCents: r.amount_cents, subsidyCents: r.subsidy_cents, payCents: r.pay_cents, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapPermissionPolicy(r) {
  if (!r) return null;
  return { id: r.id, name: r.name, resourceType: r.resource_type, action: r.action, role: r.role, scope: r.data_scope, minSensitivity: r.min_sensitivity, status: r.status, createdAt: r.created_at, updatedAt: r.updated_at };
}
function mapAuditLog(r) {
  if (!r) return null;
  return { id: r.id, userId: r.user_id, username: r.username, action: r.action, resourceType: r.resource_type, resourceId: r.resource_id, fieldName: r.field_name, oldValue: r.old_value, newValue: r.new_value, ipAddress: r.ip_address, userAgent: r.user_agent, createdAt: r.created_at };
}

/* ----------------------------- 用户 ----------------------------- */
async function getUserByUsername(u) { const [r] = await getPool().query('SELECT * FROM users WHERE username=?', [u]); return mapUserWithHash(r[0]); }
async function getUserById(id) { const [r] = await getPool().query('SELECT * FROM users WHERE id=?', [id]); return mapUser(r[0]); }
async function listUsers() { const [r] = await getPool().query('SELECT * FROM users ORDER BY id'); return r.map(mapUser); }
async function createUser({ username, password, name, role = 'VIEWER', orgId = null, status = 'ACTIVE' }) {
  const [x] = await getPool().query('INSERT INTO users (username,password_hash,name,role,org_id,status) VALUES (?,?,?,?,?,?)', [username, hashPassword(password), name, role, orgId ?? null, status]);
  return getUserById(x.insertId);
}
async function updateUser(id, f) {
  const sets = []; const p = [];
  for (const [k, col] of Object.entries({ name: 'name', role: 'role', orgId: 'org_id', status: 'status' })) if (f[k] !== undefined) { sets.push(`${col}=?`); p.push(f[k] ?? null); }
  if (f.password !== undefined) { sets.push('password_hash=?'); p.push(hashPassword(f.password)); }
  if (sets.length) { p.push(id); await getPool().query(`UPDATE users SET ${sets.join(',')} WHERE id=?`, p); }
  return getUserById(id);
}
async function deleteUser(id) { const [x] = await getPool().query('DELETE FROM users WHERE id=?', [id]); return x.affectedRows > 0; }
async function countUsers() { const [r] = await getPool().query('SELECT COUNT(*) AS n FROM users'); return r[0].n; }

/* ----------------------------- 组织 ----------------------------- */
async function getOrganizationById(id) { const [r] = await getPool().query('SELECT * FROM organizations WHERE id=?', [id]); return mapOrganization(r[0]); }
async function getOrganizationByCode(code) { const [r] = await getPool().query('SELECT * FROM organizations WHERE code=?', [code]); return mapOrganization(r[0]); }
async function listOrganizations({ type, parentId, status } = {}) {
  const w = []; const p = [];
  if (type) { w.push('type=?'); p.push(type); }
  if (parentId !== undefined) { w.push('parent_id=?'); p.push(parentId); }
  if (status) { w.push('status=?'); p.push(status); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM organizations ${c} ORDER BY id`, p);
  return r.map(mapOrganization);
}
async function createOrganization(d) {
  const [x] = await getPool().query('INSERT INTO organizations (code,name,type,parent_id,status) VALUES (?,?,?,?,?)',
    [d.code, d.name, d.type, d.parentId ?? null, d.status || 'ACTIVE']);
  return getOrganizationById(x.insertId);
}
async function updateOrganization(id, d) {
  const map = { name: 'name', type: 'type', parentId: 'parent_id', status: 'status' };
  const sets = []; const p = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col}=?`); p.push(d[k] ?? null); }
  if (sets.length) { sets.push('updated_at=CURRENT_TIMESTAMP(3)'); p.push(id); await getPool().query(`UPDATE organizations SET ${sets.join(',')} WHERE id=?`, p); }
  return getOrganizationById(id);
}
async function deleteOrganization(id) { const [x] = await getPool().query('DELETE FROM organizations WHERE id=?', [id]); return x.affectedRows > 0; }

async function getDescendantOrgIds(orgId) {
  if (!orgId) return [];
  const all = await listOrganizations();
  const map = new Map();
  for (const o of all) {
    if (!map.has(o.parentId)) map.set(o.parentId, []);
    map.get(o.parentId).push(o.id);
  }
  const result = [orgId];
  const queue = [orgId];
  while (queue.length) {
    const cur = queue.shift();
    const children = map.get(cur) || [];
    for (const c of children) {
      result.push(c);
      queue.push(c);
    }
  }
  return result;
}

/* ----------------------------- 助餐点 ----------------------------- */
async function listCanteens({ district, status, keyword } = {}) {
  const w = []; const p = [];
  if (district) { w.push('district=?'); p.push(district); }
  if (status) { w.push('status=?'); p.push(status); }
  if (keyword) { w.push('(code LIKE ? OR name LIKE ?)'); const k = `%${keyword}%`; p.push(k, k); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM canteens ${c} ORDER BY id DESC`, p); return r.map(mapCanteen);
}
async function getCanteenById(id) { const [r] = await getPool().query('SELECT * FROM canteens WHERE id=?', [id]); return mapCanteen(r[0]); }
async function getCanteenByCode(code) { const [r] = await getPool().query('SELECT * FROM canteens WHERE code=?', [code]); return mapCanteen(r[0]); }
async function createCanteen(d) {
  const [x] = await getPool().query('INSERT INTO canteens (code,name,district,org_id,address,capacity,status) VALUES (?,?,?,?,?,?,?)', [d.code, d.name, d.district, d.orgId ?? null, d.address || '', d.capacity || 0, d.status || 'OPEN']);
  return getCanteenById(x.insertId);
}
async function updateCanteen(id, d) {
  const sets = []; const p = [];
  for (const [k, col] of Object.entries({ name: 'name', district: 'district', orgId: 'org_id', address: 'address', capacity: 'capacity', status: 'status' })) if (d[k] !== undefined) { sets.push(`${col}=?`); p.push(d[k] ?? null); }
  if (sets.length) { sets.push('updated_at=CURRENT_TIMESTAMP(3)'); p.push(id); await getPool().query(`UPDATE canteens SET ${sets.join(',')} WHERE id=?`, p); }
  return getCanteenById(id);
}

async function listCanteensByOrgIds(orgIds) {
  if (!orgIds || !orgIds.length) return [];
  const placeholders = orgIds.map(() => '?').join(',');
  const [r] = await getPool().query(`SELECT * FROM canteens WHERE org_id IN (${placeholders}) ORDER BY id DESC`, orgIds);
  return r.map(mapCanteen);
}

async function getCanteenOrgId(canteenId) {
  const [r] = await getPool().query('SELECT org_id FROM canteens WHERE id=?', [canteenId]);
  return r[0] ? r[0].org_id : null;
}
async function deleteCanteen(id) { const [x] = await getPool().query('DELETE FROM canteens WHERE id=?', [id]); return x.affectedRows > 0; }

/* ----------------------------- 长者 ----------------------------- */
async function listElders({ canteenId, subsidyLevel, status, keyword } = {}) {
  const w = []; const p = [];
  if (canteenId !== undefined) { w.push('canteen_id=?'); p.push(canteenId); }
  if (subsidyLevel) { w.push('subsidy_level=?'); p.push(subsidyLevel); }
  if (status) { w.push('status=?'); p.push(status); }
  if (keyword) { w.push('(code LIKE ? OR name LIKE ? OR phone LIKE ?)'); const k = `%${keyword}%`; p.push(k, k, k); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM elders ${c} ORDER BY id DESC`, p); return r.map(mapElder);
}
async function getElderById(id) { const [r] = await getPool().query('SELECT * FROM elders WHERE id=?', [id]); return mapElder(r[0]); }
async function getElderByCode(code) { const [r] = await getPool().query('SELECT * FROM elders WHERE code=?', [code]); return mapElder(r[0]); }
async function createElder(d) {
  const [x] = await getPool().query('INSERT INTO elders (code,name,gender,age,id_card,phone,health_record,subsidy_level,dietary,canteen_id,status) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
    [d.code, d.name, d.gender || 'U', d.age || 0, d.idCard || '', d.phone || '', d.healthRecord || '', d.subsidyLevel || 'C', d.dietary || '', d.canteenId ?? null, d.status || 'ACTIVE']);
  return getElderById(x.insertId);
}
async function updateElder(id, d) {
  const map = { name: 'name', gender: 'gender', age: 'age', idCard: 'id_card', phone: 'phone', healthRecord: 'health_record', subsidyLevel: 'subsidy_level', dietary: 'dietary', canteenId: 'canteen_id', status: 'status' };
  const sets = []; const p = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col}=?`); p.push(d[k]); }
  if (sets.length) { sets.push('updated_at=CURRENT_TIMESTAMP(3)'); p.push(id); await getPool().query(`UPDATE elders SET ${sets.join(',')} WHERE id=?`, p); }
  return getElderById(id);
}
async function deleteElder(id) { const [x] = await getPool().query('DELETE FROM elders WHERE id=?', [id]); return x.affectedRows > 0; }

async function listEldersByCanteenIds(canteenIds, { subsidyLevel, status, keyword } = {}) {
  if (!canteenIds || !canteenIds.length) return [];
  const w = [`canteen_id IN (${canteenIds.map(() => '?').join(',')})`];
  const p = [...canteenIds];
  if (subsidyLevel) { w.push('subsidy_level=?'); p.push(subsidyLevel); }
  if (status) { w.push('status=?'); p.push(status); }
  if (keyword) { w.push('(code LIKE ? OR name LIKE ? OR phone LIKE ?)'); const k = `%${keyword}%`; p.push(k, k, k); }
  const [r] = await getPool().query(`SELECT * FROM elders WHERE ${w.join(' AND ')} ORDER BY id DESC`, p);
  return r.map(mapElder);
}

async function getElderCanteenId(elderId) {
  const [r] = await getPool().query('SELECT canteen_id FROM elders WHERE id=?', [elderId]);
  return r[0] ? r[0].canteen_id : null;
}

/* ----------------------------- 餐次 ----------------------------- */
async function listMeals({ canteenId, serveDate, mealType, status } = {}) {
  const w = []; const p = [];
  if (canteenId !== undefined) { w.push('canteen_id=?'); p.push(canteenId); }
  if (serveDate) { w.push('serve_date=?'); p.push(serveDate); }
  if (mealType) { w.push('meal_type=?'); p.push(mealType); }
  if (status) { w.push('status=?'); p.push(status); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM meals ${c} ORDER BY serve_date DESC, id DESC`, p); return r.map(mapMeal);
}
async function getMealById(id) { const [r] = await getPool().query('SELECT * FROM meals WHERE id=?', [id]); return mapMeal(r[0]); }
async function createMeal(d) {
  const [x] = await getPool().query('INSERT INTO meals (canteen_id,serve_date,meal_type,dish_name,price_cents,status) VALUES (?,?,?,?,?,?)',
    [d.canteenId, d.serveDate, d.mealType || 'LUNCH', d.dishName, d.priceCents || 0, d.status || 'PUBLISHED']);
  return getMealById(x.insertId);
}
async function updateMeal(id, d) {
  const map = { serveDate: 'serve_date', mealType: 'meal_type', dishName: 'dish_name', priceCents: 'price_cents', status: 'status' };
  const sets = []; const p = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col}=?`); p.push(d[k]); }
  if (sets.length) { sets.push('updated_at=CURRENT_TIMESTAMP(3)'); p.push(id); await getPool().query(`UPDATE meals SET ${sets.join(',')} WHERE id=?`, p); }
  return getMealById(id);
}
async function deleteMeal(id) { const [x] = await getPool().query('DELETE FROM meals WHERE id=?', [id]); return x.affectedRows > 0; }

async function listMealsByCanteenIds(canteenIds, { serveDate, mealType, status } = {}) {
  if (!canteenIds || !canteenIds.length) return [];
  const w = [`canteen_id IN (${canteenIds.map(() => '?').join(',')})`];
  const p = [...canteenIds];
  if (serveDate) { w.push('serve_date=?'); p.push(serveDate); }
  if (mealType) { w.push('meal_type=?'); p.push(mealType); }
  if (status) { w.push('status=?'); p.push(status); }
  const [r] = await getPool().query(`SELECT * FROM meals WHERE ${w.join(' AND ')} ORDER BY serve_date DESC, id DESC`, p);
  return r.map(mapMeal);
}

async function getMealCanteenId(mealId) {
  const [r] = await getPool().query('SELECT canteen_id FROM meals WHERE id=?', [mealId]);
  return r[0] ? r[0].canteen_id : null;
}

/* ----------------------------- 订餐 ----------------------------- */
async function listOrders({ elderId, mealId, status } = {}) {
  const w = []; const p = [];
  if (elderId !== undefined) { w.push('elder_id=?'); p.push(elderId); }
  if (mealId !== undefined) { w.push('meal_id=?'); p.push(mealId); }
  if (status) { w.push('status=?'); p.push(status); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM orders ${c} ORDER BY id DESC`, p); return r.map(mapOrder);
}
async function getOrderById(id) { const [r] = await getPool().query('SELECT * FROM orders WHERE id=?', [id]); return mapOrder(r[0]); }
async function createOrder(d) {
  const [x] = await getPool().query('INSERT INTO orders (elder_id,meal_id,dining_type,qty,amount_cents,subsidy_cents,pay_cents,status) VALUES (?,?,?,?,?,?,?,?)',
    [d.elderId, d.mealId, d.diningType || 'DINE_IN', d.qty || 1, d.amountCents || 0, d.subsidyCents || 0, d.payCents || 0, d.status || 'RESERVED']);
  return getOrderById(x.insertId);
}
async function updateOrder(id, d) {
  const map = { diningType: 'dining_type', qty: 'qty', amountCents: 'amount_cents', subsidyCents: 'subsidy_cents', payCents: 'pay_cents', status: 'status' };
  const sets = []; const p = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col}=?`); p.push(d[k]); }
  if (sets.length) { sets.push('updated_at=CURRENT_TIMESTAMP(3)'); p.push(id); await getPool().query(`UPDATE orders SET ${sets.join(',')} WHERE id=?`, p); }
  return getOrderById(id);
}

async function listOrdersByElderIds(elderIds, { status } = {}) {
  if (!elderIds || !elderIds.length) return [];
  const w = [`elder_id IN (${elderIds.map(() => '?').join(',')})`];
  const p = [...elderIds];
  if (status) { w.push('status=?'); p.push(status); }
  const [r] = await getPool().query(`SELECT * FROM orders WHERE ${w.join(' AND ')} ORDER BY id DESC`, p);
  return r.map(mapOrder);
}

async function getOrderElderId(orderId) {
  const [r] = await getPool().query('SELECT elder_id FROM orders WHERE id=?', [orderId]);
  return r[0] ? r[0].elder_id : null;
}

/* ----------------------------- 权限策略 ----------------------------- */
async function listPermissionPolicies({ resourceType, action, role, status } = {}) {
  const w = []; const p = [];
  if (resourceType) { w.push('resource_type=?'); p.push(resourceType); }
  if (action) { w.push('action=?'); p.push(action); }
  if (role) { w.push('role=?'); p.push(role); }
  if (status) { w.push('status=?'); p.push(status); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM permission_policies ${c} ORDER BY id`, p);
  return r.map(mapPermissionPolicy);
}
async function getPermissionPolicyById(id) { const [r] = await getPool().query('SELECT * FROM permission_policies WHERE id=?', [id]); return mapPermissionPolicy(r[0]); }
async function getPermissionPolicyByName(name) { const [r] = await getPool().query('SELECT * FROM permission_policies WHERE name=?', [name]); return mapPermissionPolicy(r[0]); }
async function createPermissionPolicy(d) {
  const [x] = await getPool().query('INSERT INTO permission_policies (name,resource_type,action,role,data_scope,min_sensitivity,status) VALUES (?,?,?,?,?,?,?)',
    [d.name, d.resourceType, d.action, d.role, d.scope || 'ORG_AND_DESCENDANTS', d.minSensitivity || 'PUBLIC', d.status || 'ACTIVE']);
  return getPermissionPolicyById(x.insertId);
}
async function updatePermissionPolicy(id, d) {
  const map = { name: 'name', resourceType: 'resource_type', action: 'action', role: 'role', scope: 'data_scope', minSensitivity: 'min_sensitivity', status: 'status' };
  const sets = []; const p = [];
  for (const [k, col] of Object.entries(map)) if (d[k] !== undefined) { sets.push(`${col}=?`); p.push(d[k]); }
  if (sets.length) { sets.push('updated_at=CURRENT_TIMESTAMP(3)'); p.push(id); await getPool().query(`UPDATE permission_policies SET ${sets.join(',')} WHERE id=?`, p); }
  return getPermissionPolicyById(id);
}
async function deletePermissionPolicy(id) { const [x] = await getPool().query('DELETE FROM permission_policies WHERE id=?', [id]); return x.affectedRows > 0; }

/* ----------------------------- 审计日志 ----------------------------- */
async function createAuditLog(d) {
  const [x] = await getPool().query('INSERT INTO audit_logs (user_id,username,action,resource_type,resource_id,field_name,old_value,new_value,ip_address,user_agent) VALUES (?,?,?,?,?,?,?,?,?,?)',
    [d.userId ?? null, d.username, d.action, d.resourceType, String(d.resourceId), d.fieldName ?? null, d.oldValue ?? null, d.newValue ?? null, d.ipAddress ?? null, d.userAgent ?? null]);
  return x.insertId;
}
async function listAuditLogs({ userId, resourceType, resourceId, action, startTime, endTime, limit = 100, offset = 0 } = {}) {
  const w = []; const p = [];
  if (userId !== undefined) { w.push('user_id=?'); p.push(userId); }
  if (resourceType) { w.push('resource_type=?'); p.push(resourceType); }
  if (resourceId !== undefined) { w.push('resource_id=?'); p.push(String(resourceId)); }
  if (action) { w.push('action=?'); p.push(action); }
  if (startTime) { w.push('created_at>=?'); p.push(startTime); }
  if (endTime) { w.push('created_at<=?'); p.push(endTime); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT * FROM audit_logs ${c} ORDER BY id DESC LIMIT ? OFFSET ?`, [...p, limit, offset]);
  return r.map(mapAuditLog);
}
async function countAuditLogs({ userId, resourceType, resourceId, action, startTime, endTime } = {}) {
  const w = []; const p = [];
  if (userId !== undefined) { w.push('user_id=?'); p.push(userId); }
  if (resourceType) { w.push('resource_type=?'); p.push(resourceType); }
  if (resourceId !== undefined) { w.push('resource_id=?'); p.push(String(resourceId)); }
  if (action) { w.push('action=?'); p.push(action); }
  if (startTime) { w.push('created_at>=?'); p.push(startTime); }
  if (endTime) { w.push('created_at<=?'); p.push(endTime); }
  const c = w.length ? `WHERE ${w.join(' AND ')}` : '';
  const [r] = await getPool().query(`SELECT COUNT(*) AS n FROM audit_logs ${c}`, p);
  return r[0].n;
}

module.exports = {
  mapUser, mapOrganization, mapCanteen, mapElder, mapMeal, mapOrder, mapPermissionPolicy, mapAuditLog,
  getUserByUsername, getUserById, listUsers, createUser, updateUser, deleteUser, countUsers,
  getOrganizationById, getOrganizationByCode, listOrganizations, createOrganization, updateOrganization, deleteOrganization, getDescendantOrgIds,
  listCanteens, getCanteenById, getCanteenByCode, createCanteen, updateCanteen, deleteCanteen, listCanteensByOrgIds, getCanteenOrgId,
  listElders, getElderById, getElderByCode, createElder, updateElder, deleteElder, listEldersByCanteenIds, getElderCanteenId,
  listMeals, getMealById, createMeal, updateMeal, deleteMeal, listMealsByCanteenIds, getMealCanteenId,
  listOrders, getOrderById, createOrder, updateOrder, listOrdersByElderIds, getOrderElderId,
  listPermissionPolicies, getPermissionPolicyById, getPermissionPolicyByName, createPermissionPolicy, updatePermissionPolicy, deletePermissionPolicy,
  createAuditLog, listAuditLogs, countAuditLogs,
};
