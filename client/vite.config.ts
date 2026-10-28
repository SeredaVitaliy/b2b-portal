import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@b2b/shared": path.resolve(__dirname, "../shared/src/index.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Всё, что уходит на /api, dev-сервер Vite проксирует на бэкенд.
      // Благодаря этому фронт ходит на относительный /api и в dev нет CORS-проблем.
      "/api": "http://localhost:4000",
    },
  },
});
