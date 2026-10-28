// Загружаем переменные окружения из server/.env (Node 22 умеет это нативно).
try {
  process.loadEnvFile();
} catch {
  // .env может отсутствовать — тогда работаем на значениях по умолчанию ниже.
}

export const config = {
  port: Number(process.env.PORT ?? 4000),
  clientOrigin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? "dev-access-secret",
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? "dev-refresh-secret",
    accessTtl: process.env.ACCESS_TOKEN_TTL ?? "15m",
    refreshTtl: process.env.REFRESH_TOKEN_TTL ?? "7d",
  },
  dbPath: process.env.DB_PATH ?? "./data/app.db",
};
