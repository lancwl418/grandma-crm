import {
  ParseRequestSchema,
  LLMResponseSchema,
  type LLMResponse,
} from "./schema";
import { SYSTEM_PROMPT } from "./prompt";
import { getProvider } from "./providers";

export interface ParseResult {
  status: number;
  body: LLMResponse | { error: string; details?: unknown };
}

export async function handleParse(rawBody: unknown): Promise<ParseResult> {
  const startMs = Date.now();

  // 1. Validate request
  const reqParse = ParseRequestSchema.safeParse(rawBody);
  if (!reqParse.success) {
    console.warn("[Parse] 400 bad_request", {
      fields: Object.keys(reqParse.error.flatten().fieldErrors),
    });
    return {
      status: 400,
      body: {
        error: "Invalid request",
        details: reqParse.error.flatten(),
      },
    };
  }

  const { utterance } = reqParse.data;
  // 脱敏：只记录字符数，不记录原文
  const utteranceLen = utterance.length;

  // 2. Call LLM provider
  const provider = getProvider();
  let rawResult: unknown;

  try {
    rawResult = await provider.parse(utterance, SYSTEM_PROMPT);
  } catch (err) {
    const elapsed = Date.now() - startMs;
    console.error("[Parse] 502 llm_error", {
      provider: provider.name,
      elapsed,
      utteranceLen,
      error: err instanceof Error ? err.message : "unknown",
    });
    return {
      status: 502,
      body: { error: "LLM provider error" },
    };
  }

  // 3. Validate LLM output with Zod
  const llmParse = LLMResponseSchema.safeParse(rawResult);
  if (!llmParse.success) {
    const elapsed = Date.now() - startMs;
    console.error("[Parse] 422 validation_failed", {
      provider: provider.name,
      elapsed,
      utteranceLen,
      fields: Object.keys(llmParse.error.flatten().fieldErrors),
    });
    return {
      status: 422,
      body: {
        error: "LLM output validation failed",
        details: llmParse.error.flatten(),
      },
    };
  }

  // 4. 成功日志（脱敏：只记录 intent + confidence + 耗时）
  const elapsed = Date.now() - startMs;
  console.info("[Parse] 200 ok", {
    intent: llmParse.data.intent,
    confidence: llmParse.data.confidence,
    elapsed,
    utteranceLen,
    provider: provider.name,
  });

  return { status: 200, body: llmParse.data };
}
