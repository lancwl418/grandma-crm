import { Router } from "express";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { handleParse } from "../parseHandler.js";

export const parseRouter = Router();

parseRouter.post("/", rateLimiter, async (req, res) => {
  const result = await handleParse(req.body);
  res.status(result.status).json(result.body);
});
