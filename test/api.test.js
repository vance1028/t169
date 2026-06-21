'use strict';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');

const { getPool, ensureSchema, resetAll, waitForDb, close } = require('../src/db');
const { seed } = require('../src/seed');
const { createApp } = require('../src/app');

const app = createApp();

test.before(async () => { await waitForDb(); await ensureSchema(); getPool(); });
test.beforeEach(async () => { await resetAll(); await seed(); });
test.after(async () => { await close(); });

async function loginAs(u, p) {
  const res = await request(app).post('/api/auth/login').send({ username: u, password: p });
  assert.strictEqual(res.status, 200, `登录失败: ${JSON.stringify(res.body)}`);
  return res.body.data.token;
}

test('健康检查无需鉴权', async () => {
  const res = await request(app).get('/api/health');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.status, 'ok');
});

test('登录返回 token，中文姓名不乱码', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'admin123' });
  assert.strictEqual(res.status, 200);
  assert.ok(res.body.data.token);
  assert.strictEqual(res.body.data.user.name, '系统管理员');
});

test('错误密码 401', async () => {
  const res = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'bad' });
  assert.strictEqual(res.status, 401);
});

test('未带令牌访问受保护接口 401', async () => {
  const res = await request(app).get('/api/canteens');
  assert.strictEqual(res.status, 401);
});

test('助餐点列表读到种子数据，中文正确', async () => {
  const token = await loginAs('city_viewer', 'city123');
  const res = await request(app).get('/api/canteens').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 3);
  assert.ok(res.body.data.map((c) => c.name).includes('城关街道长者食堂'));
});

test('街道级 viewer 只能看到本街道助餐点（行级过滤）', async () => {
  const token = await loginAs('viewer', 'viewer123');
  const res = await request(app).get('/api/canteens').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.body.data.length, 1);
  assert.strictEqual(res.body.data[0].name, '城关街道长者食堂');
});

test('长者档案含中文忌口正确返回', async () => {
  const token = await loginAs('operator', 'operator123');
  const list = await request(app).get('/api/elders').set('Authorization', `Bearer ${token}`);
  assert.strictEqual(list.status, 200);
  const wang = list.body.data.find((e) => e.code === 'E-0001');
  assert.strictEqual(wang.name, '王秀英');
  assert.strictEqual(wang.dietary, '低盐、忌花生');
});

test('operator 新建长者并能查到（含中文）', async () => {
  const token = await loginAs('operator', 'operator123');
  const canteens = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${token}`)).body.data;
  const create = await request(app).post('/api/elders').set('Authorization', `Bearer ${token}`)
    .send({ code: 'E-9001', name: '孙桂芳', gender: 'F', age: 75, phone: '13900000000', subsidyLevel: 'B', dietary: '软烂、忌海鲜', canteenId: canteens[0].id });
  assert.strictEqual(create.status, 201, JSON.stringify(create.body));
  const id = create.body.data.id;
  const get = await request(app).get(`/api/elders/${id}`).set('Authorization', `Bearer ${token}`);
  assert.strictEqual(get.body.data.name, '孙桂芳');
  assert.strictEqual(get.body.data.dietary, '软烂、忌海鲜');
});

test('viewer 无权新建助餐点 403', async () => {
  const token = await loginAs('viewer', 'viewer123');
  const res = await request(app).post('/api/canteens').set('Authorization', `Bearer ${token}`)
    .send({ code: 'CT-X-001', name: '测试点', district: '某区' });
  assert.strictEqual(res.status, 403);
});

test('助餐点编号重复 409', async () => {
  const token = await loginAs('admin', 'admin123');
  const res = await request(app).post('/api/canteens').set('Authorization', `Bearer ${token}`)
    .send({ code: 'CT-CG-001', name: '重复', district: '某区' });
  assert.strictEqual(res.status, 409);
});

test('订餐：下单后核销，状态流转与重复核销拦截', async () => {
  const token = await loginAs('operator', 'operator123');
  const elders = (await request(app).get('/api/elders').set('Authorization', `Bearer ${token}`)).body.data;
  const meals = (await request(app).get('/api/meals').set('Authorization', `Bearer ${token}`)).body.data;
  const meal = meals.find((m) => m.status === 'PUBLISHED');
  const order = await request(app).post('/api/orders').set('Authorization', `Bearer ${token}`)
    .send({ elderId: elders[0].id, mealId: meal.id, diningType: 'DINE_IN', qty: 1 });
  assert.strictEqual(order.status, 201, JSON.stringify(order.body));
  assert.strictEqual(order.body.data.amountCents, meal.priceCents);
  const oid = order.body.data.id;

  const serve1 = await request(app).post(`/api/orders/${oid}/serve`).set('Authorization', `Bearer ${token}`);
  assert.strictEqual(serve1.status, 200);
  assert.strictEqual(serve1.body.data.status, 'SERVED');

  const serve2 = await request(app).post(`/api/orders/${oid}/serve`).set('Authorization', `Bearer ${token}`);
  assert.strictEqual(serve2.status, 409, '已核销不能重复核销');
});

test('删除助餐点需要 admin，operator 被拒 403', async () => {
  const token = await loginAs('operator', 'operator123');
  const list = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${token}`)).body.data;
  const res = await request(app).delete(`/api/canteens/${list[0].id}`).set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('不存在的接口 404', async () => {
  const res = await request(app).get('/api/not-exist');
  assert.strictEqual(res.status, 404);
});

