import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Типы берём через `typeof import(...)` — модуль БД грузим уже ПОСЛЕ подмены DB_PATH.
let db: (typeof import("../db"))["db"];
let catalogRepo: (typeof import("./catalogRepo"))["catalogRepo"];

let tmpDir: string;
let productA: number; // цена 100, остаток 50
let productB: number; // цена 50, остаток 50

beforeAll(async () => {
  // Отдельный временный файл БД на этот прогон — дев-базу не трогаем.
  tmpDir = mkdtempSync(join(tmpdir(), "b2b-catalog-test-"));
  process.env.DB_PATH = join(tmpDir, "test.db");

  const dbMod = await import("../db");
  db = dbMod.db;
  dbMod.initSchema();

  catalogRepo = (await import("./catalogRepo")).catalogRepo;

  const catId = db
    .prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
    .run("Тест", "test").lastInsertRowid as number;

  const insProduct = db.prepare(
    `INSERT INTO products (sku, name, category_id, unit, base_price, min_batch, step, stock)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  productA = insProduct.run("A-1", "Товар A", catId, "pcs", 100, 5, 1, 50)
    .lastInsertRowid as number;
  productB = insProduct.run("B-1", "Товар B", catId, "pcs", 50, 1, 1, 50)
    .lastInsertRowid as number;
});

afterAll(() => {
  db?.close();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("catalogRepo.bulkUpdate", () => {
  it("меняет и цену, и остаток, и возвращает актуальные товары", () => {
    const updated = catalogRepo.bulkUpdate([
      { id: productA, basePrice: 120, stock: 30 },
    ]);

    expect(updated).toHaveLength(1);
    const a = updated.find((p) => p.id === productA)!;
    expect(a.basePrice).toBe(120);
    expect(a.stock).toBe(30);
    // статус наличия пересчитался от нового остатка (производное поле)
    expect(a.stockStatus).toBe("in_stock");
  });

  it("частичный апдейт: меняем только остаток — цена не трогается", () => {
    const before = catalogRepo.getProduct(productB)!;
    const updated = catalogRepo.bulkUpdate([{ id: productB, stock: 0 }]);

    const b = updated.find((p) => p.id === productB)!;
    expect(b.stock).toBe(0);
    expect(b.stockStatus).toBe("out"); // остаток 0 → «нет в наличии»
    expect(b.basePrice).toBe(before.basePrice); // цену не передавали — осталась прежней
  });

  it("возвращает только реально изменённые товары; несуществующий id игнорируется без ошибки", () => {
    const updated = catalogRepo.bulkUpdate([
      { id: productA, basePrice: 999 },
      { id: 999999, stock: 10 }, // такого товара нет → changes = 0, в результат не попадёт
    ]);

    expect(updated).toHaveLength(1);
    expect(updated[0].id).toBe(productA);
    expect(updated[0].basePrice).toBe(999);
  });
});
