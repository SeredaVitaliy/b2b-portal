import type { AuthTokens, LoginResponse, User } from "@b2b/shared";
import api from "./axiosInstance";

export async function login(
  email: string,
  password: string,
): Promise<LoginResponse> {
  try {
    const response = await api.post<LoginResponse>("/auth/login", {
      email,
      password,
    });

    return response.data;
  } catch (error) {
    console.error("Ошибка обновления токена:", error);
    throw error;
  }
}

export async function logout(refreshToken: string): Promise<void> {
  try {
    await api.post("/auth/logout", { refreshToken });
  } catch (error) {
    console.error("Ошибка выхода:", error);
    throw error;
  }
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  try {
    const response = await api.post<AuthTokens>("/auth/refresh", {
      refreshToken,
    });
    return response.data;
  } catch (error) {
    console.error("Ошибка обновления токена:", error);
    throw error;
  }
}

export async function getMe(): Promise<User> {
  try {
    const response = await api.get<User>("/auth/me");
    return response.data;
  } catch (error) {
    console.error("Ошибка получения профиля:", error);
    throw error;
  }
}
