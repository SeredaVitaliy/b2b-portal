import express from "express";
import cors from "cors";
import { config } from "./config";
import { initSchema } from "./db";
import { authRouter } from "./routes/auth";
import { catalogRouter } from "./routes/catalog";
import { orderRouter } from "./routes/orders";

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

app.listen(config.port, () => {
  console.log(`API слушает http://localhost:${config.port}`);
});
