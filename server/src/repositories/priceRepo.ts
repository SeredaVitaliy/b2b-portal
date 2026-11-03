import type {
  Company,
  OverrideScope,
  PriceOverrides,
} from "@b2b/shared";
import { db } from "../db";

interface OverrideRow {
  company_id: number;
  product_id: number | null;
  category_id: number | null;
  price: number;
}

export const priceRepo = {
  /** Все клиенты (компании) — для выбора в редакторе персональных цен. */
  listCompanies(): Company[] {
    return db
      .prepare("SELECT id, name FROM companies ORDER BY name")
      .all() as Company[];
  },

  /** Переопределения одного клиента: раскладываем на словари по товарам и категориям. */
  getOverrides(companyId: number): PriceOverrides {
    const rows = db
      .prepare(
        "SELECT company_id, product_id, category_id, price FROM price_overrides WHERE company_id = ?",
      )
      .all(companyId) as OverrideRow[];

    const products: Record<number, number> = {};
    const categories: Record<number, number> = {};
    for (const r of rows) {
      if (r.product_id != null) products[r.product_id] = r.price;
      else if (r.category_id != null) categories[r.category_id] = r.price;
    }
    return { companyId, products, categories };
  },

  /**
   * Задать/обновить переопределение. Делаем delete+insert в транзакции —
   * проще, чем ON CONFLICT по частичному индексу, и всегда ровно одна строка.
   */
  setOverride(
    companyId: number,
    scope: OverrideScope,
    refId: number,
    price: number,
  ): PriceOverrides {
    const tx = db.transaction(() => {
      if (scope === "product") {
        db.prepare(
          "DELETE FROM price_overrides WHERE company_id = ? AND product_id = ?",
        ).run(companyId, refId);
        db.prepare(
          "INSERT INTO price_overrides (company_id, product_id, price) VALUES (?, ?, ?)",
        ).run(companyId, refId, price);
      } else {
        db.prepare(
          "DELETE FROM price_overrides WHERE company_id = ? AND category_id = ?",
        ).run(companyId, refId);
        db.prepare(
          "INSERT INTO price_overrides (company_id, category_id, price) VALUES (?, ?, ?)",
        ).run(companyId, refId, price);
      }
    });
    tx();
    return this.getOverrides(companyId);
  },

  /** Снять переопределение (вернуть наследование от категории/базы). */
  deleteOverride(
    companyId: number,
    scope: OverrideScope,
    refId: number,
  ): PriceOverrides {
    const column = scope === "product" ? "product_id" : "category_id";
    db.prepare(
      `DELETE FROM price_overrides WHERE company_id = ? AND ${column} = ?`,
    ).run(companyId, refId);
    return this.getOverrides(companyId);
  },

  /** Существует ли такой клиент (для валидации роутов). */
  companyExists(companyId: number): boolean {
    const row = db
      .prepare("SELECT 1 FROM companies WHERE id = ?")
      .get(companyId);
    return row !== undefined;
  },
};
