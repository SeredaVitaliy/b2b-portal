import { Router, type Request, type Response } from "express";
import type { ChangeField } from "@b2b/shared";
import { authenticate, authorize } from "../middleware/auth";
import { historyRepo } from "../repositories/historyRepo";

export const historyRouter = Router();

// Историю изменений смотрят менеджеры/админы (разбор спорных ситуаций).
// Гвард — пол-роутно (роутеры висят на общем "/api").
const editorOnly = [authenticate, authorize("manager", "admin")];

const MAX_PAGE_SIZE = 100;

function parseField(value: unknown): ChangeField | undefined {
  return value === "price" || value === "stock" ? value : undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// Дату 'YYYY-MM-DD' переводим в unix-секунды. start=true — начало дня (00:00:00),
// иначе конец дня (23:59:59), чтобы верхняя граница периода была включительной.
function parseDay(value: unknown, start: boolean): number | undefined {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return undefined;
  }
  const ms = Date.parse(`${value}T${start ? "00:00:00" : "23:59:59"}`);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : undefined;
}

// GET /api/price-history?productId=&search=&field=&from=&to=&page=&pageSize=
// Без productId/search — вся история; productId — по одному товару (модалка);
// search — поиск по артикулу/названию (общая страница).
historyRouter.get("/price-history", editorOnly, (req: Request, res: Response) => {
  const { productId, search, field, from, to, page, pageSize } = req.query;

  res.json(
    historyRepo.list({
      productId: parseNumber(productId),
      search:
        typeof search === "string" && search.trim() ? search.trim() : undefined,
      field: parseField(field),
      fromTs: parseDay(from, true),
      toTs: parseDay(to, false),
      page: Math.max(1, parseNumber(page) ?? 1),
      pageSize: Math.min(MAX_PAGE_SIZE, Math.max(1, parseNumber(pageSize) ?? 20)),
    }),
  );
});
