import { Router, type Request, type Response } from "express";
import type {
  OverrideScope,
  PriceOverrides,
  SetContractRequest,
} from "@b2b/shared";
import { authenticate, authorize } from "../middleware/auth";
import { priceRepo } from "../repositories/priceRepo";
import { userRepo } from "../repositories/userRepo";

export const pricingRouter = Router();

// Персональные цены ведут менеджеры/админы. Гвард — пол-роутно (роутеры висят
// на общем "/api", router-level authorize ложно блокировал бы соседей).
const editorOnly = [authenticate, authorize("manager", "admin")];

// GET /api/my-price-overrides — переопределения компании ТЕКУЩЕГО закупщика.
// Доступно любому вошедшему: клиент считает по ним свою цену в каталоге/корзине.
// Нет компании (например, у админа каталога) — пустые переопределения.
pricingRouter.get(
  "/my-price-overrides",
  authenticate,
  (req: Request, res: Response) => {
  const user = userRepo.findById(req.user!.id);
  const companyId = user?.companyId ?? null;
  const result: PriceOverrides =
    companyId != null
      ? priceRepo.getOverrides(companyId)
      : { companyId: 0, products: {}, categories: {} };
  res.json(result);
});

function parseScope(value: unknown): OverrideScope | null {
  return value === "product" || value === "category" ? value : null;
}

// GET /api/clients — список клиентов (компаний).
pricingRouter.get("/clients", editorOnly, (_req, res) => {
  res.json(priceRepo.listCompanies());
});

// PATCH /api/clients/:id/contract — номер договора клиента (админ/менеджер).
pricingRouter.patch(
  "/clients/:id/contract",
  editorOnly,
  (req: Request, res: Response) => {
    const companyId = Number(req.params.id);
    if (!Number.isInteger(companyId) || !priceRepo.companyExists(companyId)) {
      res.status(404).json({ error: "not_found", message: "Клиент не найден" });
      return;
    }
    const body = req.body as SetContractRequest;
    const contractNumber =
      typeof body.contractNumber === "string" && body.contractNumber.trim()
        ? body.contractNumber.trim()
        : null;
    res.json(priceRepo.setContract(companyId, contractNumber));
  },
);

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
