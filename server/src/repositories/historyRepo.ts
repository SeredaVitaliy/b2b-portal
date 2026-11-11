import type { ChangeField, Paginated, ProductChange } from "@b2b/shared";
import { db } from "../db";

// Одна запись для вставки в журнал. Собирается в catalogRepo при массовом
// обновлении (старое → новое значение уже известны).
export interface HistoryEntry {
  productId: number;
  userId: number;
  field: ChangeField;
  oldValue: number;
  newValue: number;
  changedAt: number;
}

// Фильтры/пагинация для чтения. from/to уже приведены к unix-секундам в роуте.
export interface HistoryQuery {
  productId?: number;
  search?: string;
  field?: ChangeField;
  fromTs?: number;
  toTs?: number;
  page: number;
  pageSize: number;
}

interface HistoryRow {
  id: number;
  product_id: number;
  sku: string;
  product_name: string;
  field: ChangeField;
  old_value: number;
  new_value: number;
  user_id: number;
  user_name: string;
  changed_at: number;
}

function mapRow(r: HistoryRow): ProductChange {
  return {
    id: r.id,
    productId: r.product_id,
    sku: r.sku,
    productName: r.product_name,
    field: r.field,
    oldValue: r.old_value,
    newValue: r.new_value,
    userId: r.user_id,
    userName: r.user_name,
    changedAt: r.changed_at,
  };
}

export const historyRepo = {
  // Пишет пачку записей. НЕ оборачивает в свою транзакцию намеренно: вызывается
  // ВНУТРИ транзакции bulkUpdate, чтобы правка товара и запись в журнал легли
  // атомарно (либо вместе, либо никак).
  insertMany(entries: HistoryEntry[]): void {
    // Готовим запрос внутри метода (не на верхнем уровне модуля): иначе prepare
    // выполнился бы при импорте — ДО initSchema(), когда таблицы ещё нет.
    const insertStmt = db.prepare(
      `INSERT INTO price_history (product_id, user_id, field, old_value, new_value, changed_at)
       VALUES (@productId, @userId, @field, @oldValue, @newValue, @changedAt)`,
    );
    for (const e of entries) insertStmt.run(e);
  },

  // Список истории с фильтрами и серверной пагинацией. sku/имя товара и имя
  // автора берём join'ом — журнал хранит только id, а показываем читаемое.
  list(q: HistoryQuery): Paginated<ProductChange> {
    const where: string[] = [];
    const params: Record<string, unknown> = {};

    if (q.productId != null) {
      where.push("h.product_id = @productId");
      params.productId = q.productId;
    }
    if (q.field) {
      where.push("h.field = @field");
      params.field = q.field;
    }
    if (q.fromTs != null) {
      where.push("h.changed_at >= @fromTs");
      params.fromTs = q.fromTs;
    }
    if (q.toTs != null) {
      where.push("h.changed_at <= @toTs");
      params.toTs = q.toTs;
    }
    if (q.search) {
      // lower_u — Unicode-регистронезависимый поиск (см. db/index.ts), для кириллицы.
      where.push("(lower_u(p.name) LIKE lower_u(@search) OR lower_u(p.sku) LIKE lower_u(@search))");
      params.search = `%${q.search}%`;
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const fromJoin = `FROM price_history h
       JOIN products p ON p.id = h.product_id
       JOIN users u ON u.id = h.user_id
       ${whereSql}`;

    const total = (
      db.prepare(`SELECT COUNT(*) AS c ${fromJoin}`).get(params) as { c: number }
    ).c;

    const offset = (q.page - 1) * q.pageSize;
    const rows = db
      .prepare(
        `SELECT h.id, h.product_id, p.sku, p.name AS product_name, h.field,
                h.old_value, h.new_value, h.user_id, u.name AS user_name, h.changed_at
         ${fromJoin}
         ORDER BY h.changed_at DESC, h.id DESC
         LIMIT @limit OFFSET @offset`,
      )
      .all({ ...params, limit: q.pageSize, offset }) as HistoryRow[];

    return {
      items: rows.map(mapRow),
      total,
      page: q.page,
      pageSize: q.pageSize,
    };
  },
};
