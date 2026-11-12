import { Router, type Request, type Response } from "express";
import type { CreateCategoryRequest, UpdateCategoryRequest } from "@b2b/shared";
import { authenticate, authorize } from "../middleware/auth";
import { categoryRepo, CategoryError } from "../repositories/categoryRepo";

export const categoryRouter = Router();

// Управление деревом категорий — только менеджер/админ. Гвард пол-роутно
// (GET /categories для витрины остаётся в catalogRouter, без гварда ролей).
const editorOnly = [authenticate, authorize("manager", "admin")];

// POST /api/categories — создать категорию (parentId null = корневая).
categoryRouter.post(
  "/categories",
  editorOnly,
  (req: Request, res: Response) => {
    const body = req.body as Partial<CreateCategoryRequest>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "bad_request", message: "Укажите название категории" });
      return;
    }

    let parentId: number | null = null;
    if (body.parentId !== undefined && body.parentId !== null) {
      const p = Number(body.parentId);
      if (!Number.isInteger(p) || !categoryRepo.exists(p)) {
        res.status(400).json({ error: "bad_request", message: "Родительская категория не найдена" });
        return;
      }
      parentId = p;
    }

    res.status(201).json(categoryRepo.create({ name, parentId }));
  },
);

// PATCH /api/categories/:id — переименовать и/или переместить.
categoryRouter.patch(
  "/categories/:id",
  editorOnly,
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !categoryRepo.exists(id)) {
      res.status(404).json({ error: "not_found", message: "Категория не найдена" });
      return;
    }

    const body = req.body as UpdateCategoryRequest;
    const changes: { name?: string; parentId?: number | null } = {};

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) {
        res.status(400).json({ error: "bad_request", message: "Название не может быть пустым" });
        return;
      }
      changes.name = name;
    }
    if (body.parentId !== undefined) {
      if (body.parentId === null) {
        changes.parentId = null;
      } else {
        const p = Number(body.parentId);
        if (!Number.isInteger(p)) {
          res.status(400).json({ error: "bad_request", message: "Некорректный родитель" });
          return;
        }
        changes.parentId = p;
      }
    }

    try {
      res.json(categoryRepo.update(id, changes));
    } catch (e) {
      if (e instanceof CategoryError) {
        res.status(409).json({ error: "conflict", message: e.message });
        return;
      }
      throw e;
    }
  },
);

// DELETE /api/categories/:id — удалить (только пустую: без подкатегорий и товаров).
categoryRouter.delete(
  "/categories/:id",
  editorOnly,
  (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || !categoryRepo.exists(id)) {
      res.status(404).json({ error: "not_found", message: "Категория не найдена" });
      return;
    }

    try {
      categoryRepo.remove(id);
      res.status(204).end();
    } catch (e) {
      if (e instanceof CategoryError) {
        res.status(409).json({ error: "conflict", message: e.message });
        return;
      }
      throw e;
    }
  },
);
