import { z } from "zod";

export const VALID_INTENTS = [
  "FIND_CLIENT",
  "CREATE_TASK",
  "ADD_CLIENT",
  "VIEW_TODAY",
  "UPDATE_CLIENT",
  "OPEN_CLIENT",
  "GREETING",
  "UNKNOWN",
] as const;

export type IntentType = (typeof VALID_INTENTS)[number];

// ── Request Schema ─────────────────────────────────────────

export const ParseRequestSchema = z.object({
  utterance: z.string().min(1).max(500),
  locale: z.string().optional().default("zh-CN"),
  sessionHints: z
    .object({
      lastClientId: z.string().optional(),
      lastClientName: z.string().optional(),
      lastIntent: z.enum(VALID_INTENTS).optional(),
      turnCount: z.number().int().min(0).optional(),
    })
    .optional(),
});

export type ParseRequest = z.infer<typeof ParseRequestSchema>;

// ── LLM Response Schema (validates LLM output) ────────────

export const LLMResponseSchema = z.object({
  intent: z.enum(VALID_INTENTS),
  slots: z
    .object({
      clientQuery: z.string().optional(),
      action: z.string().optional(),
      dueDateText: z.string().optional(),
      /** UPDATE_CLIENT: field name (status/urgency/phone/budget/wechat/tags) */
      field: z.string().optional(),
      /** UPDATE_CLIENT: new value for the field */
      value: z.string().optional(),
    })
    .default({}),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

export const ParseSuccessSchema = LLMResponseSchema.extend({
  traceId: z.string().min(1),
});

export type ParseSuccess = z.infer<typeof ParseSuccessSchema>;

export const ParseErrorSchema = z.object({
  error: z.string().min(1),
  traceId: z.string().min(1),
  details: z.unknown().optional(),
});

export type ParseError = z.infer<typeof ParseErrorSchema>;
