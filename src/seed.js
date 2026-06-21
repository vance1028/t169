'use strict';

const store = require('./data/store');

/**
 * 种子数据：
 * - 组织层级：市级民政 → 街道 → 助餐点
 * - 用户账号：市级管理员、街道管理员、助餐点操作员、观察员
 * - 助餐点、长者、餐次与订餐
 * - 权限策略
 */
async function seed() {
  if ((await store.countUsers()) > 0) return { skipped: true };

  const cityOrg = await store.createOrganization({
    code: 'CITY-001',
    name: '市民政局养老服务处',
    type: 'CITY',
    parentId: null,
  });

  const district1 = await store.createOrganization({
    code: 'DIST-CG',
    name: '城关区民政局',
    type: 'DISTRICT',
    parentId: cityOrg.id,
  });

  const district2 = await store.createOrganization({
    code: 'DIST-JN',
    name: '江南区民政局',
    type: 'DISTRICT',
    parentId: cityOrg.id,
  });

  const district3 = await store.createOrganization({
    code: 'DIST-GX',
    name: '高新区民政办',
    type: 'DISTRICT',
    parentId: cityOrg.id,
  });

  await store.createUser({
    username: 'admin',
    password: 'admin123',
    name: '系统管理员',
    role: 'ADMIN',
    orgId: cityOrg.id,
  });

  await store.createUser({
    username: 'city_viewer',
    password: 'city123',
    name: '市级观察员',
    role: 'VIEWER',
    orgId: cityOrg.id,
  });

  await store.createUser({
    username: 'cg_admin',
    password: 'cg123456',
    name: '城关区管理员',
    role: 'OPERATOR',
    orgId: district1.id,
  });

  await store.createUser({
    username: 'jn_admin',
    password: 'jn123456',
    name: '江南区管理员',
    role: 'OPERATOR',
    orgId: district2.id,
  });

  await store.createUser({
    username: 'viewer',
    password: 'viewer123',
    name: '李社工',
    role: 'VIEWER',
    orgId: district1.id,
  });

  /* 助餐点级组织节点 */
  const canteenOrg1 = await store.createOrganization({
    code: 'ORG-CG-CT1',
    name: '城关街道长者食堂',
    type: 'CANTEEN',
    parentId: district1.id,
  });
  const canteenOrg2 = await store.createOrganization({
    code: 'ORG-JN-CT1',
    name: '江南社区助餐点',
    type: 'CANTEEN',
    parentId: district2.id,
  });
  const canteenOrg3 = await store.createOrganization({
    code: 'ORG-GX-CT1',
    name: '高新颐养中心餐厅',
    type: 'CANTEEN',
    parentId: district3.id,
  });

  const c1 = await store.createCanteen({
    code: 'CT-CG-001',
    name: '城关街道长者食堂',
    district: '城关区',
    orgId: canteenOrg1.id,
    address: '幸福路12号',
    capacity: 80,
    status: 'OPEN',
  });
  const c2 = await store.createCanteen({
    code: 'CT-JN-002',
    name: '江南社区助餐点',
    district: '江南区',
    orgId: canteenOrg2.id,
    address: '滨河东路5号',
    capacity: 50,
    status: 'OPEN',
  });
  await store.createCanteen({
    code: 'CT-GX-003',
    name: '高新颐养中心餐厅',
    district: '高新区',
    orgId: canteenOrg3.id,
    address: '科苑路88号',
    capacity: 60,
    status: 'CLOSED',
  });

  await store.createUser({
    username: 'operator',
    password: 'operator123',
    name: '张师傅',
    role: 'OPERATOR',
    orgId: district1.id,
  });

  /* 归属到助餐点级的工作人员 */
  await store.createUser({
    username: 'cg_canteen1',
    password: 'cg123456',
    name: '城关一店刘姨',
    role: 'OPERATOR',
    orgId: canteenOrg1.id,
  });
  await store.createUser({
    username: 'jn_canteen1',
    password: 'jn123456',
    name: '江南一店王叔',
    role: 'OPERATOR',
    orgId: canteenOrg2.id,
  });
  await store.createUser({
    username: 'cg_viewer1',
    password: 'cg123456',
    name: '城关一店观察员',
    role: 'VIEWER',
    orgId: canteenOrg1.id,
  });

  const e1 = await store.createElder({
    code: 'E-0001',
    name: '王秀英',
    gender: 'F',
    age: 78,
    idCard: '110101194801011234',
    phone: '13800000001',
    healthRecord: '高血压、糖尿病史，长期服药',
    subsidyLevel: 'A',
    dietary: '低盐、忌花生',
    canteenId: c1.id,
  });
  const e2 = await store.createElder({
    code: 'E-0002',
    name: '赵建国',
    gender: 'M',
    age: 82,
    idCard: '110101194405055678',
    phone: '13800000002',
    healthRecord: '冠心病、关节炎',
    subsidyLevel: 'B',
    dietary: '糖尿病、少糖',
    canteenId: c1.id,
  });
  await store.createElder({
    code: 'E-0003',
    name: '陈桂兰',
    gender: 'F',
    age: 69,
    idCard: '110102195708089012',
    phone: '13800000003',
    healthRecord: '健康状况良好',
    subsidyLevel: 'C',
    dietary: '',
    canteenId: c2.id,
  });

  const m1 = await store.createMeal({
    canteenId: c1.id,
    serveDate: '2026-06-18',
    mealType: 'LUNCH',
    dishName: '清蒸鲈鱼套餐',
    priceCents: 1500,
    status: 'PUBLISHED',
  });
  const m2 = await store.createMeal({
    canteenId: c1.id,
    serveDate: '2026-06-18',
    mealType: 'DINNER',
    dishName: '番茄牛腩面',
    priceCents: 1200,
    status: 'PUBLISHED',
  });
  await store.createMeal({
    canteenId: c2.id,
    serveDate: '2026-06-18',
    mealType: 'LUNCH',
    dishName: '香菇鸡肉饭',
    priceCents: 1300,
    status: 'PUBLISHED',
  });

  const o1 = await store.createOrder({
    elderId: e1.id,
    mealId: m1.id,
    diningType: 'DINE_IN',
    qty: 1,
    amountCents: 1500,
    subsidyCents: 900,
    payCents: 600,
    status: 'RESERVED',
  });
  await store.updateOrder(o1.id, { status: 'SERVED' });
  await store.createOrder({
    elderId: e2.id,
    mealId: m2.id,
    diningType: 'DELIVERY',
    qty: 1,
    amountCents: 1200,
    subsidyCents: 600,
    payCents: 600,
    status: 'RESERVED',
  });

  return {
    skipped: false,
    organizations: 7,
    users: 9,
    canteens: 3,
    elders: 3,
    meals: 3,
    orders: 2,
  };
}

if (require.main === module) {
  const { getPool, ensureSchema, waitForDb, close } = require('./db');
  (async () => {
    await waitForDb();
    await ensureSchema();
    getPool();
    const result = await seed();
    // eslint-disable-next-line no-console
    console.log('种子数据写入结果:', JSON.stringify(result));
    await close();
  })().catch((e) => { console.error(e); process.exit(1); });
}

module.exports = { seed };

