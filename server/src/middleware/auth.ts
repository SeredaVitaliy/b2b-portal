import type { NextFunction, Request, Response } from "express";
import type { Role } from "@b2b/shared";
import { verifyAccessToken } from "../auth/jwt";

/** Проверяет Bearer-токен и кладёт пользователя в req.user. */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "unauthorized", message: "Нет токена доступа" });
    return;
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: "unauthorized", message: "Токен недействителен или истёк" });
  }
}

/** Пропускает только указанные роли. Использовать после authenticate. */
export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "forbidden", message: "Недостаточно прав" });
      return;
    }
    next();
  };
}
