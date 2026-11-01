import type { Server } from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import type { StockUpdateMessage } from "@b2b/shared";
import { db } from "../db";
import { stockStatus } from "../lib/stock";

// Единственный WS-сервер приложения. Держим ссылку, чтобы из broadcast достучаться
// до списка подключённых клиентов.
let wss: WebSocketServer | null = null;

/** Разослать обновление остатка всем открытым подключениям. */
function broadcast(update: StockUpdateMessage): void {
  if (!wss) return;
  const data = JSON.stringify(update);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

/**
 * Рассылает актуальный остаток по указанным товарам всем клиентам.
 * Вызывается после реального события (например, оформления заказа): берём
 * свежий остаток из БД и толкаем его всем открытым каталогам/корзинам.
 */
export function broadcastStockFor(productIds: number[]): void {
  const getStock = db.prepare("SELECT stock FROM products WHERE id = ?");
  for (const productId of new Set(productIds)) {
    const row = getStock.get(productId) as { stock: number } | undefined;
    if (!row) continue;
    broadcast({
      type: "stock",
      productId,
      stock: row.stock,
      stockStatus: stockStatus(row.stock),
      updatedAt: Date.now(),
    });
  }
}

/** Поднимает WS-сервер на пути /ws/stock поверх HTTP-сервера. */
export function attachStockWebSocket(server: Server): void {
  wss = new WebSocketServer({ server, path: "/ws/stock" });
  console.log("WS остатков слушает ws://localhost:<порт>/ws/stock");
}
