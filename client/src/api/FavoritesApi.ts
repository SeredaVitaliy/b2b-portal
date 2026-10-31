import { Product } from "@b2b/shared";
import api from "./axiosInstance";

export async function getFavorites(): Promise<Product[]> {
  try {
    const response = await api.get<Product[]>("/favorites");
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки избранного:", error);
    throw error;
  }
}

export async function addFavoriteApi(productId: number): Promise<void> {
  try {
    await api.post(`/favorites/${productId}`);
  } catch (error) {
    console.error("Ошибка добавления в избранное:", error);
    throw error;
  }
}

export async function removeFavoriteApi(productId: number): Promise<void> {
  try {
    await api.delete(`/favorites/${productId}`);
  } catch (error) {
    console.error("Ошибка удаления из избранного:", error);
    throw error;
  }
}
