import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let db: (typeof import("../db"))["db"];
let priceRepo: (typeof import("./priceRepo"))["priceRepo"];

let tmpDir: string;
let companyId: number;
let categoryId: number;
let productId: number;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "b2b-price-test-"));
  process.env.DB_PATH = join(tmpDir, "test.db");

  const dbMod = await import("../db");
  db = dbMod.db;
  dbMod.initSchema();
  priceRepo = (await import("./priceRepo")).priceRepo;

  companyId = db
    .prepare("INSERT INTO companies (name) VALUES (?)")
    .run("ООО Тест").lastInsertRowid as number;
  categoryId = db
    .prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
    .run("Тест", "test").lastInsertRowid as number;
  productId = db
    .prepare(
      `INSERT INTO products (sku, name, category_id, unit, base_price, min_batch, step, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run("P-1", "Товар", categoryId, "pcs", 100, 1, 1, 10).lastInsertRowid as number;
});

afterAll(() => {
  db?.close();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("priceRepo", () => {
  it("хранит переопределения по товару и по категории раздельно", () => {
    priceRepo.setOverride(companyId, "product", productId, 90);
    priceRepo.setOverride(companyId, "category", categoryId, 80);

    const ovr = priceRepo.getOverrides(companyId);
    expect(ovr.products[productId]).toBe(90);
    expect(ovr.categories[categoryId]).toBe(80);
  });

  it("повторная установка перезаписывает, а не дублирует", () => {
    priceRepo.setOverride(companyId, "product", productId, 70);
    const ovr = priceRepo.getOverrides(companyId);
    expect(ovr.products[productId]).toBe(70);
    // в таблице по-прежнему одна строка на (клиент, товар)
    const count = db
      .prepare(
        "SELECT COUNT(*) AS c FROM price_overrides WHERE company_id = ? AND product_id = ?",
      )
      .get(companyId, productId) as { c: number };
    expect(count.c).toBe(1);
  });

  it("снятие переопределения убирает его (возврат к наследованию)", () => {
    priceRepo.deleteOverride(companyId, "product", productId);
    const ovr = priceRepo.getOverrides(companyId);
    expect(ovr.products[productId]).toBeUndefined();
    // категорийное переопределение осталось
    expect(ovr.categories[categoryId]).toBe(80);
  });
});
