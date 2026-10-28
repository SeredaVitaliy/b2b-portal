import { defineConfig, devices } from "@playwright/test";

// E2E-тесты: гоняют весь живой апп (фронт + бэк) в настоящем браузере.
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry", // при падении на повторе сохранит трейс для разбора
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Дев-серверы: если уже запущены — переиспользуем, иначе Playwright стартует сам.
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev:client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
