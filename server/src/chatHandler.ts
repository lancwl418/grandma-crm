import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { buildSystemPrompt } from "./chatPrompt.js";
import { CHAT_TOOLS } from "./chatTools.js";
import {
  searchClientTool,
  createTaskTool,
  updateClientTool,
  addClientLogTool,
  getClientDetailTool,
  listClientsByFilterTool,
} from "./tools/implementations.js";
import type { ToolContext } from "./tools/types.js";

const MAX_TOOL_ROUNDS = 5;

// ── Request Schema ──────────────────────────────────────────

const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1),
      })
    )
    .min(1),
  userId: z.string().min(1),
  context: z
    .object({
      todayDate: z.string().optional(),
      overdueTaskCount: z.number().optional().default(0),
      todayTaskCount: z.number().optional().default(0),
    })
    .optional()
    .default({}),
});

// ── Response Types ──────────────────────────────────────────

export interface ChatAction {
  type: string;
  [key: string]: unknown;
}

export interface ChatResponseBody {
  reply: string;
  actions: ChatAction[];
  traceId: string;
  error?: string;
}

export interface ChatResult {
  status: number;
  body: ChatResponseBody;
}

// ── Main Handler ────────────────────────────────────────────

export async function handleChat(rawBody: unknown): Promise<ChatResult> {
  const traceId = randomUUID();
  const startMs = Date.now();

  // 1. Validate request
  const parsed = ChatRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return {
      status: 400,
      body: {
        reply: "",
        actions: [],
        traceId,
        error: "Invalid request",
      },
    };
  }

  const { messages, userId, context } = parsed.data;

  // 2. Build system prompt with context
  const systemPrompt = buildSystemPrompt({
    todayDate:
      context.todayDate || new Date().toISOString().split("T")[0],
    overdueTaskCount: context.overdueTaskCount ?? 0,
    todayTaskCount: context.todayTaskCount ?? 0,
  });

  // 3. Get Anthropic client
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      status: 500,
      body: {
        reply: "",
        actions: [],
        traceId,
        error: "ANTHROPIC_API_KEY not set",
      },
    };
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001";

  // 4. Build Claude messages from conversation history
  const claudeMessages: Anthropic.Messages.MessageParam[] = messages.map(
    (m) => ({
      role: m.role,
      content: m.content,
    })
  );

  // 5. Agentic loop — call Claude, execute tools, repeat
  const toolContext: ToolContext = { userId, traceId };
  const actions: ChatAction[] = [];
  let rounds = 0;

  try {
    while (rounds < MAX_TOOL_ROUNDS) {
      rounds++;

      const response = await client.messages.create({
        model,
        max_tokens: 1024,
        temperature: 0,
        system: systemPrompt,
        tools: CHAT_TOOLS,
        messages: claudeMessages,
      });

      // Separate text and tool_use blocks
      const textBlocks = response.content.filter(
        (b): b is Anthropic.Messages.TextBlock => b.type === "text"
      );
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.Messages.ToolUseBlock => b.type === "tool_use"
      );

      // If no tool calls, we're done
      if (response.stop_reason === "end_turn" || toolUseBlocks.length === 0) {
        const reply = textBlocks.map((b) => b.text).join("\n");
        const elapsed = Date.now() - startMs;
        console.info("[Chat] 200 ok", {
          traceId,
          rounds,
          elapsed,
          model,
        });
        return {
          status: 200,
          body: { reply, actions, traceId },
        };
      }

      // Add assistant message (contains both text and tool_use blocks)
      claudeMessages.push({ role: "assistant", content: response.content });

      // Execute each tool and collect results
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(
          toolUse.name,
          toolUse.input as Record<string, unknown>,
          toolContext,
          actions
        );
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(result),
        });
      }

      // Send tool results back to Claude
      claudeMessages.push({ role: "user", content: toolResults });
    }

    // Max rounds exceeded
    const elapsed = Date.now() - startMs;
    console.warn("[Chat] max_rounds", { traceId, rounds, elapsed });
    return {
      status: 200,
      body: {
        reply: "抱歉，处理过程比较复杂，请简化你的请求再试试。",
        actions,
        traceId,
      },
    };
  } catch (err) {
    const elapsed = Date.now() - startMs;
    console.error("[Chat] 502 llm_error", {
      traceId,
      elapsed,
      error: err instanceof Error ? err.message : "unknown",
    });
    return {
      status: 502,
      body: {
        reply: "",
        actions: [],
        traceId,
        error: "LLM provider error",
      },
    };
  }
}

// ── Tool Execution ──────────────────────────────────────────

async function executeToolCall(
  name: string,
  input: Record<string, unknown>,
  context: ToolContext,
  actions: ChatAction[]
): Promise<unknown> {
  switch (name) {
    // ─ Data tools (execute on server) ─────────────────────
    case "search_clients": {
      return searchClientTool({ query: input.query as string }, context);
    }

    case "create_followup": {
      const result = await createTaskTool(
        {
          clientId: input.clientId as string,
          action: input.action as string,
          dueDateISO: input.dueDate as string,
        },
        context
      );
      if (result.ok) {
        actions.push({
          type: "TASK_CREATED",
          clientId: input.clientId as string,
        });
      }
      return result;
    }

    case "update_client": {
      const result = await updateClientTool(
        {
          clientId: input.clientId as string,
          field: input.field as string,
          value: input.value as string,
        },
        context
      );
      if (result.ok) {
        actions.push({
          type: "CLIENT_UPDATED",
          clientId: input.clientId as string,
          field: input.field as string,
          value: input.value as string,
        });
      }
      return result;
    }

    // ─ UI tools (signals for frontend) ────────────────────
    case "navigate_to_client": {
      actions.push({
        type: "OPEN_CLIENT",
        clientId: input.clientId as string,
        clientName: input.clientName as string,
      });
      return { ok: true, message: "已打开客户详情页" };
    }

    case "open_add_client_form": {
      actions.push({ type: "OPEN_ADD_CLIENT" });
      return { ok: true, message: "已打开新增客户表单" };
    }

    case "show_client_candidates": {
      const candidates = input.candidates as Array<{
        id: string;
        name: string;
        status?: string;
      }>;
      actions.push({ type: "SHOW_CANDIDATES", candidates });
      return { ok: true, message: `已展示 ${candidates.length} 位候选客户` };
    }

    case "show_today_tasks": {
      actions.push({ type: "SHOW_TASKS" });
      return { ok: true, message: "已展示今日任务列表" };
    }

    // ─ New data tools ───────────────────────────────
    case "add_client_log": {
      const result = await addClientLogTool(
        {
          clientId: input.clientId as string,
          content: input.content as string,
          nextAction: input.nextAction as string | undefined,
        },
        context
      );
      if (result.ok) {
        actions.push({
          type: "LOG_ADDED",
          clientId: input.clientId as string,
        });
      }
      return result;
    }

    case "get_client_detail": {
      return getClientDetailTool(
        { clientId: input.clientId as string },
        context
      );
    }

    case "list_clients_by_filter": {
      return listClientsByFilterTool(
        {
          status: input.status as string | undefined,
          urgency: input.urgency as string | undefined,
          limit: input.limit as number | undefined,
        },
        context
      );
    }

    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}
