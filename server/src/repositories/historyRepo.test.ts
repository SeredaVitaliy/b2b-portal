import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let db: (typeof import("../db"))["db"];
let catalogRepo: (typeof import("./catalogRepo"))["catalogRepo"];
let historyRepo: (typeof import("./historyRepo"))["historyRepo"];

let tmpDir: string;
let userId: number;
let categoryId: number;
let productId: number;
let otherId: number;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "b2b-history-test-"));
  process.env.DB_PATH = join(tmpDir, "test.db");

  const dbMod = await import("../db");
  db = dbMod.db;
  dbMod.initSchema();
  catalogRepo = (await import("./catalogRepo")).catalogRepo;
  historyRepo = (await import("./historyRepo")).historyRepo;

  userId = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
    )
    .run("mgr@test", "x", "Менеджер", "manager").lastInsertRowid as number;
  categoryId = db
    .prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
    .run("Тест", "test").lastInsertRowid as number;
  productId = db
    .prepare(
      `INSERT INTO products (sku, name, category_id, unit, base_price, min_batch, step, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("P-1", "Товар", categoryId, "pcs", 100, 1, 1, 10)
    .lastInsertRowid as number;
  otherId = db
    .prepare(
      `INSERT INTO products (sku, name, category_id, unit, base_price, min_batch, step, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("P-2", "Другой", categoryId, "pcs", 50, 1, 1, 5)
    .lastInsertRowid as number;
});

afterAll(() => {
  db?.close();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("historyRepo + bulkUpdate", () => {
  it("пишет в журнал по одной строке на реально изменённое поле", () => {
    // цена 100 → 120 и остаток 10 → 7 за одну правку = две записи.
    catalogRepo.bulkUpdate(
      [{ id: productId, basePrice: 120, stock: 7 }],
      userId,
    );

    const page = historyRepo.list({ productId, page: 1, pageSize: 50 });
    expect(page.total).toBe(2);

    const price = page.items.find((c) => c.field === "price");
    const stock = page.items.find((c) => c.field === "stock");
    expect(price).toMatchObject({ oldValue: 100, newValue: 120, userName: "Менеджер" });
    expect(stock).toMatchObject({ oldValue: 10, newValue: 7 });
    // join подтянул артикул/имя товара
    expect(price?.sku).toBe("P-1");
  });

  it("не логирует поле, если значение не изменилось", () => {
    // stock уже 7 → ставим снова 7 (без изменений), цену меняем 120 → 130.
    catalogRepo.bulkUpdate(
      [{ id: productId, basePrice: 130, stock: 7 }],
      userId,
    );

    const prices = historyRepo.list({ productId, field: "price", page: 1, pageSize: 50 });
    const stocks = historyRepo.list({ productId, field: "stock", page: 1, pageSize: 50 });
    // ещё одна запись цены (120→130), остаток новых записей не получил
    expect(prices.total).toBe(2);
    expect(stocks.total).toBe(1);
  });

  it("фильтрует по товару и отдаёт постранично", () => {
    // правка другого товара — в его историю, не в первый.
    catalogRepo.bulkUpdate([{ id: otherId, basePrice: 55 }], userId);

    const first = historyRepo.list({ productId, page: 1, pageSize: 50 });
    const other = historyRepo.list({ productId: otherId, page: 1, pageSize: 50 });
    expect(other.total).toBe(1);
    // у первого товара своих записей больше, чужая не подмешалась
    expect(first.items.every((c) => c.productId === productId)).toBe(true);

    // пагинация: 2 страницы по одной записи у первого товара (всего 3: price,stock,price)
    const p1 = historyRepo.list({ productId, page: 1, pageSize: 1 });
    expect(p1.items).toHaveLength(1);
    expect(p1.total).toBe(3);
  });
});
