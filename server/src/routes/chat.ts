import { Router } from "express";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { handleChat } from "../chatHandler.js";

export const chatRouter = Router();

chatRouter.post("/", rateLimiter, async (req, res) => {
  const result = await handleChat(req.body);
  res.status(result.status).json(result.body);
});
