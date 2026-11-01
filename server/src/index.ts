import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { config } from "./config";
import { initSchema } from "./db";
import { authRouter } from "./routes/auth";
import { catalogRouter } from "./routes/catalog";
import { orderRouter } from "./routes/orders";
import { favoritesRouter } from "./routes/favorites";
import { templateRouter } from "./routes/templates";
import { userRouter } from "./routes/users";
import { stockRouter } from "./routes/stock";
import { attachStockWebSocket } from "./ws/stock";

initSchema();

const app = express();
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api", catalogRouter);
app.use("/api", orderRouter);
app.use("/api", favoritesRouter);
app.use("/api", templateRouter);
app.use("/api", userRouter);
app.use("/api", stockRouter);

// WebSocket живёт на том же порту, что и HTTP, поэтому оборачиваем Express
// в http-сервер и слушаем уже его (а не app.listen напрямую).
const server = createServer(app);
attachStockWebSocket(server);

server.listen(config.port, () => {
  console.log(`API слушает http://localhost:${config.port}`);
});
