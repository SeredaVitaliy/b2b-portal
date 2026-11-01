import { StockSnapshotItem } from "@b2b/shared";
import api from "./axiosInstance";

export async function getStockSnapshot(): Promise<StockSnapshotItem[]> {
  try {
    const response = await api.get<StockSnapshotItem[]>("/stock");
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки остатков:", error);
    throw error;
  }
}
