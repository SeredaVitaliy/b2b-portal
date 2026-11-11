import { ChangeHistoryQuery, Paginated, ProductChange } from "@b2b/shared";
import api from "./axiosInstance";

export async function getPriceHistory(
  params: ChangeHistoryQuery,
): Promise<Paginated<ProductChange>> {
  try {
    const responce = await api.get<Paginated<ProductChange>>("/price-history", {
      params,
    });
    return responce.data;
  } catch (error) {
    console.error("Ошибка загрузки истории изменений:", error);
    throw error;
  }
}