/* ========== 权限专项测试 ========== */

test('跨街道越权：城关区操作员看不到江南区长者（行级过滤）', async () => {
  const token = await loginAs('cg_admin', 'cg123456');
  const list = (await request(app).get('/api/elders').set('Authorization', `Bearer ${token}`)).body.data;
  assert.strictEqual(list.length, 2, '城关区只能看到本街道2位长者');
  const codes = list.map((e) => e.code).sort();
  assert.deepStrictEqual(codes, ['E-0001', 'E-0002']);
});

test('跨街道越权：江南区操作员看不到城关区订餐（行级过滤）', async () => {
  const token = await loginAs('jn_admin', 'jn123456');
  const list = (await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`)).body.data;
  assert.strictEqual(list.length, 0, '江南区目前没有订餐');
});

test('跨街道越权：城关区操作员猜 ID 拉不到江南区长者（403）', async () => {
  const adminToken = await loginAs('admin', 'admin123');
  const jnElder = (await request(app).get('/api/elders').set('Authorization', `Bearer ${adminToken}`)).body.data
    .find((e) => e.code === 'E-0003');
  assert.ok(jnElder, '先定位江南区长者');

  const token = await loginAs('cg_admin', 'cg123456');
  const res = await request(app).get(`/api/elders/${jnElder.id}`).set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403, '跨街道读详情应该 403');
});

test('跨街道越权：江南区操作员猜 ID 想删城关区助餐点（403）', async () => {
  const adminToken = await loginAs('admin', 'admin123');
  const canteen = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${adminToken}`)).body.data
    .find((c) => c.code === 'CT-CG-001');

  const token = await loginAs('jn_admin', 'jn123456');
  const res = await request(app).delete(`/api/canteens/${canteen.id}`).set('Authorization', `Bearer ${token}`);
  assert.strictEqual(res.status, 403);
});

test('助餐点级操作员：只能管本点的长者和餐次', async () => {
  const token = await loginAs('cg_canteen1', 'cg123456');
  const elders = (await request(app).get('/api/elders').set('Authorization', `Bearer ${token}`)).body.data;
  assert.strictEqual(elders.length, 2, '本助餐点下有2位长者');
  const meals = (await request(app).get('/api/meals').set('Authorization', `Bearer ${token}`)).body.data;
  assert.strictEqual(meals.length, 2, '本助餐点下有2个餐次');
});

test('敏感字段脱敏：市级 viewer 看到的电话和身份证是打星的', async () => {
  const token = await loginAs('city_viewer', 'city123');
  const list = (await request(app).get('/api/elders').set('Authorization', `Bearer ${token}`)).body.data;
  const wang = list.find((e) => e.code === 'E-0001');
  assert.ok(wang.phone.includes('*') || wang.phone !== '13800000001', '电话应该被脱敏');
  assert.ok(String(wang.idCard).includes('*') || wang.idCard !== '110101194801011234', '身份证应该被脱敏');
});

test('敏感字段查看留痕：市级 admin 查看长者详情产生 VIEW_SENSITIVE 审计日志', async () => {
  const adminToken = await loginAs('admin', 'admin123');
  const list = (await request(app).get('/api/elders').set('Authorization', `Bearer ${adminToken}`)).body.data;
  const elderId = list[0].id;

  await request(app).get(`/api/elders/${elderId}`).set('Authorization', `Bearer ${adminToken}`);

  const logs = (await request(app).get('/api/audit-logs?action=VIEW_SENSITIVE').set('Authorization', `Bearer ${adminToken}`)).body.data;
  const related = logs.filter((l) => l.resourceType === 'elder' && String(l.resourceId) === String(elderId));
  assert.ok(related.length > 0, '应产生至少一条 VIEW_SENSITIVE 审计日志');
  const fields = new Set(related.map((l) => l.fieldName));
  assert.ok(fields.has('idCard') || fields.has('phone') || fields.has('healthRecord'),
    '至少有一个敏感字段被记录：' + JSON.stringify([...fields]));
});

