import { Role, User } from "@b2b/shared";
import api from "./axiosInstance";

export async function getUsers(): Promise<User[]> {
  try {
    const response = await api.get<User[]>("/users");
    return response.data;
  } catch (error) {
    console.error("Ошибка загрузки пользователей:", error);
    throw error;
  }
}

export async function updateUserRole(id: number, role: Role): Promise<User> {
  try {
    const response = await api.patch<User>(`/users/${id}/role`, { role });
    return response.data;
  } catch (error) {
    console.error("Ошибка смены роли:", error);
    throw error;
  }
}
