import { Router } from "express";
import type { CreateOrderRequest } from "@b2b/shared";
import { authenticate } from "../middleware/auth";
import { orderRepo, OrderError } from "../repositories/orderRepo";
import { catalogRepo } from "../repositories/catalogRepo";

export const orderRouter = Router();

// Заказы доступны только авторизованным пользователям.
orderRouter.use(authenticate);

// POST /api/orders — оформить заказ из корзины.
orderRouter.post("/orders", (req, res) => {
  const userId = req.user!.id;
  const body = req.body as CreateOrderRequest;

  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: "bad_request", message: "Корзина пуста" });
    return;
  }

  // Берём только нужные поля и приводим к числам — остальному из тела не доверяем.
  const items = body.items.map((i) => ({
    productId: Number(i.productId),
    quantity: Number(i.quantity),
  }));
  if (
    items.some((i) => !Number.isFinite(i.productId) || !Number.isFinite(i.quantity))
  ) {
    res.status(400).json({ error: "bad_request", message: "Некорректные позиции" });
    return;
  }

  // Комментарий и дата доставки — необязательные. Текст подрезаем, дату принимаем
  // только в строгом формате YYYY-MM-DD, иначе пишем null (мусору из тела не доверяем).
  const comment =
    typeof body.comment === "string" && body.comment.trim()
      ? body.comment.trim().slice(0, 1000)
      : null;
  const desiredDeliveryDate =
    typeof body.desiredDeliveryDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(body.desiredDeliveryDate)
      ? body.desiredDeliveryDate
      : null;

  try {
    const order = orderRepo.create({ userId, items, comment, desiredDeliveryDate });
    res.status(201).json(order);
  } catch (e) {
    if (e instanceof OrderError) {
      res.status(400).json({ error: "bad_request", message: e.message });
      return;
    }
    throw e;
  }
});

// GET /api/orders — история заказов текущего пользователя.
orderRouter.get("/orders", (req, res) => {
  res.json(orderRepo.listByUser(req.user!.id));
});

// GET /api/orders/frequent — часто заказываемые товары пользователя.
// Должен быть ВЫШЕ /orders/:id, иначе "frequent" попадёт в :id.
orderRouter.get("/orders/frequent", (req, res) => {
  const ids = orderRepo.frequentlyOrderedIds(req.user!.id, 8);
  const byId = new Map(catalogRepo.getProductsByIds(ids).map((p) => [p.id, p]));
  // Восстанавливаем порядок ранжирования (getProductsByIds отдаёт в произвольном порядке).
  res.json(ids.map((id) => byId.get(id)).filter((p) => p !== undefined));
});

// GET /api/orders/:id — один заказ (только свой).
orderRouter.get("/orders/:id", (req, res) => {
  const order = orderRepo.getById(req.user!.id, Number(req.params.id));
  if (!order) {
    res.status(404).json({ error: "not_found", message: "Заказ не найден" });
    return;
  }
  res.json(order);
});
