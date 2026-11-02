import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/api/ProductApi";

export const PRODUCTS_QUERY_KEY = ["products", "all"] as const;

export function useAllProducts() {
  return useQuery({
    queryKey: PRODUCTS_QUERY_KEY,
    queryFn: async () => {
      const data = await getProducts({ pageSize: 2000 });
      return data.items;
    },
  });
}
