-- 社区长者助餐运营管理平台 表结构（全程 utf8mb4，确保中文正常）
SET NAMES utf8mb4;

-- 组织层级表：市级民政 / 街道 / 助餐点
CREATE TABLE IF NOT EXISTS organizations (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code        VARCHAR(32) NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  type        VARCHAR(16) NOT NULL,
  parent_id   INT UNSIGNED NULL,
  status      VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_org_parent FOREIGN KEY (parent_id) REFERENCES organizations(id) ON DELETE SET NULL,
  INDEX idx_org_type (type),
  INDEX idx_org_parent (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  username      VARCHAR(64) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  name          VARCHAR(64) NOT NULL,
  role          VARCHAR(16) NOT NULL DEFAULT 'VIEWER',
  org_id        INT UNSIGNED NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_user_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL,
  INDEX idx_user_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 助餐点（社区食堂）
CREATE TABLE IF NOT EXISTS canteens (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code        VARCHAR(32) NOT NULL UNIQUE,
  name        VARCHAR(128) NOT NULL,
  district    VARCHAR(64) NOT NULL,
  org_id      INT UNSIGNED NULL,
  address     VARCHAR(255) NOT NULL DEFAULT '',
  capacity    INT NOT NULL DEFAULT 0,
  status      VARCHAR(16) NOT NULL DEFAULT 'OPEN',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_canteen_org FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE SET NULL,
  INDEX idx_canteen_org (org_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 长者档案
CREATE TABLE IF NOT EXISTS elders (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  code          VARCHAR(32) NOT NULL UNIQUE,
  name          VARCHAR(64) NOT NULL,
  gender        VARCHAR(8) NOT NULL DEFAULT 'U',
  age           INT NOT NULL DEFAULT 0,
  id_card       VARCHAR(32) NOT NULL DEFAULT '',
  phone         VARCHAR(32) NOT NULL DEFAULT '',
  health_record TEXT NULL,
  subsidy_level VARCHAR(8) NOT NULL DEFAULT 'C',
  dietary       VARCHAR(255) NOT NULL DEFAULT '',
  canteen_id    INT UNSIGNED NULL,
  status        VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_elder_canteen FOREIGN KEY (canteen_id) REFERENCES canteens(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 餐次（某助餐点某日某餐别提供的菜品）
CREATE TABLE IF NOT EXISTS meals (
  id          INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  canteen_id  INT UNSIGNED NOT NULL,
  serve_date  DATE NOT NULL,
  meal_type   VARCHAR(16) NOT NULL DEFAULT 'LUNCH',
  dish_name   VARCHAR(128) NOT NULL,
  price_cents INT NOT NULL DEFAULT 0,
  status      VARCHAR(16) NOT NULL DEFAULT 'PUBLISHED',
  created_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at  DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_meal_canteen FOREIGN KEY (canteen_id) REFERENCES canteens(id) ON DELETE CASCADE,
  INDEX idx_meal_date (serve_date),
  INDEX idx_meal_canteen (canteen_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 订餐
CREATE TABLE IF NOT EXISTS orders (
  id           INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  elder_id     INT UNSIGNED NOT NULL,
  meal_id      INT UNSIGNED NOT NULL,
  dining_type  VARCHAR(16) NOT NULL DEFAULT 'DINE_IN',
  qty          INT NOT NULL DEFAULT 1,
  amount_cents INT NOT NULL DEFAULT 0,
  subsidy_cents INT NOT NULL DEFAULT 0,
  pay_cents    INT NOT NULL DEFAULT 0,
  status       VARCHAR(16) NOT NULL DEFAULT 'RESERVED',
  created_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at   DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT fk_order_elder FOREIGN KEY (elder_id) REFERENCES elders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_meal FOREIGN KEY (meal_id) REFERENCES meals(id) ON DELETE CASCADE,
  INDEX idx_order_status (status),
  INDEX idx_order_elder (elder_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 权限策略表（可配置的细粒度权限策略）
CREATE TABLE IF NOT EXISTS permission_policies (
  id              INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  name            VARCHAR(64) NOT NULL UNIQUE,
  resource_type   VARCHAR(32) NOT NULL,
  action          VARCHAR(16) NOT NULL,
  role            VARCHAR(16) NOT NULL,
  data_scope      VARCHAR(32) NOT NULL DEFAULT 'ORG_AND_DESCENDANTS',
  min_sensitivity VARCHAR(16) NOT NULL DEFAULT 'PUBLIC',
  status          VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  created_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at      DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_policy_resource (resource_type, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id            INT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  user_id       INT UNSIGNED NULL,
  username      VARCHAR(64) NOT NULL,
  action        VARCHAR(32) NOT NULL,
  resource_type VARCHAR(32) NOT NULL,
  resource_id   VARCHAR(64) NOT NULL,
  field_name    VARCHAR(64) NULL,
  old_value     TEXT NULL,
  new_value     TEXT NULL,
  ip_address    VARCHAR(64) NULL,
  user_agent    VARCHAR(255) NULL,
  created_at    DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_audit_user (user_id),
  INDEX idx_audit_resource (resource_type, resource_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
