import { CreateOrderItem, Order } from "@b2b/shared";
import api from "./axiosInstance";

export async function createOrder(items: CreateOrderItem[]): Promise<Order> {
  try {
    const response = await api.post<Order>("/orders", { items });
    return response.data;
  } catch (error) {
    console.error("Ошибка оформления заказа:", error);
    throw error;
  }
}

export async function getOrders(): Promise<Order[]> {
  try {
    const response = await api.get<Order[]>("/orders");
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки заказов:", error);
    throw error;
  }
}

export async function getOrder(id: number): Promise<Order> {
  try {
    const response = await api.get<Order>(`/orders/${id}`);
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки заказа:", error);
    throw error;
  }
}
