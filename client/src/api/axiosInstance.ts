import axios from "axios";
import { tokenManager } from "./tokenStorage";
import { clearUser } from "@/slices/authSlice";
import { store } from "@/store/store";

const api = axios.create({
  baseURL: "http://localhost:4000/api",
});

api.interceptors.request.use((config) => {
  const token = tokenManager.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshTokenValue = localStorage.getItem("refreshToken");
        if (!refreshTokenValue) {
          return Promise.reject(error);
        }
        const response = await axios.post(
          "http://localhost:4000/api/auth/refresh",
          { refreshToken: refreshTokenValue },
        );
        const { accessToken, refreshToken } = response.data;

        tokenManager.setAccessToken(accessToken);
        localStorage.setItem("refreshToken", refreshToken);

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        tokenManager.clearAccessToken();
        store.dispatch(clearUser());

        localStorage.removeItem("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
