import type { OrderTemplate, OrderTemplateItem } from "@b2b/shared";
import { db } from "../db";

/** Ошибка валидации шаблона (например, товар не найден). */
export class TemplateError extends Error {}

interface TemplateRow {
  id: number;
  user_id: number;
  name: string;
  created_at: number;
}

interface TemplateItemRow {
  id: number;
  template_id: number;
  product_id: number;
  name: string;
  quantity: number;
}

function mapItem(r: TemplateItemRow): OrderTemplateItem {
  return {
    productId: r.product_id,
    name: r.name,
    quantity: r.quantity,
  };
}

function mapTemplate(row: TemplateRow, items: OrderTemplateItem[]): OrderTemplate {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    items,
  };
}

export interface CreateTemplateInput {
  userId: number;
  name: string;
  items: Array<{ productId: number; quantity: number }>;
}

export const templateRepo = {
  /**
   * Создаёт шаблон со всеми позициями в одной транзакции.
   * Название товара берём снимком из БД, а не из тела запроса.
   */
  create(input: CreateTemplateInput): OrderTemplate {
    const tx = db.transaction((data: CreateTemplateInput): number => {
      const now = Math.floor(Date.now() / 1000);

      const templateId = db
        .prepare(
          "INSERT INTO order_templates (user_id, name, created_at) VALUES (?, ?, ?)",
        )
        .run(data.userId, data.name, now).lastInsertRowid as number;

      const getProduct = db.prepare("SELECT name FROM products WHERE id = ?");
      const insertItem = db.prepare(
        `INSERT INTO order_template_items (template_id, product_id, name, quantity)
         VALUES (@templateId, @productId, @name, @quantity)`,
      );

      for (const line of data.items) {
        const p = getProduct.get(line.productId) as { name: string } | undefined;
        if (!p) throw new TemplateError(`Товар #${line.productId} не найден`);

        insertItem.run({
          templateId,
          productId: line.productId,
          name: p.name,
          quantity: Math.round(line.quantity),
        });
      }

      return templateId;
    });

    const templateId = tx(input);
    return this.getById(input.userId, templateId)!;
  },

  /** Все шаблоны пользователя, новые сверху. */
  listByUser(userId: number): OrderTemplate[] {
    const rows = db
      .prepare(
        "SELECT * FROM order_templates WHERE user_id = ? ORDER BY created_at DESC, id DESC",
      )
      .all(userId) as TemplateRow[];
    return rows.map((t) => mapTemplate(t, this.itemsOf(t.id)));
  },

  /** Один шаблон по id — только если он принадлежит этому пользователю. */
  getById(userId: number, templateId: number): OrderTemplate | undefined {
    const row = db
      .prepare("SELECT * FROM order_templates WHERE id = ? AND user_id = ?")
      .get(templateId, userId) as TemplateRow | undefined;
    return row ? mapTemplate(row, this.itemsOf(row.id)) : undefined;
  },

  itemsOf(templateId: number): OrderTemplateItem[] {
    const rows = db
      .prepare("SELECT * FROM order_template_items WHERE template_id = ? ORDER BY id")
      .all(templateId) as TemplateItemRow[];
    return rows.map(mapItem);
  },

  /** Удалить шаблон пользователя вместе с позициями. Возвращает, был ли он удалён. */
  remove(userId: number, templateId: number): boolean {
    const tx = db.transaction((id: number): boolean => {
      const row = db
        .prepare("SELECT id FROM order_templates WHERE id = ? AND user_id = ?")
        .get(id, userId) as { id: number } | undefined;
      if (!row) return false;

      db.prepare("DELETE FROM order_template_items WHERE template_id = ?").run(id);
      db.prepare("DELETE FROM order_templates WHERE id = ?").run(id);
      return true;
    });
    return tx(templateId);
  },
};
