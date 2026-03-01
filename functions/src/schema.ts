import { z } from "zod";

// ── Request Schema ─────────────────────────────────────────

export const ParseRequestSchema = z.object({
  utterance: z.string().min(1).max(500),
  locale: z.string().optional().default("zh-CN"),
  sessionHints: z
    .object({
      lastClientName: z.string().optional(),
      lastIntent: z.string().optional(),
    })
    .optional(),
});

export type ParseRequest = z.infer<typeof ParseRequestSchema>;

// ── LLM Response Schema (validates LLM output) ────────────

const VALID_INTENTS = [
  "FIND_CLIENT",
  "CREATE_TASK",
  "ADD_CLIENT",
  "VIEW_TODAY",
  "GREETING",
  "UNKNOWN",
] as const;

export const LLMResponseSchema = z.object({
  intent: z.enum(VALID_INTENTS),
  slots: z
    .object({
      clientQuery: z.string().optional(),
      action: z.string().optional(),
      dueDateText: z.string().optional(),
    })
    .default({}),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;
