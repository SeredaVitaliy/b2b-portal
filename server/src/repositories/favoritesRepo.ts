import { db } from "../db";

export const favoritesRepo = {
  /** id избранных товаров пользователя. */
  listIds(userId: number): number[] {
    const rows = db
      .prepare("SELECT product_id FROM favorites WHERE user_id = ?")
      .all(userId) as Array<{ product_id: number }>;
    return rows.map((r) => r.product_id);
  },

  /** Добавить в избранное (idempotent — повтор не создаёт дубль). */
  add(userId: number, productId: number): void {
    db.prepare(
      "INSERT OR IGNORE INTO favorites (user_id, product_id) VALUES (?, ?)",
    ).run(userId, productId);
  },

  /** Убрать из избранного. */
  remove(userId: number, productId: number): void {
    db.prepare(
      "DELETE FROM favorites WHERE user_id = ? AND product_id = ?",
    ).run(userId, productId);
  },
};
