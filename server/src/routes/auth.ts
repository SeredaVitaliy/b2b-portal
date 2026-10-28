import { Router } from "express";
import type { LoginResponse } from "@b2b/shared";
import { verifyPassword } from "../auth/password";
import {
  getTokenExp,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../auth/jwt";
import { authenticate } from "../middleware/auth";
import { userRepo } from "../repositories/userRepo";
import { refreshTokenRepo } from "../repositories/refreshTokenRepo";

export const authRouter = Router();

/** Выдаёт новую пару токенов и сохраняет refresh в БД. */
function issueTokens(userId: number, role: "buyer" | "manager" | "admin") {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = signRefreshToken({ sub: userId, role });
  refreshTokenRepo.save(userId, refreshToken, getTokenExp(refreshToken));
  return { accessToken, refreshToken };
}

// POST /api/auth/login
authRouter.post("/login", (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== "string" || typeof password !== "string") {
    res.status(400).json({ error: "bad_request", message: "Нужны email и password" });
    return;
  }

  const row = userRepo.findByEmail(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    res.status(401).json({ error: "invalid_credentials", message: "Неверный email или пароль" });
    return;
  }

  const tokens = issueTokens(row.id, row.role);
  const response: LoginResponse = { user: userRepo.toDomain(row), tokens };
  res.json(response);
});

// POST /api/auth/refresh — ротация refresh-токена
authRouter.post("/refresh", (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken !== "string") {
    res.status(400).json({ error: "bad_request", message: "Нужен refreshToken" });
    return;
  }

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    res.status(401).json({ error: "invalid_token", message: "Refresh-токен недействителен" });
    return;
  }

  const stored = refreshTokenRepo.find(refreshToken);
  if (!stored || stored.revoked) {
    res.status(401).json({ error: "invalid_token", message: "Refresh-токен отозван" });
    return;
  }

  // Ротация: старый токен гасим, выдаём новую пару.
  refreshTokenRepo.revoke(refreshToken);
  const tokens = issueTokens(payload.sub, payload.role);
  res.json(tokens);
});

// POST /api/auth/logout
authRouter.post("/logout", (req, res) => {
  const { refreshToken } = req.body ?? {};
  if (typeof refreshToken === "string") {
    refreshTokenRepo.revoke(refreshToken);
  }
  res.status(204).end();
});

// GET /api/auth/me — текущий пользователь по access-токену
authRouter.get("/me", authenticate, (req, res) => {
  const user = userRepo.findById(req.user!.id);
  if (!user) {
    res.status(404).json({ error: "not_found", message: "Пользователь не найден" });
    return;
  }
  res.json(user);
});
