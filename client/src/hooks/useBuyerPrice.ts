import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  resolveBuyerPrice,
  type PriceOverrides,
  type Product,
} from "@b2b/shared";
import { getMyOverrides } from "@/api/PricingApi";

const EMPTY: PriceOverrides = { companyId: 0, products: {}, categories: {} };

export function useMyOverrides() {
  return useQuery({
    queryKey: ["my-overrides"],
    queryFn: getMyOverrides,
    staleTime: 5 * 60 * 1000,
  });
}

export interface BuyerPrice {
  price: number;
  base: number;
  isPersonal: boolean;
  discountPct: number;
}

export function useBuyerPrice(product: Product): BuyerPrice {
  const { data: overrides = EMPTY } = useMyOverrides();
  return useMemo(() => {
    const price = resolveBuyerPrice(
      {
        id: product.id,
        categoryId: product.categoryId,
        basePrice: product.basePrice,
      },
      overrides,
    );
    const isPersonal = price !== product.basePrice;
    const discountPct =
      price < product.basePrice
        ? Math.round((1 - price / product.basePrice) * 100)
        : 0;
    return { price, base: product.basePrice, isPersonal, discountPct };
  }, [product.id, product.categoryId, product.basePrice, overrides]);
}
