import type { StockStatus } from "@b2b/shared";

/** Порог, ниже которого остаток считаем "мало". */
export const LOW_STOCK_THRESHOLD = 15;

/** Три состояния наличия вместо бинарного флага (урок из резюме). */
export function stockStatus(stock: number): StockStatus {
  if (stock <= 0) return "out";
  if (stock <= LOW_STOCK_THRESHOLD) return "low";
  return "in_stock";
}
