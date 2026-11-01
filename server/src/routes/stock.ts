import { Router } from "express";
import type { StockSnapshotItem } from "@b2b/shared";
import { authenticate } from "../middleware/auth";
import { db } from "../db";
import { stockStatus } from "../lib/stock";

export const stockRouter = Router();

stockRouter.use(authenticate);

// GET /api/stock — снимок остатков всех товаров.
// Нужен клиенту как РЕЗЕРВНЫЙ источник: если WebSocket недоступен, фронт
// временно опрашивает этот эндпоинт, пока соединение не восстановится.
stockRouter.get("/stock", (_req, res) => {
  const rows = db.prepare("SELECT id, stock FROM products").all() as Array<{
    id: number;
    stock: number;
  }>;
  const snapshot: StockSnapshotItem[] = rows.map((r) => ({
    productId: r.id,
    stock: r.stock,
    stockStatus: stockStatus(r.stock),
  }));
  res.json(snapshot);
});
