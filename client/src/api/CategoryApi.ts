import {
  Category,
  CreateCategoryRequest,
  UpdateCategoryRequest,
} from "@b2b/shared";
import api from "./axiosInstance";

export async function createCategory(
  body: CreateCategoryRequest,
): Promise<Category> {
  try {
    const response = await api.post<Category>("/categories", body);
    return response.data;
  } catch (error) {
    console.error("Ошибка создания категории:", error);
    throw error;
  }
}
export async function updateCategory(
  id: number,
  body: UpdateCategoryRequest,
): Promise<Category> {
  try {
    const res = await api.patch<Category>(`/categories/${id}`, body);
    return res.data;
  } catch (error) {
    console.error("Ошибка изменения категории:", error);
    throw error;
  }
}

export async function deleteCategory(id: number): Promise<void> {
  try {
    await api.delete(`/categories/${id}`);
  } catch (error) {
    console.error("Ошибка удаления категории:", error);
    throw error;
  }
}
