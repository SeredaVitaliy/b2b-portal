import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Типы берём через `typeof import(...)` — без статического импорта,
// чтобы модуль БД загрузился уже ПОСЛЕ подмены DB_PATH на временную базу.
let db: (typeof import("../db"))["db"];
let orderRepo: (typeof import("./orderRepo"))["orderRepo"];
let OrderError: (typeof import("./orderRepo"))["OrderError"];

let tmpDir: string;
let userId: number;
let productA: number; // цена 100, минимальная партия 5
let productB: number; // цена 50, минимальная партия 1

beforeAll(async () => {
  // Отдельный временный файл БД на этот прогон — дев-базу не трогаем.
  tmpDir = mkdtempSync(join(tmpdir(), "b2b-orders-test-"));
  process.env.DB_PATH = join(tmpDir, "test.db");

  // Динамические импорты ПОСЛЕ подмены DB_PATH: синглтон db откроется на временной базе.
  const dbMod = await import("../db");
  db = dbMod.db;
  dbMod.initSchema();

  const repoMod = await import("./orderRepo");
  orderRepo = repoMod.orderRepo;
  OrderError = repoMod.OrderError;

  // Минимальные данные: категория, пользователь, два товара.
  const catId = db
    .prepare("INSERT INTO categories (name, slug) VALUES (?, ?)")
    .run("Тест", "test").lastInsertRowid as number;

  userId = db
    .prepare(
      "INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)",
    )
    .run("tester@test.dev", "x", "Тестер", "buyer").lastInsertRowid as number;

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

describe("orderRepo", () => {
  it("create считает сумму на сервере и сохраняет снимок цены", () => {
    const order = orderRepo.create({
      userId,
      items: [
        { productId: productA, quantity: 5 },
        { productId: productB, quantity: 2 },
      ],
    });

    expect(order.total).toBe(100 * 5 + 50 * 2); // 600 — посчитал сервер
    expect(order.status).toBe("new");
    expect(order.items).toHaveLength(2);

    const a = order.items.find((i) => i.productId === productA)!;
    expect(a.unitPrice).toBe(100); // снимок цены товара A
    expect(a.quantity).toBe(5);
  });

  it("create бросает OrderError при количестве ниже минималки и не создаёт заказ", () => {
    const before = orderRepo.listByUser(userId).length;

    expect(() =>
      orderRepo.create({
        userId,
        items: [{ productId: productA, quantity: 2 }], // минималка у A — 5
      }),
    ).toThrow(OrderError);

    const after = orderRepo.listByUser(userId).length;
    expect(after).toBe(before); // транзакция откатилась — мусорного заказа нет
  });

  it("getById не отдаёт заказ чужому пользователю", () => {
    const order = orderRepo.create({
      userId,
      items: [{ productId: productB, quantity: 1 }],
    });

    expect(orderRepo.getById(userId, order.id)).toBeDefined();
    expect(orderRepo.getById(userId + 999, order.id)).toBeUndefined();
  });

  it("create применяет персональную цену по договору (товар > категория > база)", () => {
    // Компания, её закупщик и переопределения: товар A = 80, категория = 40
    // (категория действует на B, у которого своего переопределения нет).
    const companyId = db
      .prepare("INSERT INTO companies (name) VALUES (?)")
      .run("ООО Договор").lastInsertRowid as number;
    const buyer2 = db
      .prepare(
        "INSERT INTO users (email, password_hash, name, role, company_id) VALUES (?, ?, ?, ?, ?)",
      )
      .run("buyer2@test.dev", "x", "Закупщик", "buyer", companyId)
      .lastInsertRowid as number;

    const cat = db
      .prepare("SELECT category_id AS c FROM products WHERE id = ?")
      .get(productA) as { c: number };
    db.prepare(
      "INSERT INTO price_overrides (company_id, product_id, price) VALUES (?, ?, ?)",
    ).run(companyId, productA, 80);
    db.prepare(
      "INSERT INTO price_overrides (company_id, category_id, price) VALUES (?, ?, ?)",
    ).run(companyId, cat.c, 40);

    const order = orderRepo.create({
      userId: buyer2,
      items: [
        { productId: productA, quantity: 5 },
        { productId: productB, quantity: 1 },
      ],
    });

    const a = order.items.find((i) => i.productId === productA)!;
    const b = order.items.find((i) => i.productId === productB)!;
    expect(a.unitPrice).toBe(80); // переопределение товара важнее категории
    expect(b.unitPrice).toBe(40); // у B своего нет → переопределение категории
    expect(order.total).toBe(80 * 5 + 40 * 1); // 440 — считает сервер
  });
});
