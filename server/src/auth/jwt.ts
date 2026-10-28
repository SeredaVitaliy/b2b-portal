import jwt from "jsonwebtoken";
import type { Role } from "@b2b/shared";
import { config } from "../config";

/** Полезная нагрузка access-токена: кто пользователь и какая роль. */
export interface AccessPayload {
  sub: number;
  role: Role;
}

type Exp = jwt.SignOptions["expiresIn"];

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessTtl as Exp,
  });
}

export function signRefreshToken(payload: AccessPayload): string {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshTtl as Exp,
  });
}

export function verifyAccessToken(token: string): AccessPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessPayload;
}

export function verifyRefreshToken(token: string): AccessPayload {
  return jwt.verify(token, config.jwt.refreshSecret) as AccessPayload;
}

/** Возвращает unix-время (сек) истечения токена из его claim `exp`. */
export function getTokenExp(token: string): number {
  const decoded = jwt.decode(token) as { exp?: number } | null;
  return decoded?.exp ?? Math.floor(Date.now() / 1000);
}
