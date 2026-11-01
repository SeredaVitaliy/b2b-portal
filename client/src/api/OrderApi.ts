import { CreateOrderItem, Order, Product } from "@b2b/shared";
import api from "./axiosInstance";

export async function createOrder(
  items: CreateOrderItem[],
  comment?: string,
  desiredDeliveryDate?: string,
): Promise<Order> {
  try {
    const response = await api.post<Order>("/orders", {
      items,
      comment,
      desiredDeliveryDate,
    });
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

export async function getFrequentlyOrdered(): Promise<Product[]> {
  try {
    const response = await api.get<Product[]>("/orders/frequent");
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки часто заказываемых:", error);
    throw error;
  }
}
