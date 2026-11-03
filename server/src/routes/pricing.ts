import { Router } from "express";
import type { OverrideScope } from "@b2b/shared";
import { authenticate, authorize } from "../middleware/auth";
import { priceRepo } from "../repositories/priceRepo";

export const pricingRouter = Router();

// Персональные цены ведут менеджеры/админы. Гвард — пол-роутно (роутеры висят
// на общем "/api", router-level authorize ложно блокировал бы соседей).
const editorOnly = [authenticate, authorize("manager", "admin")];

function parseScope(value: unknown): OverrideScope | null {
  return value === "product" || value === "category" ? value : null;
}

// GET /api/clients — список клиентов (компаний).
pricingRouter.get("/clients", editorOnly, (_req, res) => {
  res.json(priceRepo.listCompanies());
});

// GET /api/price-overrides/:companyId — переопределения клиента.
pricingRouter.get("/price-overrides/:companyId", editorOnly, (req, res) => {
  const companyId = Number(req.params.companyId);
  if (!Number.isInteger(companyId) || !priceRepo.companyExists(companyId)) {
    res.status(404).json({ error: "not_found", message: "Клиент не найден" });
    return;
  }
  res.json(priceRepo.getOverrides(companyId));
});

// PUT /api/price-overrides — задать/обновить одно переопределение.
pricingRouter.put("/price-overrides", editorOnly, (req, res) => {
  const body = req.body as {
    companyId?: unknown;
    scope?: unknown;
    refId?: unknown;
    price?: unknown;
  };
  const companyId = Number(body.companyId);
  const scope = parseScope(body.scope);
  const refId = Number(body.refId);
  const price = body.price;

  if (!Number.isInteger(companyId) || !priceRepo.companyExists(companyId)) {
    res.status(404).json({ error: "not_found", message: "Клиент не найден" });
    return;
  }
  if (!scope || !Number.isInteger(refId) || refId <= 0) {
    res.status(400).json({ error: "bad_request", message: "Некорректный scope или refId" });
    return;
  }
  if (typeof price !== "number" || !Number.isFinite(price) || price < 0) {
    res.status(400).json({ error: "bad_request", message: "Цена должна быть числом ≥ 0" });
    return;
  }

  res.json(priceRepo.setOverride(companyId, scope, refId, price));
});

// DELETE /api/price-overrides — снять переопределение (вернуть наследование).
pricingRouter.delete("/price-overrides", editorOnly, (req, res) => {
  const body = req.body as { companyId?: unknown; scope?: unknown; refId?: unknown };
  const companyId = Number(body.companyId);
  const scope = parseScope(body.scope);
  const refId = Number(body.refId);

  if (!Number.isInteger(companyId) || !priceRepo.companyExists(companyId)) {
    res.status(404).json({ error: "not_found", message: "Клиент не найден" });
    return;
  }
  if (!scope || !Number.isInteger(refId) || refId <= 0) {
    res.status(400).json({ error: "bad_request", message: "Некорректный scope или refId" });
    return;
  }

  res.json(priceRepo.deleteOverride(companyId, scope, refId));
});
