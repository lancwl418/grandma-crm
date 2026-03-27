/**
 * Chat Engine — LLM-driven conversation via /api/chat
 *
 * Replaces the old state-machine approach. The LLM handles intent
 * understanding, disambiguation, and slot filling through tool use.
 * The frontend just sends messages and executes UI actions from the response.
 */
import type { Client, ClientLog } from "@/crm/types";
import type { FlatTask } from "@/crm/utils/dashboardTasks";

// ── State (simplified — LLM manages conversation state) ─────

export type AssistantMode = "IDLE";

export interface AssistantState {
  mode: AssistantMode;
}

export const INITIAL_STATE: AssistantState = {
  mode: "IDLE",
};

// ── Response Types ──────────────────────────────────────────

export interface ClientCandidate {
  id: string;
  name: string;
  status: string;
  tags: string[];
  areas: string[];
  phone?: string;
}

export type SideEffect =
  | { type: "ADD_LOG"; log: ClientLog; client: Client }
  | { type: "OPEN_CLIENT"; clientId: string }
  | { type: "SEARCH_CLIENT"; query: string }
  | { type: "OPEN_ADD_CLIENT" }
  | { type: "OPEN_ADD_TASK" }
  | { type: "COMPLETE_TASK"; logId: string }
  | { type: "UPDATE_CLIENT"; clientId: string; field: string; value: string };

export interface AssistantResponse {
  text: string;
  newState: AssistantState;
  candidates?: ClientCandidate[];
  tasks?: FlatTask[];
  ctaClientId?: string;
  ctaClientName?: string;
  sideEffects: SideEffect[];
}

export interface ChatContext {
  clients: Client[];
  overdueTasks: FlatTask[];
  todayTasks: FlatTask[];
}

// ── API Client ──────────────────────────────────────────────

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const AI_TOOL_USER_ID = import.meta.env.VITE_AI_TOOL_USER_ID || "demo-user";
const API_TIMEOUT_MS = 30_000;

interface ChatAPIAction {
  type: string;
  clientId?: string;
  clientName?: string;
  candidates?: Array<{ id: string; name: string; status?: string }>;
  field?: string;
  value?: string;
  [key: string]: unknown;
}

interface ChatAPIResponse {
  reply: string;
  actions: ChatAPIAction[];
  traceId: string;
  error?: string;
}

async function callChatAPI(
  messages: Array<{ role: string; content: string }>,
  context: ChatContext
): Promise<ChatAPIResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        userId: AI_TOOL_USER_ID,
        context: {
          todayDate: new Date().toISOString().split("T")[0],
          overdueTaskCount: context.overdueTasks.length,
          todayTaskCount: context.todayTasks.length,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;
    return (await response.json()) as ChatAPIResponse;
  } catch {
    return null;
  }
}

// ── Map API actions to frontend types ───────────────────────

function mapActions(
  apiActions: ChatAPIAction[],
  context: ChatContext
): {
  sideEffects: SideEffect[];
  candidates?: ClientCandidate[];
  tasks?: FlatTask[];
  ctaClientId?: string;
  ctaClientName?: string;
} {
  const sideEffects: SideEffect[] = [];
  let candidates: ClientCandidate[] | undefined;
  let tasks: FlatTask[] | undefined;
  let ctaClientId: string | undefined;
  let ctaClientName: string | undefined;

  for (const action of apiActions) {
    switch (action.type) {
      case "OPEN_CLIENT":
        sideEffects.push({
          type: "OPEN_CLIENT",
          clientId: action.clientId!,
        });
        ctaClientId = action.clientId;
        ctaClientName = action.clientName;
        break;

      case "OPEN_ADD_CLIENT":
        sideEffects.push({ type: "OPEN_ADD_CLIENT" });
        break;

      case "SHOW_CANDIDATES":
        if (action.candidates) {
          candidates = action.candidates.map((c) => ({
            id: c.id,
            name: c.name,
            status: c.status || "",
            tags: [],
            areas: [],
          }));
        }
        break;

      case "SHOW_TASKS":
        tasks = [...context.overdueTasks, ...context.todayTasks];
        break;

      case "TASK_CREATED":
        ctaClientId = action.clientId;
        break;

      case "CLIENT_UPDATED":
        // Update local state via side effect
        if (action.clientId && action.field && action.value) {
          sideEffects.push({
            type: "UPDATE_CLIENT",
            clientId: action.clientId,
            field: action.field,
            value: action.value,
          });
        }
        ctaClientId = action.clientId;
        break;

      case "LOG_ADDED":
        ctaClientId = action.clientId;
        break;
    }
  }

  return { sideEffects, candidates, tasks, ctaClientId, ctaClientName };
}

// ── Core: processInput ──────────────────────────────────────

export async function processInput(
  input: string,
  _state: AssistantState,
  context: ChatContext,
  conversationHistory?: Array<{ role: string; content: string }>
): Promise<AssistantResponse> {
  // Build message list: history + current input
  const messages = [
    ...(conversationHistory || []),
    { role: "user", content: input },
  ];

  // Call /api/chat
  const apiResponse = await callChatAPI(messages, context);

  // Handle failure
  if (!apiResponse || apiResponse.error) {
    return {
      text:
        apiResponse?.error ||
        "抱歉，AI 助理暂时无法响应，请稍后再试。",
      newState: INITIAL_STATE,
      sideEffects: [],
    };
  }

  // Map API response to AssistantResponse
  const { sideEffects, candidates, tasks, ctaClientId, ctaClientName } =
    mapActions(apiResponse.actions, context);

  return {
    text: apiResponse.reply,
    newState: INITIAL_STATE,
    candidates,
    tasks,
    ctaClientId,
    ctaClientName,
    sideEffects,
  };
}

// ── selectCandidate (card click) ────────────────────────────

/**
 * When user clicks a candidate card, we send a synthetic message
 * through processInput so the LLM can continue the conversation.
 * This is a convenience wrapper.
 */
export async function selectCandidateAsync(
  clientId: string,
  context: ChatContext,
  conversationHistory: Array<{ role: string; content: string }>
): Promise<AssistantResponse> {
  const client = context.clients.find((c) => c.id === clientId);
  const name = client?.remarkName || client?.name || "";
  const message = `我选择了「${name}」`;
  return processInput(message, INITIAL_STATE, context, conversationHistory);
}

/**
 * Synchronous fallback for candidate selection (opens client directly).
 * Used when we don't want to wait for LLM response.
 */
export function selectCandidate(
  clientId: string,
  _state: AssistantState,
  context: ChatContext
): AssistantResponse {
  const client = context.clients.find((c) => c.id === clientId);
  if (!client) {
    return {
      text: "找不到该客户。",
      newState: INITIAL_STATE,
      sideEffects: [],
    };
  }
  const name = client.remarkName || client.name || "";
  return {
    text: `已选择「${name}」。`,
    newState: INITIAL_STATE,
    ctaClientId: client.id,
    ctaClientName: name,
    sideEffects: [{ type: "OPEN_CLIENT", clientId: client.id }],
  };
}
