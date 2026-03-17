import { z } from "zod";
import { TOOL_REGISTRY } from "./registry.js";
import type { ToolName } from "./types.js";

const ExecuteToolRequestSchema = z.object({
  tool: z.string().min(1),
  input: z.unknown().default({}),
  userId: z.string().min(1),
  traceId: z.string().optional(),
});

export interface ExecuteToolResult {
  status: number;
  body: unknown;
}

export async function handleExecuteTool(rawBody: unknown): Promise<ExecuteToolResult> {
  const parsed = ExecuteToolRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        error: "Invalid request",
        details: parsed.error.flatten(),
      },
    };
  }

  const { tool, input, userId, traceId } = parsed.data;
  if (!(tool in TOOL_REGISTRY)) {
    return {
      status: 404,
      body: { error: `Unknown tool: ${tool}` },
    };
  }

  const definition = TOOL_REGISTRY[tool as ToolName];
  const result = await definition.run(input as never, {
    userId,
    traceId: traceId || `tool_${Date.now()}`,
  });

  return {
    status: result.ok ? 200 : 422,
    body: {
      tool,
      ok: result.ok,
      output: result.output,
      error: result.error,
    },
  };
}
