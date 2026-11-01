import { CreateOrderTemplateItem, OrderTemplate } from "@b2b/shared";
import api from "./axiosInstance";

export async function getTemplates(): Promise<OrderTemplate[]> {
  try {
    const response = await api.get<OrderTemplate[]>("/templates");
    return response.data;
  } catch (error) {
    console.error();
    console.error("Ошибка загрузки шаблонов:", error);
    throw error;
  }
}

export async function createTemplate(
  name: string,
  items: CreateOrderTemplateItem[],
): Promise<OrderTemplate> {
  try {
    const response = await api.post<OrderTemplate>("/templates", {
      name,
      items,
    });
    return response.data;
  } catch (error) {
    console.error("Ошибка сохранения шаблона:", error);
    throw error;
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  try {
    await api.delete(`/templates/${id}`);
  } catch (error) {
    console.error("Ошибка удаления шаблона:", error);
    throw error;
  }
}
