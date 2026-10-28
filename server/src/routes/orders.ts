import { Router } from "express";
import type { CreateOrderRequest } from "@b2b/shared";
import { authenticate } from "../middleware/auth";
import { orderRepo, OrderError } from "../repositories/orderRepo";

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

  try {
    const order = orderRepo.create({ userId, items });
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

// GET /api/orders/:id — один заказ (только свой).
orderRouter.get("/orders/:id", (req, res) => {
  const order = orderRepo.getById(req.user!.id, Number(req.params.id));
  if (!order) {
    res.status(404).json({ error: "not_found", message: "Заказ не найден" });
    return;
  }
  res.json(order);
});
