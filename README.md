# 社区长者助餐运营管理平台 - 后端 API

纯后端 REST API 服务，管理社区助餐点、长者档案、餐次与订餐。重点能力：**基于组织层级 + 数据归属的细粒度权限体系**，含行级过滤、字段分级脱敏、策略热更新、全链路审计留痕。

作为「功能迭代」类评测题目的基础工程：Node + Express + MySQL，docker compose 一键编排，结构清晰、留有充分扩展点。

## 技术栈

- Node.js (≥ 18) + Express 4
- MySQL 8（`mysql2/promise` 连接池，全程 utf8mb4）
- JWT（`jsonwebtoken`）+ scrypt 密码哈希
- Docker Compose；测试用 Node 内置 `node:test` + `supertest`

## 一键启动

```bash
docker compose up --build
```

- API：`http://localhost:5090`
- MySQL：宿主机 `13377` 端口
- 首次启动 `db/schema.sql` 自动建表，应用检测到空库自动写入种子数据，无需额外步骤

## 本地运行 / 测试

```bash
docker compose up -d db     # 仅起数据库
npm install
npm test                    # 测试连真实 MySQL（127.0.0.1:13377），用例前重置并播种
npm start
```

## 权限体系总览

### 判定模型
**谁（角色+组织归属） → 对哪类资源 → 在什么归属范围 → 能做什么**

权限不再只看角色，而是综合：
1. `role`：ADMIN / OPERATOR / VIEWER
2. `orgId`：用户挂在组织树哪个节点
3. `scope`：ALL（全市）/ ORG_AND_DESCENDANTS（本组织及下属）/ ORG_ONLY（仅本节点）
4. `minSensitivity`：能看到的最高敏感字段等级

### 组织层级树
```
市民政局养老服务处 (CITY)
├── 城关区民政局 (DISTRICT)
│   └── 城关街道长者食堂 (CANTEEN)
├── 江南区民政局 (DISTRICT)
│   └── 江南社区助餐点 (CANTEEN)
└── 高新区民政办 (DISTRICT)
    └── 高新颐养中心餐厅 (CANTEEN)
```
数据归属链：**助餐点 → 组织；长者/订餐/餐次 → 助餐点**

### 字段四级敏感度
| 级别 | 示例 | 默认谁能看明文 |
| --- | --- | --- |
| `PUBLIC` | 姓名、编号、性别、年龄 | 所有人 |
| `INTERNAL` | 补贴等级、忌口、金额、角色 | OPERATOR 及以上 |
| `SENSITIVE` | 手机号 | ADMIN / OPERATOR |
| `CONFIDENTIAL` | 身份证号、健康档案 | 仅 ADMIN |

不够权限时字段自动打星（`138****0001`、`********`），查看明文会留审计。

### 权限统一出口
所有路由统一走 Express 中间件（见 `src/permissions/middleware.js`），业务代码不再散落 `if (role === ...)`：

```js
router.get('/', perm.requirePermission('elder', 'list'), perm.maskResponse('elder'), ...)
router.get('/:id', perm.requireResourcePermission('elder', 'read'), perm.maskResponse('elder'), ...)
router.post('/', perm.requirePermission('elder', 'create'), ...)
router.delete('/:id', perm.requireResourcePermission('elder', 'delete'), ...)
```

- `requirePermission`：只查"角色+资源"有没有动作权限
- `requireResourcePermission`：额外校验**该具体资源的归属是否在用户范围内**（防猜 ID 越权）
- `maskResponse`：响应按 `minSensitivity` 自动脱敏
- `scopedList`：列表按归属自动做行级过滤

### 策略引擎与热更新
- 40+ 条内置默认策略（`src/permissions/engine.js` 的 `DEFAULT_POLICIES`）
- 支持数据库自定义策略，**优先级高于默认策略**
- 策略缓存 1 分钟，CRUD 后主动 `invalidatePolicyCache()`，即时生效
- 通过 `/api/permission-policies` 接口动态加/改/删/重载

### 审计留痕
- 所有 CREATE / UPDATE / DELETE 自动记录
- 敏感字段（身份证/电话/健康档案）明文查看单独记 `VIEW_SENSITIVE`
- 审计日志支持按用户归属范围过滤——街道管理员翻不到市级操作日志
- 记录字段：操作人、动作、资源类型、资源ID、字段名、旧值/新值、IP、UA、时间