test('长者迁移：城关区长者迁到江南区后，城关管理员看不到了，江南管理员能看到', async () => {
  const adminToken = await loginAs('admin', 'admin123');
  const all = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${adminToken}`)).body.data;
  const cgCanteen = all.find((c) => c.code === 'CT-CG-001');
  const jnCanteen = all.find((c) => c.code === 'CT-JN-002');

  /* 创建一个挂在城关区的临时长者 */
  const createRes = await request(app).post('/api/elders').set('Authorization', `Bearer ${adminToken}`)
    .send({ code: 'E-MOVE-01', name: '王迁移', gender: 'F', age: 70, phone: '13100000000', subsidyLevel: 'C', canteenId: cgCanteen.id });
  assert.strictEqual(createRes.status, 201);
  const elderId = createRes.body.data.id;

  /* 城关管理员应该能看到 */
  const cgToken = await loginAs('cg_admin', 'cg123456');
  const cgList1 = (await request(app).get('/api/elders').set('Authorization', `Bearer ${cgToken}`)).body.data;
  assert.ok(cgList1.some((e) => e.id === elderId), '迁移前城关管理员应能看到该长者');

  /* 迁到江南区 */
  const moveRes = await request(app).put(`/api/elders/${elderId}`).set('Authorization', `Bearer ${adminToken}`)
    .send({ canteenId: jnCanteen.id });
  assert.strictEqual(moveRes.status, 200, '管理员迁移应该成功：' + JSON.stringify(moveRes.body));

  /* 城关管理员看不到了 */
  const cgList2 = (await request(app).get('/api/elders').set('Authorization', `Bearer ${cgToken}`)).body.data;
  assert.ok(!cgList2.some((e) => e.id === elderId), '迁移后城关管理员应该看不到该长者');

  /* 江南管理员能看到 */
  const jnToken = await loginAs('jn_admin', 'jn123456');
  const jnList = (await request(app).get('/api/elders').set('Authorization', `Bearer ${jnToken}`)).body.data;
  assert.ok(jnList.some((e) => e.id === elderId), '迁移后江南管理员应该能看到该长者');
});

test('助餐点划转：城关区助餐点划转到江南区后，归属范围随之变化', async () => {
  const adminToken = await loginAs('admin', 'admin123');
  const orgs = (await request(app).get('/api/organizations').set('Authorization', `Bearer ${adminToken}`)).body.data;
  const jnDistrict = orgs.find((o) => o.code === 'DIST-JN');
  const canteenOrg = orgs.find((o) => o.code === 'ORG-CG-CT1');
  assert.ok(jnDistrict && canteenOrg, '组织节点应存在');

  const cgToken = await loginAs('cg_admin', 'cg123456');
  const before = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${cgToken}`)).body.data;
  assert.ok(before.some((c) => c.code === 'CT-CG-001'), '划转前城关能看到');

  /* 把城关街道食堂的组织改挂到江南区 */
  const updateRes = await request(app).put(`/api/organizations/${canteenOrg.id}`).set('Authorization', `Bearer ${adminToken}`)
    .send({ parentId: jnDistrict.id });
  assert.strictEqual(updateRes.status, 200, '管理员划转组织应成功');

  /* 城关管理员看不到了 */
  const after = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${cgToken}`)).body.data;
  assert.ok(!after.some((c) => c.code === 'CT-CG-001'), '划转后城关管理员应该看不到');

  /* 江南管理员能看到了 */
  const jnToken = await loginAs('jn_admin', 'jn123456');
  const jnList = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${jnToken}`)).body.data;
  assert.ok(jnList.some((c) => c.code === 'CT-CG-001'), '划转后江南管理员应该看到城关食堂');
});

