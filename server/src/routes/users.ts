import { Router } from "express";
import type { Role } from "@b2b/shared";
import { authenticate, authorize } from "../middleware/auth";
import { userRepo } from "../repositories/userRepo";

export const userRouter = Router();

const ROLES: Role[] = ["buyer", "manager", "admin"];

// Гвард вешаем НА КАЖДЫЙ роут, а не на весь роутер (userRouter.use(...)):
// роутеры примонтированы на общий "/api", и router-level middleware сработал бы
// для всех запросов /api/*, что ложно блокировало бы соседние роуты.
const adminOnly = [authenticate, authorize("admin")];

// GET /api/users — все пользователи.
userRouter.get("/users", adminOnly, (_req, res) => {
  res.json(userRepo.listAll());
});

// PATCH /api/users/:id/role — сменить роль пользователя.
userRouter.patch("/users/:id/role", adminOnly, (req, res) => {
  const id = Number(req.params.id);
  const role = (req.body as { role?: unknown }).role;

  if (typeof role !== "string" || !ROLES.includes(role as Role)) {
    res.status(400).json({ error: "bad_request", message: "Некорректная роль" });
    return;
  }
  // Защита от самоблокировки: админ не может снять роль сам у себя.
  if (id === req.user!.id) {
    res
      .status(400)
      .json({ error: "bad_request", message: "Нельзя менять собственную роль" });
    return;
  }

  const updated = userRepo.updateRole(id, role as Role);
  if (!updated) {
    res.status(404).json({ error: "not_found", message: "Пользователь не найден" });
    return;
  }
  res.json(updated);
});