## 种子账号（含归属层级）

| 用户名 | 密码 | 角色 | 归属层级 | 能力摘要 |
| --- | --- | --- | --- | --- |
| admin | admin123 | ADMIN | 市民政局 | 全市全权限，可看所有敏感明文，管理权限策略 |
| city_viewer | city123 | VIEWER | 市民政局 | 全市只读，敏感字段（身份证/电话/健康档案）脱敏 |
| cg_admin | cg123456 | OPERATOR | 城关区 | 城关区内 CRUD，能看本街道敏感明文 |
| jn_admin | jn123456 | OPERATOR | 江南区 | 江南区内 CRUD，能看本街道敏感明文 |
| operator | operator123 | OPERATOR | 城关区 | 城关区内业务操作 |
| viewer | viewer123 | VIEWER | 城关区 | 城关区内只读 |
| cg_canteen1 | cg123456 | OPERATOR | 城关街道食堂 | 仅管本助餐点（助餐点级） |
| jn_canteen1 | jn123456 | OPERATOR | 江南社区助餐点 | 仅管本助餐点（助餐点级） |
| cg_viewer1 | cg123456 | VIEWER | 城关街道食堂 | 仅看本助餐点 |

## 归属变更即时生效
- **长者迁移**：`PUT /api/elders/:id` 传 `canteenId` 即可，权限立即跟随新助餐点
- **助餐点划转**：`PUT /api/organizations/:id` 改 `parentId`（改助餐点组织的上级），或 `PUT /api/canteens/:id` 改 `orgId`
- 所有判定基于数据库实时查询，不依赖预热缓存

## 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `5090` | API 端口 |
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `13377` | MySQL 地址 |
| `DB_USER` / `DB_PASSWORD` / `DB_NAME` | `care` / `carepass` / `eldercare` | MySQL 凭据 |
| `JWT_SECRET` | `elder-canteen-dev-secret` | JWT 密钥 |
| `SEED_ON_START` | - | 设 `false` 禁用空库自动播种 |

## 数据模型

- **organizations 组织树**：`code, name, type(CITY/DISTRICT/CANTEEN), parent_id(FK), status`
- **users**：`username, password_hash, name, role, org_id(FK), status`
- **permission_policies 权限策略（可热更）**：`name, resource_type, action, role, data_scope, min_sensitivity, status`
- **canteens 助餐点**：`code, name, district, org_id(FK), address, capacity, status(OPEN/CLOSED)`
- **elders 长者**：`code, name, gender, age, id_card(敏感), phone(敏感), health_record(敏感), subsidy_level, dietary, canteen_id(FK), status`
- **meals 餐次**：`canteen_id(FK), serve_date, meal_type, dish_name, price_cents, status`
- **orders 订餐**：`elder_id(FK), meal_id(FK), dining_type, qty, amount/subsidy/pay_cents, status`
- **audit_logs 审计日志**：`user_id, username, action, resource_type, resource_id, field_name, old/new_value, ip_address, user_agent, created_at`

## API 一览

### 认证 & 用户

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 公开健康检查 |
| POST | `/api/auth/login` | 登录拿 token |
| GET | `/api/auth/me` | 当前登录用户 |
| GET/POST/PUT/DELETE | `/api/users[...]` | 用户管理（按归属范围过滤） |

### 组织 / 助餐点 / 长者 / 餐次 / 订餐

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET/POST/PUT/DELETE | `/api/organizations[...]` | 组织树 CRUD，`GET ?type=DISTRICT&parentId=..` 过滤 |
| GET | `/api/canteens?district/status/keyword` | 助餐点列表（自动行级过滤） |
| GET | `/api/canteens/:id/elders` | 该点所有长者 |
| POST/PUT/DELETE | `/api/canteens[...]` | 助餐点增改删（改 `orgId` 实现划转） |
| GET | `/api/elders?canteenId/subsidyLevel/status/keyword` | 长者列表（自动行级过滤 + 字段脱敏） |
| GET/POST/PUT/DELETE | `/api/elders[...]` | 长者档案 CRUD（改 `canteenId` 实现迁移） |
| GET | `/api/meals?canteenId/serveDate/mealType/status` | 餐次列表（自动行级过滤） |
| POST/PUT/DELETE | `/api/meals[...]` | 餐次管理 |
| GET | `/api/orders?elderId/mealId/status` | 订餐列表（自动行级过滤 + 所有查询条件生效） |
| POST | `/api/orders` | 下单 |
| POST | `/api/orders/:id/serve` | 核销（防重复） |
| POST | `/api/orders/:id/cancel` | 取消 |

