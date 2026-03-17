import { Router } from "express";
import { handleExecuteTool } from "../tools/execute.js";

export const toolsRouter = Router();

toolsRouter.post("/execute", async (req, res) => {
  const result = await handleExecuteTool(req.body);
  res.status(result.status).json(result.body);
});
