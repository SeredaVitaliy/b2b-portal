/**
 * Доменный контракт приложения — общие типы для client и server.
 * Это "единый источник правды" по формам данных: если меняется форма ответа
 * бэка, меняем здесь, и TypeScript на фронте сразу подсветит все места.
 */

// ---------- Пользователи и роли ----------

export type Role = "buyer" | "manager" | "admin";

export interface User {
  id: number;
  email: string;
  name: string;
  role: Role;
  /** Компания-клиент, к которой привязан закупщик (null у администратора каталога). */
  companyId: number | null;
}

// ---------- Авторизация ----------

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginResponse {
  user: User;
  tokens: AuthTokens;
}

export interface RefreshRequest {
  refreshToken: string;
}

// ---------- Каталог ----------

/** Единицы измерения товара. */
export type Unit = "kg" | "l" | "pcs" | "box";

/** Производный статус наличия (не бинарный флаг — три состояния). */
export type StockStatus = "in_stock" | "low" | "out";

export interface Category {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  sku: string;
  name: string;
  description: string;
  categoryId: number;
  unit: Unit;
  /** Базовая цена за единицу (в основной валюте, напр. 12.50). */
  basePrice: number;
  /** Минимальная партия к заказу. */
  minBatch: number;
  /** Кратность (шаг изменения количества). */
  step: number;
  /** Текущий остаток на складе. */
  stock: number;
  /** Производный статус наличия. */
  stockStatus: StockStatus;
  /** Условный "вес" для сортировки по популярности. */
  popularity: number;
  imageUrl: string | null;
}

// ---------- Заказы ----------

/** Жизненный цикл заказа. При создании всегда 'new'. */
export type OrderStatus = "new" | "processing" | "shipped" | "cancelled";

/** Позиция заказа — снимок товара на момент оформления. */
export interface OrderItem {
  id: number;
  productId: number;
  name: string;
  sku: string;
  unit: Unit;
  /** Цена за единицу на момент заказа (историческая, не текущая из каталога). */
  unitPrice: number;
  quantity: number;
}

export interface Order {
  id: number;
  status: OrderStatus;
  /** Итоговая сумма заказа (посчитана сервером при оформлении). */
  total: number;
  /** Unix-время (сек) создания. */
  createdAt: number;
  items: OrderItem[];
}

/** Одна позиция в запросе на оформление: клиент шлёт только id и количество. */
export interface CreateOrderItem {
  productId: number;
  quantity: number;
}

/** Тело POST /orders. Цены клиент НЕ присылает — их считает сервер. */
export interface CreateOrderRequest {
  items: CreateOrderItem[];
}

// ---------- Шаблоны регулярных закупок ----------

/** Позиция шаблона. Цены нет: при применении берётся актуальная из каталога. */
export interface OrderTemplateItem {
  productId: number;
  /** Снимок названия на момент сохранения — для отображения списка. */
  name: string;
  quantity: number;
}

export interface OrderTemplate {
  id: number;
  name: string;
  /** Unix-время (сек) создания. */
  createdAt: number;
  items: OrderTemplateItem[];
}

/** Одна позиция в запросе на создание шаблона: клиент шлёт только id и количество. */
export interface CreateOrderTemplateItem {
  productId: number;
  quantity: number;
}

/** Тело POST /templates. Название + позиции; снимок имени проставит сервер. */
export interface CreateOrderTemplateRequest {
  name: string;
  items: CreateOrderTemplateItem[];
}

// ---------- Общие обёртки ----------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
