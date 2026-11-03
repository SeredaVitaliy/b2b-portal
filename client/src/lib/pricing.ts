import type { Product, PriceOverrides } from "@b2b/shared";

function effective(
  draft: Record<number, number | null>,
  server: Record<number, number>,
  id: number,
): number | null | undefined {
  if (draft[id] !== undefined) return draft[id];
  return server[id];
}

export interface ResolvedPrice {
  price: number;
  source: "product" | "category" | "base";
  discountPct: number;
}

export function resolvePrice(
  product: Product,
  overrides: PriceOverrides,
  productDrafts: Record<number, number | null>,
  categoryDrafts: Record<number, number | null>,
): ResolvedPrice {
  const prod = effective(productDrafts, overrides.products, product.id);
  const cat = effective(
    categoryDrafts,
    overrides.categories,
    product.categoryId,
  );

  let price = product.basePrice;
  let source: ResolvedPrice["source"] = "base";
  if (typeof cat === "number") {
    price = cat;
    source = "category";
  }
  if (typeof prod === "number") {
    price = prod;
    source = "product";
  }

  const discountPct =
    product.basePrice > 0
      ? Math.round((1 - price / product.basePrice) * 100)
      : 0;
  return { price, source, discountPct };
}
