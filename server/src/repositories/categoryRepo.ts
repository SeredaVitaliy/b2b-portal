import type { Category, CreateCategoryRequest } from "@b2b/shared";
import { db } from "../db";

// Понятная доменная ошибка (как TemplateError): роут ловит её и отдаёт 400/409
// с текстом, вместо того чтобы «ронять» 500.
export class CategoryError extends Error {}

interface CategoryRow {
  id: number;
  parent_id: number | null;
  name: string;
  slug: string;
}

function mapRow(r: CategoryRow): Category {
  return { id: r.id, parentId: r.parent_id, name: r.name, slug: r.slug };
}

// Транслитерация кириллицы в латиницу для slug (адрес-часть категории).
const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .split("")
    .map((ch) => (ch in TRANSLIT ? TRANSLIT[ch] : ch))
    .join("")
    .replace(/[^a-z0-9]+/g, "-") // всё лишнее → дефис
    .replace(/^-+|-+$/g, ""); // обрезаем дефисы по краям
  return base || "category";
}

export const categoryRepo = {
  list(): Category[] {
    const rows = db
      .prepare("SELECT id, parent_id, name, slug FROM categories ORDER BY name")
      .all() as CategoryRow[];
    return rows.map(mapRow);
  },

  get(id: number): Category | undefined {
    const row = db
      .prepare("SELECT id, parent_id, name, slug FROM categories WHERE id = ?")
      .get(id) as CategoryRow | undefined;
    return row ? mapRow(row) : undefined;
  },

  exists(id: number): boolean {
    return (
      db.prepare("SELECT 1 FROM categories WHERE id = ?").get(id) !== undefined
    );
  },

  hasChildren(id: number): boolean {
    return (
      db.prepare("SELECT 1 FROM categories WHERE parent_id = ?").get(id) !==
      undefined
    );
  },

  productCount(id: number): number {
    return (
      db
        .prepare("SELECT COUNT(*) AS c FROM products WHERE category_id = ?")
        .get(id) as { c: number }
    ).c;
  },

  // Генерим slug из имени и обеспечиваем уникальность (поле slug UNIQUE):
  // если занят — добавляем -2, -3, … Можно исключить один id (при переименовании).
  uniqueSlug(name: string, exceptId?: number): string {
    const base = slugify(name);
    let slug = base;
    let n = 1;
    while (true) {
      const row = db
        .prepare("SELECT id FROM categories WHERE slug = ?")
        .get(slug) as { id: number } | undefined;
      if (!row || row.id === exceptId) return slug;
      n += 1;
      slug = `${base}-${n}`;
    }
  },

  create(input: CreateCategoryRequest): Category {
    const slug = this.uniqueSlug(input.name);
    const info = db
      .prepare(
        "INSERT INTO categories (parent_id, name, slug) VALUES (@parentId, @name, @slug)",
      )
      .run({ parentId: input.parentId, name: input.name, slug });
    return this.get(info.lastInsertRowid as number)!;
  },

  // true, если candidateParentId — это сам узел или его потомок. Нужно, чтобы не
  // дать переместить категорию внутрь её собственного поддерева (иначе цикл).
  // Идём вверх по parent_id от кандидата: если встретили сам узел — это потомок.
  isSelfOrDescendant(nodeId: number, candidateParentId: number): boolean {
    let current: number | null = candidateParentId;
    while (current !== null) {
      if (current === nodeId) return true;
      const row = db
        .prepare("SELECT parent_id FROM categories WHERE id = ?")
        .get(current) as { parent_id: number | null } | undefined;
      current = row ? row.parent_id : null;
    }
    return false;
  },

  // Переименование и/или перемещение. parentId: число — новый родитель,
  // null — сделать корневой, undefined — не трогать родителя.
  update(
    id: number,
    changes: { name?: string; parentId?: number | null },
  ): Category {
    if (changes.parentId !== undefined && changes.parentId !== null) {
      if (!this.exists(changes.parentId)) {
        throw new CategoryError("Родительская категория не найдена");
      }
      if (this.isSelfOrDescendant(id, changes.parentId)) {
        throw new CategoryError(
          "Нельзя переместить категорию внутрь самой себя",
        );
      }
    }

    const sets: string[] = [];
    const params: Record<string, unknown> = { id };
    if (changes.name !== undefined) {
      sets.push("name = @name", "slug = @slug");
      params.name = changes.name;
      params.slug = this.uniqueSlug(changes.name, id);
    }
    if (changes.parentId !== undefined) {
      sets.push("parent_id = @parentId");
      params.parentId = changes.parentId;
    }
    if (sets.length > 0) {
      db.prepare(`UPDATE categories SET ${sets.join(", ")} WHERE id = @id`).run(
        params,
      );
    }
    return this.get(id)!;
  },

  // Удаление запрещаем, пока у категории есть подкатегории или товары —
  // иначе осиротели бы ссылки. Менеджер сначала переносит содержимое.
  remove(id: number): void {
    if (this.hasChildren(id)) {
      throw new CategoryError(
        "Нельзя удалить: есть подкатегории. Сначала перенесите или удалите их",
      );
    }
    if (this.productCount(id) > 0) {
      throw new CategoryError(
        "Нельзя удалить: в категории есть товары. Сначала перенесите их",
      );
    }
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  },
};
