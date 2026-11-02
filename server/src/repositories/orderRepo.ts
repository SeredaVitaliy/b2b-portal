import type { Order, OrderItem, OrderStatus, Unit } from "@b2b/shared";
import { db } from "../db";

/** Ошибка валидации заказа (например, количество ниже минимальной партии). */
export class OrderError extends Error {}

interface OrderRow {
  id: number;
  user_id: number;
  status: OrderStatus;
  total: number;
  created_at: number;
  comment: string | null;
  desired_delivery_date: string | null;
}

interface OrderItemRow {
  id: number;
  order_id: number;
  product_id: number;
  name: string;
  sku: string;
  unit: Unit;
  unit_price: number;
  quantity: number;
}

interface ProductForOrder {
  name: string;
  sku: string;
  unit: Unit;
  base_price: number;
  min_batch: number;
  stock: number;
}

function mapItem(r: OrderItemRow): OrderItem {
  return {
    id: r.id,
    productId: r.product_id,
    name: r.name,
    sku: r.sku,
    unit: r.unit,
    unitPrice: r.unit_price,
    quantity: r.quantity,
  };
}

function mapOrder(row: OrderRow, items: OrderItem[]): Order {
  return {
    id: row.id,
    status: row.status,
    total: row.total,
    createdAt: row.created_at,
    comment: row.comment,
    desiredDeliveryDate: row.desired_delivery_date,
    items,
  };
}

export interface CreateOrderInput {
  userId: number;
  items: Array<{ productId: number; quantity: number }>;
  comment?: string | null;
  desiredDeliveryDate?: string | null;
}

export const orderRepo = {
  /**
   * Создаёт заказ со всеми позициями в одной транзакции:
   * либо записывается всё, либо (при ошибке) ничего.
   * Цену и данные товара берём из БД, а не из тела запроса.
   */
  create(input: CreateOrderInput): Order {
    const tx = db.transaction((data: CreateOrderInput): number => {
      const now = Math.floor(Date.now() / 1000);

      const orderId = db
        .prepare(
          `INSERT INTO orders (user_id, status, total, created_at, comment, desired_delivery_date)
           VALUES (?, 'new', 0, ?, ?, ?)`,
        )
        .run(
          data.userId,
          now,
          data.comment ?? null,
          data.desiredDeliveryDate ?? null,
        ).lastInsertRowid as number;

      const getProduct = db.prepare(
        "SELECT name, sku, unit, base_price, min_batch, stock FROM products WHERE id = ?",
      );
      const insertItem = db.prepare(
        `INSERT INTO order_items
           (order_id, product_id, name, sku, unit, unit_price, quantity)
         VALUES (@orderId, @productId, @name, @sku, @unit, @unitPrice, @quantity)`,
      );
      // Списываем остаток заказанного товара (не ниже 0). Делаем это в той же
      // транзакции, что и создание заказа — либо всё, либо ничего.
      const decStock = db.prepare(
        "UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?",
      );

      let total = 0;
      for (const line of data.items) {
        const p = getProduct.get(line.productId) as ProductForOrder | undefined;
        if (!p) throw new OrderError(`Товар #${line.productId} не найден`);

        const qty = Math.round(line.quantity);
        if (qty < p.min_batch) {
          throw new OrderError(
            `Для «${p.name}» минимальная партия ${p.min_batch}`,
          );
        }
        // Проверка наличия — источник правды. Фронт тоже не даёт оформить
        // недоступное, но остаток мог упасть между открытием корзины и отправкой
        // (чужой заказ, WebSocket не успел). Бросаем в транзакции → заказ не пишется.
        if (p.stock <= 0) {
          throw new OrderError(`«${p.name}» закончился на складе`);
        }
        if (qty > p.stock) {
          throw new OrderError(
            `«${p.name}»: в наличии только ${p.stock}, а в заказе ${qty}`,
          );
        }

        total += p.base_price * qty;
        insertItem.run({
          orderId,
          productId: line.productId,
          name: p.name,
          sku: p.sku,
          unit: p.unit,
          unitPrice: p.base_price,
          quantity: qty,
        });
        decStock.run(qty, line.productId);
      }

      db.prepare("UPDATE orders SET total = ? WHERE id = ?").run(total, orderId);
      return orderId;
    });

    const orderId = tx(input);
    // getById не вернёт undefined сразу после создания — заказ точно есть.
    return this.getById(input.userId, orderId)!;
  },

  /** Все заказы пользователя, новые сверху. */
  listByUser(userId: number): Order[] {
    const rows = db
      .prepare(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC, id DESC",
      )
      .all(userId) as OrderRow[];
    return rows.map((o) => mapOrder(o, this.itemsOf(o.id)));
  },

  /** Один заказ по id — только если он принадлежит этому пользователю. */
  getById(userId: number, orderId: number): Order | undefined {
    const row = db
      .prepare("SELECT * FROM orders WHERE id = ? AND user_id = ?")
      .get(orderId, userId) as OrderRow | undefined;
    return row ? mapOrder(row, this.itemsOf(row.id)) : undefined;
  },

  itemsOf(orderId: number): OrderItem[] {
    const rows = db
      .prepare("SELECT * FROM order_items WHERE order_id = ? ORDER BY id")
      .all(orderId) as OrderItemRow[];
    return rows.map(mapItem);
  },

  /**
   * id товаров, которые пользователь заказывает чаще всего:
   * сначала по числу заказов, где товар встречался, затем по суммарному количеству.
   */
  frequentlyOrderedIds(userId: number, limit: number): number[] {
    const rows = db
      .prepare(
        `SELECT oi.product_id AS id
         FROM order_items oi
         JOIN orders o ON o.id = oi.order_id
         WHERE o.user_id = ?
         GROUP BY oi.product_id
         ORDER BY COUNT(DISTINCT oi.order_id) DESC, SUM(oi.quantity) DESC
         LIMIT ?`,
      )
      .all(userId, limit) as Array<{ id: number }>;
    return rows.map((r) => r.id);
  },
};
