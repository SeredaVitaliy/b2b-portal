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
  /** Комментарий закупщика к заказу (необязательный). */
  comment: string | null;
  /** Желаемая дата доставки в формате 'YYYY-MM-DD' (необязательная). */
  desiredDeliveryDate: string | null;
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
  /** Необязательный комментарий к заказу. */
  comment?: string;
  /** Необязательная желаемая дата доставки, 'YYYY-MM-DD'. */
  desiredDeliveryDate?: string;
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

// ---------- Реалтайм: остатки через WebSocket ----------

/** Сообщение об изменении остатка товара, которое сервер шлёт по WebSocket. */
export interface StockUpdateMessage {
  type: "stock";
  productId: number;
  stock: number;
  stockStatus: StockStatus;
  /** Unix-время (мс) обновления — версия, чтобы не применять устаревшее. */
  updatedAt: number;
}

/** Снимок остатка одного товара для резервного polling по REST (GET /stock). */
export interface StockSnapshotItem {
  productId: number;
  stock: number;
  stockStatus: StockStatus;
}

// ---------- Массовое редактирование товаров ----------

/**
 * Одна правка товара в массовом редакторе (Excel-подобная таблица).
 * id обязателен; поля изменяемые — любое можно опустить, но хотя бы одно должно быть.
 */
export interface ProductBulkUpdate {
  id: number;
  /** Новая базовая цена (>= 0). */
  basePrice?: number;
  /** Новый остаток на складе (целое >= 0). */
  stock?: number;
}

/** Тело запроса PATCH /api/products/bulk — пачка правок за один раз. */
export interface BulkUpdateProductsRequest {
  updates: ProductBulkUpdate[];
}

/**
 * Результат по ОДНОЙ строке пачки. Сервер применяет валидные строки и по каждой
 * возвращает отдельный итог: успешные — с актуальным товаром, ошибочные — с текстом.
 * Это позволяет клиенту откатить оптимистичное обновление только по упавшим строкам.
 */
export type BulkUpdateResult =
  | { id: number; ok: true; product: Product }
  | { id: number; ok: false; error: string };

/** Ответ PATCH /api/products/bulk — построчный итог пачки. */
export interface BulkUpdateProductsResponse {
  results: BulkUpdateResult[];
}

// ---------- Импорт прайс-листа из CSV ----------

/**
 * Одна строка импорта прайса. Идёт по SKU (внешний файл не знает внутренних id).
 * Клиент парсит CSV и валидирует (Zod), сервер резолвит SKU и применяет.
 */
export interface PriceImportRow {
  sku: string;
  basePrice?: number;
  stock?: number;
}

/** Результат импорта по одной строке (по SKU). */
export type ImportRowResult =
  | { sku: string; ok: true; product: Product }
  | { sku: string; ok: false; error: string };

/** Тело POST /api/products/import — пачка строк (клиент шлёт батчами). */
export interface ImportProductsRequest {
  rows: PriceImportRow[];
}

/** Ответ POST /api/products/import — построчный итог. */
export interface ImportProductsResponse {
  results: ImportRowResult[];
}

// ---------- Персональные прайс-листы ----------

/** Клиент (компания), для которого ведём персональные цены. */
export interface Company {
  id: number;
  name: string;
}

/** Уровень переопределения цены. */
export type OverrideScope = "product" | "category";

/**
 * Переопределения цен одного клиента. Храним ТОЛЬКО переопределения:
 * словари id → цена отдельно по товарам и по категориям.
 * Итоговую цену товара считает клиент: товар > категория > базовая.
 */
export interface PriceOverrides {
  companyId: number;
  products: Record<number, number>;
  categories: Record<number, number>;
}

/** Тело PUT /api/price-overrides — задать/обновить одно переопределение. */
export interface SetPriceOverrideRequest {
  companyId: number;
  scope: OverrideScope;
  refId: number;
  price: number;
}

/** Тело DELETE /api/price-overrides — снять переопределение (вернуть наследование). */
export interface DeletePriceOverrideRequest {
  companyId: number;
  scope: OverrideScope;
  refId: number;
}

// ---------- История изменений цены и остатка ----------

/** Что именно поменяли у товара: базовую цену или остаток. */
export type ChangeField = "price" | "stock";

/**
 * Одна запись журнала изменений по товару: кто, когда, что поменял и с какого
 * значения на какое. sku/productName/userName приходят join'ом при чтении —
 * чтобы общая страница истории сразу показывала товар и автора правки.
 */
export interface ProductChange {
  id: number;
  productId: number;
  sku: string;
  productName: string;
  field: ChangeField;
  oldValue: number;
  newValue: number;
  userId: number;
  userName: string;
  /** Unix-время (сек) изменения. */
  changedAt: number;
}

/**
 * Параметры запроса истории GET /api/price-history.
 * Без productId и search — вся история; с productId — по одному товару
 * (модалка), с search — поиск по артикулу/названию (общая страница).
 */
export interface ChangeHistoryQuery {
  productId?: number;
  search?: string;
  field?: ChangeField;
  /** Нижняя граница периода, 'YYYY-MM-DD' (включительно). */
  from?: string;
  /** Верхняя граница периода, 'YYYY-MM-DD' (включительно). */
  to?: string;
  page?: number;
  pageSize?: number;
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
