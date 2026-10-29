import type { Category, Paginated, Product, Unit } from "@b2b/shared";
import { db } from "../db";
import { stockStatus } from "../lib/stock";

interface ProductRow {
  id: number;
  sku: string;
  name: string;
  description: string;
  category_id: number;
  unit: Unit;
  base_price: number;
  min_batch: number;
  step: number;
  stock: number;
  popularity: number;
  image_url: string | null;
}

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    description: row.description,
    categoryId: row.category_id,
    unit: row.unit,
    basePrice: row.base_price,
    minBatch: row.min_batch,
    step: row.step,
    stock: row.stock,
    stockStatus: stockStatus(row.stock),
    popularity: row.popularity,
    imageUrl: row.image_url,
  };
}

export type ProductSort =
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc"
  | "popularity";

export interface ProductQuery {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page: number;
  pageSize: number;
}

const ORDER_BY: Record<ProductSort, string> = {
  price_asc: "base_price ASC",
  price_desc: "base_price DESC",
  name_asc: "name COLLATE NOCASE ASC",
  name_desc: "name COLLATE NOCASE DESC",
  popularity: "popularity DESC",
};

export const catalogRepo = {
  listCategories(): Category[] {
    const rows = db
      .prepare("SELECT id, parent_id, name, slug FROM categories ORDER BY name")
      .all() as Array<{ id: number; parent_id: number | null; name: string; slug: string }>;
    return rows.map((r) => ({
      id: r.id,
      parentId: r.parent_id,
      name: r.name,
      slug: r.slug,
    }));
  },

  listProducts(q: ProductQuery): Paginated<Product> {
    const where: string[] = [];
    const params: Record<string, unknown> = {};

    if (q.categoryId != null) {
      where.push("category_id = @categoryId");
      params.categoryId = q.categoryId;
    }
    if (q.search) {
      // lower_u — своя Unicode-функция (см. db/index.ts): регистронезависимо и для кириллицы.
      where.push("(lower_u(name) LIKE lower_u(@search) OR lower_u(sku) LIKE lower_u(@search))");
      params.search = `%${q.search}%`;
    }
    if (q.minPrice != null) {
      where.push("base_price >= @minPrice");
      params.minPrice = q.minPrice;
    }
    if (q.maxPrice != null) {
      where.push("base_price <= @maxPrice");
      params.maxPrice = q.maxPrice;
    }
    if (q.inStock) {
      where.push("stock > 0");
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const orderSql = ORDER_BY[q.sort ?? "popularity"];

    const total = (
      db.prepare(`SELECT COUNT(*) AS c FROM products ${whereSql}`).get(params) as {
        c: number;
      }
    ).c;

    const offset = (q.page - 1) * q.pageSize;
    const rows = db
      .prepare(
        `SELECT * FROM products ${whereSql} ORDER BY ${orderSql} LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: q.pageSize, offset }) as ProductRow[];

    return {
      items: rows.map(mapProduct),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  },

  getProduct(id: number): Product | undefined {
    const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as
      | ProductRow
      | undefined;
    return row ? mapProduct(row) : undefined;
  },

  // Актуальные товары по списку id (для «Повторить заказ»). Отсутствующие просто не вернутся.
  getProductsByIds(ids: number[]): Product[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => "?").join(",");
    const rows = db
      .prepare(`SELECT * FROM products WHERE id IN (${placeholders})`)
      .all(...ids) as ProductRow[];
    return rows.map(mapProduct);
  },
};
