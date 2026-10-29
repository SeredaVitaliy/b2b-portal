import { Router } from "express";
import { authenticate } from "../middleware/auth";
import {
  catalogRepo,
  type ProductQuery,
  type ProductSort,
} from "../repositories/catalogRepo";

export const catalogRouter = Router();

// Каталог доступен только авторизованным пользователям.
catalogRouter.use(authenticate);

// GET /api/categories
catalogRouter.get("/categories", (_req, res) => {
  res.json(catalogRepo.listCategories());
});

const SORTS: ProductSort[] = [
  "price_asc",
  "price_desc",
  "name_asc",
  "name_desc",
  "popularity",
];

function parseNumber(value: unknown): number | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

// GET /api/products?categoryId=&search=&minPrice=&maxPrice=&inStock=&sort=&page=&pageSize=
catalogRouter.get("/products", (req, res) => {
  const { categoryId, search, minPrice, maxPrice, inStock, sort, page, pageSize } =
    req.query;

  const sortValue =
    typeof sort === "string" && SORTS.includes(sort as ProductSort)
      ? (sort as ProductSort)
      : undefined;

  const query: ProductQuery = {
    categoryId: parseNumber(categoryId),
    search: typeof search === "string" && search.trim() ? search.trim() : undefined,
    minPrice: parseNumber(minPrice),
    maxPrice: parseNumber(maxPrice),
    inStock: inStock === "true" || inStock === "1",
    sort: sortValue,
    page: Math.max(1, parseNumber(page) ?? 1),
    pageSize: Math.min(100, Math.max(1, parseNumber(pageSize) ?? 20)),
  };

  res.json(catalogRepo.listProducts(query));
});

// GET /api/products/batch?ids=1,2,3 — актуальные товары по списку id (для «Повторить заказ»).
// Должен быть ВЫШЕ /products/:id, иначе "batch" попадёт в :id.
catalogRouter.get("/products/batch", (req, res) => {
  const raw = typeof req.query.ids === "string" ? req.query.ids : "";
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
  res.json(catalogRepo.getProductsByIds(ids));
});

// GET /api/products/:id
catalogRouter.get("/products/:id", (req, res) => {
  const id = Number(req.params.id);
  const product = catalogRepo.getProduct(id);
  if (!product) {
    res.status(404).json({ error: "not_found", message: "Товар не найден" });
    return;
  }
  res.json(product);
});
