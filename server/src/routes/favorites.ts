import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { favoritesRepo } from "../repositories/favoritesRepo";
import { catalogRepo } from "../repositories/catalogRepo";

export const favoritesRouter = Router();

// Избранное доступно только авторизованным пользователям.
favoritesRouter.use(authenticate);

// GET /api/favorites — актуальные товары из избранного (переиспользуем getProductsByIds).
favoritesRouter.get("/favorites", (req, res) => {
  const ids = favoritesRepo.listIds(req.user!.id);
  res.json(catalogRepo.getProductsByIds(ids));
});

// POST /api/favorites/:id — добавить в избранное.
favoritesRouter.post("/favorites/:id", (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    res.status(400).json({ error: "bad_request", message: "Некорректный товар" });
    return;
  }
  favoritesRepo.add(req.user!.id, productId);
  res.status(204).end();
});

// DELETE /api/favorites/:id — убрать из избранного.
favoritesRouter.delete("/favorites/:id", (req, res) => {
  favoritesRepo.remove(req.user!.id, Number(req.params.id));
  res.status(204).end();
});
