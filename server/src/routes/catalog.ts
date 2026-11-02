import { Router, type Request, type Response } from "express";
import type { ProductBulkUpdate, BulkUpdateResult } from "@b2b/shared";
import { authenticate, authorize } from "../middleware/auth";
import { broadcastStockFor } from "../ws/stock";
import {
  catalogRepo,
  type ProductQuery,
  type ProductSort,
} from "../repositories/catalogRepo";

export const catalogRouter = Router();

// Каталог доступен только авторизованным пользователям.
catalogRouter.use(authenticate);

// GET /api/categories
catalogRouter.get("/categories", (_req, res) => {
  res.json(catalogRepo.listCategories());
});

const SORTS: ProductSort[] = [
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
  "popularity",
];

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Верхняя граница размера страницы. Пагинация каталога шлёт 20, но
// виртуализированная витрина «Все товары» тянет весь каталог одним запросом,
// поэтому потолок поднят. Граница всё равно есть — чтобы клиент не мог
// запросить произвольно большой ответ (защита от случайного/злого огромного LIMIT).
const MAX_PAGE_SIZE = 2000;

// GET /api/products?categoryId=&search=&minPrice=&maxPrice=&inStock=&sort=&page=&pageSize=
catalogRouter.get("/products", (req, res) => {
  const { categoryId, search, minPrice, maxPrice, inStock, sort, page, pageSize } =
    req.query;

  const sortValue =
    typeof sort === "string" && SORTS.includes(sort as ProductSort)
      ? (sort as ProductSort)
      : undefined;

  const query: ProductQuery = {
    categoryId: parseNumber(categoryId),
    search: typeof search === "string" && search.trim() ? search.trim() : undefined,
    minPrice: parseNumber(minPrice),
    maxPrice: parseNumber(maxPrice),
    inStock: inStock === "true" || inStock === "1",
    sort: sortValue,
    page: Math.max(1, parseNumber(page) ?? 1),
    pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, parseNumber(pageSize) ?? 20)),
  };

  res.json(catalogRepo.listProducts(query));
});

// GET /api/products/batch?ids=1,2,3 — актуальные товары по списку id (для «Повторить заказ»).
// Должен быть ВЫШЕ /products/:id, иначе "batch" попадёт в :id.
catalogRouter.get("/products/batch", (req, res) => {
  const raw = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  res.json(catalogRepo.getProductsByIds(ids));
});

// Массовый редактор доступен только управляющим ролям. Гвард вешаем ПОЛ-РОУТНО,
// а не на весь роутер: роутеры примонтированы на общий "/api", и router-level
// authorize("...") ложно блокировал бы соседние роуты (напр. GET /products).
const editorOnly = [authenticate, authorize("manager", "admin")];

// Разумный потолок на размер пачки — защита от гигантского запроса.
const MAX_BULK_UPDATES = 2000;

// PATCH /api/products/bulk — массовое обновление цены/остатка (Excel-редактор).
// Должен стоять ВЫШЕ /products/:id (у :id метод GET, но держим рядом явно).
//
// Ответ — ПОСТРОЧНЫЙ: валидные строки применяются, по каждой возвращается
// отдельный итог (ok + товар, либо ошибка). Это НЕ «всё-или-ничего»: одна битая
// строка не рушит остальные, а клиент по итогам откатывает только упавшие строки.
// Ошибки УРОВНЯ ЗАПРОСА (тело не массив / пусто / слишком большое) — всё ещё 400:
// тут нечего применять построчно.
catalogRouter.patch("/products/bulk", editorOnly, (req: Request, res: Response) => {
  const body = req.body as { updates?: unknown };

  if (!Array.isArray(body.updates)) {
    res.status(400).json({ error: "bad_request", message: "Ожидается массив updates" });
    return;
  }
  if (body.updates.length === 0) {
    res.status(400).json({ error: "bad_request", message: "Пустой список правок" });
    return;
  }
  if (body.updates.length > MAX_BULK_UPDATES) {
    res.status(400).json({
      error: "bad_request",
      message: `Слишком много правок за раз (максимум ${MAX_BULK_UPDATES})`,
    });
    return;
  }

  const results: BulkUpdateResult[] = [];
  const valid: ProductBulkUpdate[] = [];

  // Валидируем КАЖДУЮ строку по отдельности. Невалидную сразу кладём в results
  // как ошибку и идём дальше; валидные копим для применения.
  for (const raw0 of body.updates) {
    const raw = (raw0 ?? {}) as Record<string, unknown>;
    const rawId = Number(raw.id);

    if (!Number.isInteger(raw.id) || (raw.id as number) <= 0) {
      results.push({
        id: Number.isFinite(rawId) ? rawId : 0,
        ok: false,
        error: "Некорректный id",
      });
      continue;
    }
    const id = raw.id as number;
    const update: ProductBulkUpdate = { id };
    let fieldError: string | null = null;

    if (raw.basePrice !== undefined) {
      const price = raw.basePrice;
      if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
        fieldError = "Цена должна быть числом ≥ 0";
      } else {
        update.basePrice = price;
      }
    }
    if (!fieldError && raw.stock !== undefined) {
      const stock = raw.stock;
      if (typeof stock !== "number" || !Number.isInteger(stock) || stock < 0) {
        fieldError = "Остаток должен быть целым числом ≥ 0";
      } else {
        update.stock = stock;
      }
    }
    if (!fieldError && update.basePrice === undefined && update.stock === undefined) {
      fieldError = "Нет полей для изменения";
    }

    if (fieldError) {
      results.push({ id, ok: false, error: fieldError });
      continue;
    }
    valid.push(update);
  }

  // Применяем валидные (внутри одной транзакции репозитория) и раскладываем итог.
  const applied = catalogRepo.bulkUpdate(valid);
  const appliedById = new Map(applied.map((p) => [p.id, p]));
  const stockChangedIds: number[] = [];

  for (const u of valid) {
    const product = appliedById.get(u.id);
    if (product) {
      results.push({ id: u.id, ok: true, product });
      if (u.stock !== undefined) stockChangedIds.push(u.id);
    } else {
      // id прошёл валидацию, но такого товара нет (или значение не изменилось).
      results.push({ id: u.id, ok: false, error: "Товар не найден" });
    }
  }

  // Остаток изменился → живые теги в каталоге обновляем через тот же WS, что и заказы.
  if (stockChangedIds.length > 0) {
    broadcastStockFor(stockChangedIds);
  }

  res.json({ results });
});

// GET /api/products/:id
catalogRouter.get("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  const product = catalogRepo.getProduct(id);
  if (!product) {
    res.status(404).json({ error: "not_found", message: "Товар не найден" });
    return;
  }
  res.json(product);
});
