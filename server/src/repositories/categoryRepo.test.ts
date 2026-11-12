import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let db: (typeof import("../db"))["db"];
let categoryRepo: (typeof import("./categoryRepo"))["categoryRepo"];
let CategoryError: (typeof import("./categoryRepo"))["CategoryError"];

let tmpDir: string;

beforeAll(async () => {
  tmpDir = mkdtempSync(join(tmpdir(), "b2b-category-test-"));
  process.env.DB_PATH = join(tmpDir, "test.db");

  const dbMod = await import("../db");
  db = dbMod.db;
  dbMod.initSchema();
  const mod = await import("./categoryRepo");
  categoryRepo = mod.categoryRepo;
  CategoryError = mod.CategoryError;
});

afterAll(() => {
  db?.close();
  if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
});

describe("categoryRepo", () => {
  it("создаёт дерево и генерит уникальные slug из кириллицы", () => {
    const root = categoryRepo.create({ name: "Бакалея", parentId: null });
    const child = categoryRepo.create({ name: "Крупы", parentId: root.id });
    // одноимённая категория получает отличный slug (поле slug UNIQUE)
    const dup = categoryRepo.create({ name: "Крупы", parentId: null });

    expect(root.parentId).toBe(null);
    expect(child.parentId).toBe(root.id);
    expect(root.slug).toBe("bakaleya");
    expect(child.slug).toBe("krupy");
    expect(dup.slug).toBe("krupy-2");
  });

  it("не даёт переместить категорию внутрь её же поддерева (цикл)", () => {
    const a = categoryRepo.create({ name: "A", parentId: null });
    const b = categoryRepo.create({ name: "B", parentId: a.id });
    const c = categoryRepo.create({ name: "C", parentId: b.id });

    // переместить A под её потомка C — цикл
    expect(() => categoryRepo.update(a.id, { parentId: c.id })).toThrow(
      CategoryError,
    );
    // а валидное перемещение (C под корень) проходит
    const moved = categoryRepo.update(c.id, { parentId: null });
    expect(moved.parentId).toBe(null);
  });

  it("блокирует удаление категории с подкатегориями или товарами", () => {
    const parent = categoryRepo.create({ name: "Родитель", parentId: null });
    const leaf = categoryRepo.create({ name: "Лист", parentId: parent.id });

    // у parent есть подкатегория → удалять нельзя
    expect(() => categoryRepo.remove(parent.id)).toThrow(CategoryError);

    // кладём товар в leaf → удалять leaf нельзя
    db.prepare(
      `INSERT INTO products (sku, name, category_id, unit, base_price, min_batch, step, stock)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("CAT-1", "Товар", leaf.id, "pcs", 10, 1, 1, 5);
    expect(() => categoryRepo.remove(leaf.id)).toThrow(CategoryError);

    // пустую категорию удалить можно
    const empty = categoryRepo.create({ name: "Пустая", parentId: null });
    categoryRepo.remove(empty.id);
    expect(categoryRepo.get(empty.id)).toBeUndefined();
  });
});
