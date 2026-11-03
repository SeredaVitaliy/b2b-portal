-- Схема БД. Выполняется при старте сервера (idempotent: IF NOT EXISTS).
-- По мере роста приложения сюда будут добавляться таблицы заказов, прайсов и т.д.

CREATE TABLE IF NOT EXISTS companies (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('buyer', 'manager', 'admin')),
  company_id    INTEGER REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  token      TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,          -- unix-время (сек) истечения
  revoked    INTEGER NOT NULL DEFAULT 0 -- 0/1
);

CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  parent_id INTEGER REFERENCES categories(id),
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  sku         TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category_id INTEGER NOT NULL REFERENCES categories(id),
  unit        TEXT NOT NULL CHECK (unit IN ('kg', 'l', 'pcs', 'box')),
  base_price  REAL NOT NULL,
  min_batch   INTEGER NOT NULL DEFAULT 1,
  step        INTEGER NOT NULL DEFAULT 1,
  stock       INTEGER NOT NULL DEFAULT 0,
  popularity  INTEGER NOT NULL DEFAULT 0,
  image_url   TEXT
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- Шапка заказа. Принадлежит пользователю, который его оформил.
CREATE TABLE IF NOT EXISTS orders (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id),
  status               TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'processing', 'shipped', 'cancelled')),
  total                REAL NOT NULL,     -- сумма заказа на момент оформления
  created_at           INTEGER NOT NULL,  -- unix-время (сек) создания
  comment              TEXT,              -- комментарий закупщика к заказу (nullable)
  desired_delivery_date TEXT              -- желаемая дата доставки 'YYYY-MM-DD' (nullable)
);

-- Позиции заказа. Цена/название/единица — СНИМОК на момент заказа:
-- если потом поменяется прайс, старый заказ останется с исторической ценой.
CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name       TEXT NOT NULL,            -- снимок названия
  sku        TEXT NOT NULL,            -- снимок артикула
  unit       TEXT NOT NULL,            -- снимок единицы измерения
  unit_price REAL NOT NULL,            -- снимок цены за единицу
  quantity   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- Избранные товары пользователя. Пара (user_id, product_id) уникальна.
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INTEGER NOT NULL REFERENCES users(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  PRIMARY KEY (user_id, product_id)
);

-- Шаблон регулярной закупки: именованный набор позиций пользователя.
CREATE TABLE IF NOT EXISTS order_templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  name       TEXT NOT NULL,
  created_at INTEGER NOT NULL          -- unix-время (сек) создания
);

-- Позиции шаблона. В отличие от order_items тут нет снимка цены:
-- при применении шаблона цена берётся актуальная из каталога.
-- name храним как снимок — чтобы список шаблонов читался, даже если товар убрали.
CREATE TABLE IF NOT EXISTS order_template_items (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES order_templates(id) ON DELETE CASCADE,
  product_id  INTEGER NOT NULL REFERENCES products(id),
  name        TEXT NOT NULL,            -- снимок названия для отображения
  quantity    INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_order_templates_user ON order_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_order_template_items_tpl ON order_template_items(template_id);

-- Персональные переопределения цен клиента (компании).
-- Храним ТОЛЬКО переопределения (не дублируем базовые цены). У строки задан
-- РОВНО один из product_id / category_id (на уровне товара или категории).
-- Приоритет при вычислении итоговой цены — на клиенте: товар > категория > база.
CREATE TABLE IF NOT EXISTS price_overrides (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id  INTEGER NOT NULL REFERENCES companies(id),
  product_id  INTEGER REFERENCES products(id),
  category_id INTEGER REFERENCES categories(id),
  price       REAL NOT NULL CHECK (price >= 0)
);

-- Одно переопределение на (клиент, товар) и на (клиент, категория).
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_ovr_product
  ON price_overrides(company_id, product_id) WHERE product_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_price_ovr_category
  ON price_overrides(company_id, category_id) WHERE category_id IS NOT NULL;
