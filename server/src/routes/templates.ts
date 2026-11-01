import { Router } from "express";
import type { CreateOrderTemplateRequest } from "@b2b/shared";
import { authenticate } from "../middleware/auth";
import { templateRepo, TemplateError } from "../repositories/templateRepo";

export const templateRouter = Router();

// Шаблоны доступны только авторизованным пользователям.
templateRouter.use(authenticate);

// GET /api/templates — шаблоны текущего пользователя.
templateRouter.get("/templates", (req, res) => {
  res.json(templateRepo.listByUser(req.user!.id));
});

// POST /api/templates — сохранить набор позиций как шаблон.
templateRouter.post("/templates", (req, res) => {
  const userId = req.user!.id;
  const body = req.body as CreateOrderTemplateRequest;

  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: "bad_request", message: "Укажите название шаблона" });
    return;
  }
  if (!Array.isArray(body.items) || body.items.length === 0) {
    res.status(400).json({ error: "bad_request", message: "Шаблон пуст" });
    return;
  }

  // Берём только нужные поля и приводим к числам — остальному из тела не доверяем.
  const items = body.items.map((i) => ({
    productId: Number(i.productId),
    quantity: Number(i.quantity),
  }));
  if (
    items.some(
      (i) =>
        !Number.isFinite(i.productId) ||
        !Number.isFinite(i.quantity) ||
        i.quantity <= 0,
    )
  ) {
    res.status(400).json({ error: "bad_request", message: "Некорректные позиции" });
    return;
  }

  try {
    const template = templateRepo.create({ userId, name, items });
    res.status(201).json(template);
  } catch (e) {
    if (e instanceof TemplateError) {
      res.status(400).json({ error: "bad_request", message: e.message });
      return;
    }
    throw e;
  }
});

// DELETE /api/templates/:id — удалить свой шаблон.
templateRouter.delete("/templates/:id", (req, res) => {
  const removed = templateRepo.remove(req.user!.id, Number(req.params.id));
  if (!removed) {
    res.status(404).json({ error: "not_found", message: "Шаблон не найден" });
    return;
  }
  res.status(204).end();
});
