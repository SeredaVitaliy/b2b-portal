import { Router, type Request, type Response } from "express";
import type { ChangePasswordRequest, UpdateProfileRequest } from "@b2b/shared";
import { authenticate } from "../middleware/auth";
import { userRepo, ProfileError } from "../repositories/userRepo";

export const profileRouter = Router();

// Все роуты профиля — для текущего вошедшего пользователя (любая роль).

// GET /api/me — профиль текущего пользователя (с компанией и договором).
profileRouter.get("/me", authenticate, (req: Request, res: Response) => {
  const profile = userRepo.getProfile(req.user!.id);
  if (!profile) {
    res.status(404).json({ error: "not_found", message: "Пользователь не найден" });
    return;
  }
  res.json(profile);
});

// PATCH /api/me — изменить своё имя/телефон (не роль и не договор).
profileRouter.patch("/me", authenticate, (req: Request, res: Response) => {
  const body = req.body as UpdateProfileRequest;
  const changes: { name?: string; phone?: string | null } = {};

  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      res.status(400).json({ error: "bad_request", message: "Имя не может быть пустым" });
      return;
    }
    changes.name = name;
  }
  if (body.phone !== undefined) {
    changes.phone =
      typeof body.phone === "string" && body.phone.trim()
        ? body.phone.trim()
        : null;
  }

  res.json(userRepo.updateProfile(req.user!.id, changes));
});

// POST /api/me/password — смена пароля (нужен текущий; нельзя сменить вслепую).
profileRouter.post(
  "/me/password",
  authenticate,
  (req: Request, res: Response) => {
    const body = req.body as ChangePasswordRequest;
    const current =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const next = typeof body.newPassword === "string" ? body.newPassword : "";

    if (!current || !next) {
      res.status(400).json({ error: "bad_request", message: "Нужны текущий и новый пароль" });
      return;
    }
    if (next.length < 6) {
      res.status(400).json({ error: "bad_request", message: "Новый пароль — минимум 6 символов" });
      return;
    }

    try {
      userRepo.changePassword(req.user!.id, current, next);
      res.status(204).end();
    } catch (e) {
      if (e instanceof ProfileError) {
        res.status(400).json({ error: "bad_request", message: e.message });
        return;
      }
      throw e;
    }
  },
);
