import { Category, Paginated, Product } from "@b2b/shared";
import api from "./axiosInstance";

export type ProductSort =
  | "price_asc"
  | "price_desc"
  | "name_asc"
  | "name_desc"
  | "popularity";

export interface ProductParams {
  categoryId?: number;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}

export async function getCategories(): Promise<Category[]> {
  try {
    const response = await api.get<Category[]>("/categories");
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки категорий:", error);
    throw error;
  }
}

export async function getProducts(
  params: ProductParams,
): Promise<Paginated<Product>> {
  try {
    const response = await api.get<Paginated<Product>>("/products", { params });
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки товаров:", error);
    throw error;
  }
}

export async function getProduct(id: number): Promise<Product> {
  try {
    const response = await api.get<Product>(`/products/${id}`);
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки товара:", error);
    throw error;
  }
}
