import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { parseRouter } from "./routes/parse.js";
import { toolsRouter } from "./routes/tools.js";
import { chatRouter } from "./routes/chat.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// CORS
const allowedOrigins = [
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

// Routes
app.use("/api/parse", parseRouter);
app.use("/api/tools", toolsRouter);
app.use("/api/chat", chatRouter);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