### 权限策略管理（仅 ADMIN）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/permission-policies?resourceType/action/role/status` | 列出所有生效策略 |
| GET | `/api/permission-policies/:id` | 单条策略详情 |
| POST | `/api/permission-policies` | 新增自定义策略（覆盖默认策略） |
| PUT | `/api/permission-policies/:id` | 改策略（缓存即时失效） |
| DELETE | `/api/permission-policies/:id` | 删策略 |
| POST | `/api/permission-policies/reload` | 主动刷策略缓存 |

### 审计日志

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/audit-logs?userId/resourceType/resourceId/action/startTime/endTime&page&pageSize` | 按范围过滤审计日志，分页，敏感值脱敏 |

## 响应约定

- 成功：`{ "data": ..., "meta": { total, page, pageSize } }`
- 失败：`{ "error": { "message": "..." } }`，配合 HTTP 状态码
- 401：未登录 / token 过期
- 403：角色无权 / 数据越界 / 字段敏感级不够
- 409：唯一键冲突 / 状态流转不合法（重复核销等）

## 目录结构

```
src/
├── app.js                 # Express 应用入口，注册所有路由
├── db.js                  # MySQL 连接池 + schema 初始化
├── seed.js                # 种子数据：组织树、用户、助餐点、长者、餐次、订餐
├── auth.js                # JWT 解析中间件
├── utils/
│   ├── http.js            # 统一 sendData/sendError/parseId
│   └── password.js        # scrypt 哈希
├── data/store.js          # SQL 集中层（camelCase ↔ snake_case 映射）
├── permissions/           # ★ 权限体系核心模块，独立、可拔插
│   ├── index.js           # 统一出口
│   ├── engine.js          # 策略引擎：匹配、缓存、minSensitivity/scope
│   ├── scope.js           # 范围计算：组织树后代、可访问 canteen/elder IDs
│   ├── masking.js         # 字段级分级脱敏 + 动态扩展配置
│   ├── audit.js           # 操作审计 + 敏感查看留痕
│   └── middleware.js      # Express 中间件封装（requirePermission/ScopedList/maskResponse）
└── routes/                # 所有路由统一走 perm.* 中间件
    ├── auth.js  users.js  organizations.js
    ├── canteens.js  elders.js  meals.js  orders.js
    ├── audit-logs.js  permission-policies.js
db/schema.sql              # 建表 SQL（含外键 + 索引）
test/api.test.js           # 25 个测试：基础接口 + 权限专项
```

## 自动化测试覆盖（25 条，全部通过）

**基础功能**（13）：健康检查、登录、鉴权、助餐点/长者/订餐 CRUD 与状态流转、编号冲突、404、viewer 不能建助餐点、operator 不能删助餐点

**权限专项**（12）：
- ✅ 跨街道行级过滤（城关看不到江南）
- ✅ 跨街道猜 ID 越权读详情被 403 挡
- ✅ 跨街道猜 ID 越权删除被 403 挡
- ✅ 助餐点级操作员只能管本点数据
- ✅ 市级 viewer 看到的电话/身份证是打星的（字段脱敏）
- ✅ ADMIN 查看敏感字段产生 `VIEW_SENSITIVE` 审计日志
- ✅ 长者迁移改 canteenId：城关看不到 → 江南看得到
- ✅ 助餐点划转改组织 parentId：归属范围立即跟随
- ✅ 给 viewer 加策略后即时生效（原来 403 → 能创建）
- ✅ 街道管理员审计日志范围过滤（看不到市级操作）
- ✅ 订单列表按 status 过滤条件不丢失（行级过滤叠加业务过滤）
