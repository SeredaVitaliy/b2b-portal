import type { Role } from "@b2b/shared";

// Расширяем тип Request, чтобы после authenticate() в req.user лежал пользователь.
declare global {
  namespace Express {
    interface Request {
      user?: { id: number; role: Role };
    }
  }
}

export {};