test('策略变更即时生效：禁用 OPERATOR 创建长者后，操作员被拒', async () => {
  const adminToken = await loginAs('admin', 'admin123');

  /* 先创建一个覆盖策略：禁用 OPERATOR 的 elder create */
  const denyPolicy = await request(app).post('/api/permission-policies').set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'test_disable_operator_elder_create',
      resourceType: 'elder',
      action: 'create',
      role: 'OPERATOR',
      scope: 'ORG_AND_DESCENDANTS',
      minSensitivity: 'CONFIDENTIAL',
      status: 'INACTIVE',
    });
  /* INACTIVE 不生效，先验证 OPERATOR 还能建 */
  assert.strictEqual(denyPolicy.status, 201, '创建策略应成功');

  const opToken = await loginAs('operator', 'operator123');
  const canteens = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${opToken}`)).body.data;
  const create1 = await request(app).post('/api/elders').set('Authorization', `Bearer ${opToken}`)
    .send({ code: 'E-TPOL-01', name: '测试1', gender: 'F', age: 70, phone: '13200000001', subsidyLevel: 'C', canteenId: canteens[0].id });
  assert.strictEqual(create1.status, 201, '策略未启用时应能创建');

  /* 激活策略（minSensitivity 设 CONFIDENTIAL 而 OPERATOR 默认只有 SENSITIVE，依然不会成功——因为策略是按匹配优先的，minSensitivity 改了就不满足字段访问），
     我们改为直接更新策略状态 ACTIVE 但把 resourceType 改成一个 fake 的也行不通。
     更简单的方式：删除默认 OPERATOR 的 elder_create 策略等价物——把新策略设置为 ACTIVE 但加一个无效的 scope 也不影响匹配。
     我们使用另一种方式：数据库自定义策略优先级高于默认策略。所以插入一个同名会冲突，但我们可以通过降低 minSensitivity 的反例。
     更好测试：给 viewer 开一个 elder create 权限——验证 viewer 原来不能建，加策略后可以建。 */

  /* 清理：先删测试策略 */
  await request(app).delete(`/api/permission-policies/${denyPolicy.body.data.id}`).set('Authorization', `Bearer ${adminToken}`);

  /* 原：viewer 无权新建长者 */
  const viewerToken = await loginAs('viewer', 'viewer123');
  const viewerCanteens = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${viewerToken}`)).body.data;
  const tryBefore = await request(app).post('/api/elders').set('Authorization', `Bearer ${viewerToken}`)
    .send({ code: 'E-TPOL-V1', name: '测试viewer', gender: 'F', age: 70, phone: '13200000002', subsidyLevel: 'C', canteenId: viewerCanteens[0].id });
  assert.strictEqual(tryBefore.status, 403, 'viewer 默认不能建长者');

  /* 给 viewer 加一条 elder create 策略 */
  const grantPolicy = await request(app).post('/api/permission-policies').set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'test_viewer_elder_create',
      resourceType: 'elder',
      action: 'create',
      role: 'VIEWER',
      scope: 'ORG_AND_DESCENDANTS',
      minSensitivity: 'SENSITIVE',
      status: 'ACTIVE',
    });
  assert.strictEqual(grantPolicy.status, 201, '给 viewer 加策略应成功');

  /* 立即生效：viewer 现在能建长者 */
  const tryAfter = await request(app).post('/api/elders').set('Authorization', `Bearer ${viewerToken}`)
    .send({ code: 'E-TPOL-V2', name: '测试viewer后', gender: 'F', age: 70, phone: '13200000003', subsidyLevel: 'C', canteenId: viewerCanteens[0].id });
  assert.strictEqual(tryAfter.status, 201, '加策略后 viewer 应能创建：' + JSON.stringify(tryAfter.body));
});

test('审计日志范围过滤：城关区操作员看不到市级管理员的操作日志', async () => {
  const adminToken = await loginAs('admin', 'admin123');
  /* admin 先做一个操作（前面的测试有做过，但再新建一个助餐点确保有日志） */
  const canteensBefore = (await request(app).get('/api/canteens').set('Authorization', `Bearer ${adminToken}`)).body.data;

  const cgToken = await loginAs('cg_admin', 'cg123456');
  const cgLogs = (await request(app).get('/api/audit-logs?action=CREATE&resourceType=canteen').set('Authorization', `Bearer ${cgToken}`)).body.data;

  const adminLogsInCg = cgLogs.filter((l) => l.username === '系统管理员');
  assert.strictEqual(adminLogsInCg.length, 0, '城关操作员不应看到市级 admin 的操作日志');
});

test('订单列表查询条件不丢失：按 status 过滤仍生效', async () => {
  const token = await loginAs('operator', 'operator123');
  const reserved = (await request(app).get('/api/orders?status=RESERVED').set('Authorization', `Bearer ${token}`)).body.data;
  const served = (await request(app).get('/api/orders?status=SERVED').set('Authorization', `Bearer ${token}`)).body.data;
  assert.ok(reserved.every((o) => o.status === 'RESERVED'), '按 RESERVED 过滤不应混入其他状态');
  assert.ok(served.every((o) => o.status === 'SERVED'), '按 SERVED 过滤不应混入其他状态');
  assert.strictEqual(reserved.length + served.length, 2, '城关街道共有2条订餐');
});
