/**
 * Chat Engine — State Machine Orchestrator
 *
 * Manages conversation state (IDLE / DISAMBIGUATION / MISSING_SLOTS)
 * and dispatches to intentParser for NLU. Does not parse itself.
 */
import type { Client, ClientLog } from "@/crm/types";
import type { FlatTask } from "@/crm/utils/dashboardTasks";
import { formatDateForNextAction } from "@/crm/utils/dashboardTasks";
import { parse, parseSlot, classifyIntent, type ParsedIntent } from "@/crm/utils/intentParser";
import type { ClientMatch } from "@/crm/utils/voiceTaskParser";

// ── State Machine Types ──────────────────────────────────────

export type AssistantMode = "IDLE" | "AWAITING_DISAMBIGUATION" | "AWAITING_MISSING_SLOTS";

export interface AssistantState {
  mode: AssistantMode;
  pendingIntent: ParsedIntent | null;
  candidates: Client[] | null;
  draft: {
    action?: string;
    dueDate?: Date;
    clientId?: string;
    clientName?: string;
    /** UPDATE_CLIENT: field to update */
    field?: string;
    /** UPDATE_CLIENT: new value */
    value?: string;
  };
  /** Which slot we're currently asking about */
  askingSlot?: string;
}

export const INITIAL_STATE: AssistantState = {
  mode: "IDLE",
  pendingIntent: null,
  candidates: null,
  draft: {},
};

// ── Response Types ───────────────────────────────────────────

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

// ── Helpers ──────────────────────────────────────────────────

function formatDate(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function toCandidate(c: Client): ClientCandidate {
  return {
    id: c.id,
    name: c.remarkName || c.name || "未命名",
    status: c.status,
    tags: c.tags || [],
    areas: c.requirements?.areas || [],
    phone: c.phone,
  };
}

function buildLog(action: string, dueDate: Date): ClientLog {
  return {
    id: Date.now().toString(),
    date: new Date().toISOString(),
    content: `[助理创建] ${action}`,
    nextAction: `${formatDateForNextAction(dueDate)}：${action}`,
    nextActionTodo: action,
  };
}

/** Check if user input looks like a new intent (not a slot answer).
 *  Uses synchronous regex classification — does NOT call the async LLM API. */
function looksLikeNewIntent(input: string): boolean {
  const intent = classifyIntent(input);
  return intent !== "UNKNOWN";
}

// ── Core: processInput ──────────────────────────────────────

export async function processInput(
  input: string,
  state: AssistantState,
  context: ChatContext
): Promise<AssistantResponse> {
  const { mode } = state;

  // Route to appropriate handler based on current mode
  if (mode === "AWAITING_DISAMBIGUATION") {
    return handleDisambiguation(input, state, context);
  }
  if (mode === "AWAITING_MISSING_SLOTS") {
    return handleMissingSlots(input, state, context);
  }
  return handleIdle(input, context);
}

// ── IDLE mode handler ───────────────────────────────────────

async function handleIdle(input: string, context: ChatContext): Promise<AssistantResponse> {
  const parsed = await parse(input, context.clients);

  switch (parsed.intent) {
    case "GREETING": {
      const total = context.overdueTasks.length + context.todayTasks.length;
      const text = total > 0
        ? `你好！今天你有 ${total} 件待办事项${context.overdueTasks.length > 0 ? `（其中 ${context.overdueTasks.length} 件逾期）` : ""}。需要我帮你处理什么吗？`
        : "你好！今天暂时没有待办事项，需要我帮你做点什么吗？";
      return { text, newState: INITIAL_STATE, sideEffects: [] };
    }

    case "ADD_CLIENT":
      return {
        text: "好的，我帮你打开客户录入表单。",
        newState: INITIAL_STATE,
        sideEffects: [{ type: "OPEN_ADD_CLIENT" }],
      };

    case "VIEW_TODAY": {
      const all = [...context.overdueTasks, ...context.todayTasks];
      if (all.length === 0) {
        return { text: "今天没有待办事项，可以放松一下！", newState: INITIAL_STATE, sideEffects: [] };
      }
      return {
        text: `今天共有 ${all.length} 项待办：`,
        newState: INITIAL_STATE,
        tasks: all,
        sideEffects: [],
      };
    }

    case "FIND_CLIENT":
      return handleFindClient(parsed, context);

    case "CREATE_TASK":
      return handleCreateTask(parsed, context);

    case "OPEN_CLIENT":
      return handleOpenClient(parsed, context);

    case "UPDATE_CLIENT":
      return handleUpdateClient(parsed, context);

    case "UNKNOWN":
    default:
      return {
        text: "抱歉，这个我暂时帮不了你～ 不过以下这些我很擅长：\n· 添加客户 — 说「加个新客户」\n· 建任务 — 说「明天提醒我给XX打电话」\n· 看待办 — 说「今天有什么任务」\n· 找客户 — 说「找一下王小明」",
        newState: INITIAL_STATE,
        sideEffects: [],
      };
  }
}

// ── FIND_CLIENT logic ───────────────────────────────────────

function handleFindClient(parsed: ParsedIntent, context: ChatContext): AssistantResponse {
  let matches = parsed.slots.clientMatches;

  // Fallback: if voiceTaskParser found nothing, try simple surname/substring search
  if (matches.length === 0 && parsed.slots.clientQuery) {
    const q = parsed.slots.clientQuery.toLowerCase();

    // Handle "小X" nickname → surname match: "小王" → name starts with "王"
    const xiaoMatch = parsed.slots.clientQuery.match(/^小([\u4e00-\u9fff])$/);
    const surname = xiaoMatch ? xiaoMatch[1] : null;

    const found = context.clients.filter((c) => {
      const names = [c.remarkName, c.name].filter(Boolean) as string[];
      if (surname) {
        // "小王" → match any client whose name starts with 王
        return names.some((n) => n.startsWith(surname));
      }
      return names.some((n) => n.toLowerCase().includes(q));
    });
    matches = found.map((c) => ({ client: c, score: 0.5, matchedText: parsed.slots.clientQuery! }));
  }

  // Also try: single-char surname → startsWith match
  if (matches.length === 0 && parsed.slots.clientQuery) {
    const q = parsed.slots.clientQuery;
    if (q.length === 1) {
      const found = context.clients.filter((c) => {
        const names = [c.remarkName, c.name].filter(Boolean) as string[];
        return names.some((n) => n.startsWith(q));
      });
      matches = found.map((c) => ({ client: c, score: 0.4, matchedText: q }));
    }
  }

  if (matches.length === 0) {
    return {
      text: parsed.slots.clientQuery
        ? `本地没有匹配到「${parsed.slots.clientQuery}」，我去云端帮你再找一下。`
        : "没有匹配到客户，帮你打开搜索。",
      newState: INITIAL_STATE,
      sideEffects: parsed.slots.clientQuery
        ? [{ type: "SEARCH_CLIENT", query: parsed.slots.clientQuery }]
        : [],
    };
  }

  if (matches.length === 1) {
    const c = matches[0].client;
    const name = c.remarkName || c.name || "";
    return {
      text: `找到了「${name}」。`,
      newState: INITIAL_STATE,
      ctaClientId: c.id,
      ctaClientName: name,
      sideEffects: [],
    };
  }

  // Multiple matches → disambiguation
  const candidates = matches.map((m) => m.client);
  return {
    text: `找到 ${matches.length} 位客户，请选择：`,
    newState: {
      mode: "AWAITING_DISAMBIGUATION",
      pendingIntent: parsed,
      candidates,
      draft: {},
    },
    candidates: candidates.map(toCandidate),
    sideEffects: [],
  };
}

// ── CREATE_TASK logic ───────────────────────────────────────

function handleCreateTask(parsed: ParsedIntent, context: ChatContext): AssistantResponse {
  const matches = parsed.slots.clientMatches;
  const { dueDate, action } = parsed.slots;

  // Save what we have into draft
  const draft: AssistantState["draft"] = {
    action: action || undefined,
    dueDate: dueDate || undefined,
  };

  // Case 1: No client match at all → ask for client
  if (matches.length === 0) {
    return {
      text: `我理解你想${action ? `「${action}」` : "添加任务"}，请问是哪个客户？`,
      newState: {
        mode: "AWAITING_MISSING_SLOTS",
        pendingIntent: parsed,
        candidates: null,
        draft,
        askingSlot: "client",
      },
      sideEffects: [],
    };
  }

  // Case 2: Multiple client matches → disambiguation first
  if (matches.length > 1) {
    const candidates = matches.map((m) => m.client);
    return {
      text: `找到 ${matches.length} 位匹配的客户，请选择：`,
      newState: {
        mode: "AWAITING_DISAMBIGUATION",
        pendingIntent: parsed,
        candidates,
        draft,
      },
      candidates: candidates.map(toCandidate),
      sideEffects: [],
    };
  }

  // Case 3: Exactly 1 client match → fill it in
  const client = matches[0].client;
  draft.clientId = client.id;
  draft.clientName = client.remarkName || client.name || "";

  // Check if dueDate is missing
  if (!dueDate) {
    return {
      text: `好的，为「${draft.clientName}」${action ? `「${action}」` : "添加任务"}。请问哪天提醒你？`,
      newState: {
        mode: "AWAITING_MISSING_SLOTS",
        pendingIntent: parsed,
        candidates: null,
        draft,
        askingSlot: "dueDate",
      },
      sideEffects: [],
    };
  }

  // All slots filled → execute
  return executeCreateTask(draft, client, context);
}

// ── Execute CREATE_TASK ─────────────────────────────────────

function executeCreateTask(
  draft: AssistantState["draft"],
  client: Client,
  _context: ChatContext
): AssistantResponse {
  const actionText = draft.action || "跟进";
  const dueDate = draft.dueDate!;
  const log = buildLog(actionText, dueDate);
  const name = draft.clientName || client.remarkName || client.name || "";

  return {
    text: `已为「${name}」添加任务：${formatDate(dueDate)} ${actionText}`,
    newState: INITIAL_STATE,
    ctaClientId: client.id,
    ctaClientName: name,
    sideEffects: [{ type: "ADD_LOG", log, client }],
  };
}

// ── OPEN_CLIENT logic ────────────────────────────────────────

function handleOpenClient(parsed: ParsedIntent, context: ChatContext): AssistantResponse {
  const matches = parsed.slots.clientMatches;

  // Reuse FIND_CLIENT's fallback matching logic
  if (matches.length === 0 && parsed.slots.clientQuery) {
    // Try simple substring/surname matching
    const q = parsed.slots.clientQuery.toLowerCase();
    const xiaoMatch = parsed.slots.clientQuery.match(/^小([\u4e00-\u9fff])$/);
    const surname = xiaoMatch ? xiaoMatch[1] : null;

    const found = context.clients.filter((c) => {
      const names = [c.remarkName, c.name].filter(Boolean) as string[];
      if (surname) return names.some((n) => n.startsWith(surname));
      return names.some((n) => n.toLowerCase().includes(q));
    });

    if (found.length === 1) {
      const c = found[0];
      const name = c.remarkName || c.name || "";
      return {
        text: `正在打开「${name}」的资料。`,
        newState: INITIAL_STATE,
        ctaClientId: c.id,
        ctaClientName: name,
        sideEffects: [{ type: "OPEN_CLIENT", clientId: c.id }],
      };
    }

    if (found.length > 1) {
      return {
        text: `找到 ${found.length} 位匹配的客户，请选择要打开哪个：`,
        newState: {
          mode: "AWAITING_DISAMBIGUATION",
          pendingIntent: { ...parsed, intent: "OPEN_CLIENT" },
          candidates: found,
          draft: {},
        },
        candidates: found.map(toCandidate),
        sideEffects: [],
      };
    }

    return {
      text: `没有找到匹配的客户「${parsed.slots.clientQuery}」。`,
      newState: INITIAL_STATE,
      sideEffects: [],
    };
  }

  if (matches.length === 1) {
    const c = matches[0].client;
    const name = c.remarkName || c.name || "";
    return {
      text: `正在打开「${name}」的资料。`,
      newState: INITIAL_STATE,
      ctaClientId: c.id,
      ctaClientName: name,
      sideEffects: [{ type: "OPEN_CLIENT", clientId: c.id }],
    };
  }

  if (matches.length > 1) {
    const candidates = matches.map((m) => m.client);
    return {
      text: `找到 ${matches.length} 位匹配的客户，请选择要打开哪个：`,
      newState: {
        mode: "AWAITING_DISAMBIGUATION",
        pendingIntent: parsed,
        candidates,
        draft: {},
      },
      candidates: candidates.map(toCandidate),
      sideEffects: [],
    };
  }

  return {
    text: "请告诉我要打开哪个客户的资料？",
    newState: {
      mode: "AWAITING_MISSING_SLOTS",
      pendingIntent: parsed,
      candidates: null,
      draft: {},
      askingSlot: "client",
    },
    sideEffects: [],
  };
}

// ── UPDATE_CLIENT logic ──────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  status: "状态",
  urgency: "紧急度",
  phone: "电话",
  budget: "预算",
  wechat: "微信",
  tags: "标签",
};

function handleUpdateClient(parsed: ParsedIntent, context: ChatContext): AssistantResponse {
  const matches = parsed.slots.clientMatches;
  const { field, value } = parsed.slots;

  const draft: AssistantState["draft"] = {
    field: field || undefined,
    value: value || undefined,
  };

  // Case 1: no client match → ask
  if (matches.length === 0 && !parsed.slots.clientQuery) {
    return {
      text: "请问要更新哪个客户的信息？",
      newState: {
        mode: "AWAITING_MISSING_SLOTS",
        pendingIntent: parsed,
        candidates: null,
        draft,
        askingSlot: "client",
      },
      sideEffects: [],
    };
  }

  // Try fallback matching if no direct matches
  if (matches.length === 0 && parsed.slots.clientQuery) {
    const q = parsed.slots.clientQuery.toLowerCase();
    const found = context.clients.filter((c) => {
      const names = [c.remarkName, c.name].filter(Boolean) as string[];
      return names.some((n) => n.toLowerCase().includes(q));
    });

    if (found.length === 1) {
      const client = found[0];
      draft.clientId = client.id;
      draft.clientName = client.remarkName || client.name || "";
      return tryExecuteUpdate(draft, client, parsed);
    }

    if (found.length > 1) {
      return {
        text: `找到 ${found.length} 位匹配的客户，请选择：`,
        newState: {
          mode: "AWAITING_DISAMBIGUATION",
          pendingIntent: parsed,
          candidates: found,
          draft,
        },
        candidates: found.map(toCandidate),
        sideEffects: [],
      };
    }

    return {
      text: `没有找到客户「${parsed.slots.clientQuery}」，请确认姓名。`,
      newState: {
        mode: "AWAITING_MISSING_SLOTS",
        pendingIntent: parsed,
        candidates: null,
        draft,
        askingSlot: "client",
      },
      sideEffects: [],
    };
  }

  // Multiple matches → disambiguation
  if (matches.length > 1) {
    const candidates = matches.map((m) => m.client);
    return {
      text: `找到 ${matches.length} 位匹配的客户，请选择：`,
      newState: {
        mode: "AWAITING_DISAMBIGUATION",
        pendingIntent: parsed,
        candidates,
        draft,
      },
      candidates: candidates.map(toCandidate),
      sideEffects: [],
    };
  }

  // Exactly 1 match
  const client = matches[0].client;
  draft.clientId = client.id;
  draft.clientName = client.remarkName || client.name || "";
  return tryExecuteUpdate(draft, client, parsed);
}

function tryExecuteUpdate(
  draft: AssistantState["draft"],
  client: Client,
  parsed: ParsedIntent
): AssistantResponse {
  const { field, value } = draft;
  const name = draft.clientName || client.remarkName || client.name || "";

  // Missing field → ask
  if (!field) {
    return {
      text: `好的，要更新「${name}」的什么信息？（如：状态、电话、预算、紧急度）`,
      newState: {
        mode: "AWAITING_MISSING_SLOTS",
        pendingIntent: parsed,
        candidates: null,
        draft,
        askingSlot: "field",
      },
      sideEffects: [],
    };
  }

  // Missing value → ask
  if (!value) {
    const fieldLabel = FIELD_LABELS[field] || field;
    return {
      text: `要把「${name}」的${fieldLabel}改为什么？`,
      newState: {
        mode: "AWAITING_MISSING_SLOTS",
        pendingIntent: parsed,
        candidates: null,
        draft,
        askingSlot: "value",
      },
      sideEffects: [],
    };
  }

  // All filled → execute
  const fieldLabel = FIELD_LABELS[field] || field;
  return {
    text: `已将「${name}」的${fieldLabel}更新为「${value}」。`,
    newState: INITIAL_STATE,
    ctaClientId: client.id,
    ctaClientName: name,
    sideEffects: [{ type: "UPDATE_CLIENT", clientId: client.id, field, value }],
  };
}

// ── AWAITING_DISAMBIGUATION handler ─────────────────────────

async function handleDisambiguation(
  input: string,
  state: AssistantState,
  context: ChatContext
): Promise<AssistantResponse> {
  // Check if this is a completely new intent → reset
  if (looksLikeNewIntent(input)) {
    return handleIdle(input, context);
  }

  // Try to narrow down candidates using the new input
  const candidates = state.candidates || [];
  const narrowed: ClientMatch[] = [];

  // Try matching user's new description against candidates only
  for (const c of candidates) {
    const names = [c.remarkName, c.name].filter(Boolean) as string[];
    const areas = c.requirements?.areas || [];
    const tags = c.tags || [];
    const allText = [...names, ...areas, ...tags].join(" ").toLowerCase();
    if (allText.includes(input.trim().toLowerCase())) {
      narrowed.push({ client: c, score: 1, matchedText: input.trim() });
    }
  }

  if (narrowed.length === 1) {
    // Resolved!
    const client = narrowed[0].client;
    const name = client.remarkName || client.name || "";

    if (state.pendingIntent?.intent === "CREATE_TASK") {
      const draft = { ...state.draft, clientId: client.id, clientName: name };
      // Check if dueDate still missing
      if (!draft.dueDate) {
        return {
          text: `好的，选择了「${name}」。请问哪天提醒你？`,
          newState: {
            mode: "AWAITING_MISSING_SLOTS",
            pendingIntent: state.pendingIntent,
            candidates: null,
            draft,
            askingSlot: "dueDate",
          },
          sideEffects: [],
        };
      }
      return executeCreateTask(draft, client, context);
    }

    // OPEN_CLIENT → directly open
    if (state.pendingIntent?.intent === "OPEN_CLIENT") {
      return {
        text: `正在打开「${name}」的资料。`,
        newState: INITIAL_STATE,
        ctaClientId: client.id,
        ctaClientName: name,
        sideEffects: [{ type: "OPEN_CLIENT", clientId: client.id }],
      };
    }

    // UPDATE_CLIENT → continue with field/value
    if (state.pendingIntent?.intent === "UPDATE_CLIENT") {
      const draft = { ...state.draft, clientId: client.id, clientName: name };
      return tryExecuteUpdate(draft, client, state.pendingIntent);
    }

    // FIND_CLIENT
    return {
      text: `找到了「${name}」。`,
      newState: INITIAL_STATE,
      ctaClientId: client.id,
      ctaClientName: name,
      sideEffects: [],
    };
  }

  if (narrowed.length > 1) {
    return {
      text: `还有 ${narrowed.length} 位匹配，请再描述一下或直接选择：`,
      newState: { ...state, candidates: narrowed.map((n) => n.client) },
      candidates: narrowed.map((n) => toCandidate(n.client)),
      sideEffects: [],
    };
  }

  // No narrowing → show original list again
  return {
    text: "没有找到更精确的匹配，请直接选择：",
    newState: state,
    candidates: candidates.map(toCandidate),
    sideEffects: [],
  };
}

// ── AWAITING_MISSING_SLOTS handler ──────────────────────────

async function handleMissingSlots(
  input: string,
  state: AssistantState,
  context: ChatContext
): Promise<AssistantResponse> {
  const { askingSlot, draft, pendingIntent } = state;
  if (!askingSlot || !pendingIntent) return handleIdle(input, context);

  // Try parsing the slot FIRST — so "王先生" is treated as a client answer,
  // not a new FIND_CLIENT intent.
  const result = parseSlot(input, askingSlot, context.clients);

  if (!result.matched) {
    // Slot parsing failed → now check if it's a completely new intent
    if (looksLikeNewIntent(input)) {
      return handleIdle(input, context);
    }
    // Not a new intent either → ask again
    const prompts: Record<string, string> = {
      client: "没有识别到客户，请说客户姓名或备注名。",
      dueDate: "没有识别到日期，请说具体时间，比如「明天」「下周三」「15号」。",
      action: "请告诉我具体要做什么，比如「打电话跟进」。",
      field: "请告诉我要更新哪个字段，比如「状态」「电话」「预算」「紧急度」。",
      value: "请告诉我新的值。",
    };
    return {
      text: prompts[askingSlot] || "请再说一次。",
      newState: state,
      sideEffects: [],
    };
  }

  // Slot parsed → merge into draft
  const newDraft = { ...draft };

  if (askingSlot === "dueDate") {
    newDraft.dueDate = result.value as Date;
  } else if (askingSlot === "client") {
    const matches = result.value as ClientMatch[];
    if (matches.length === 1) {
      const c = matches[0].client;
      newDraft.clientId = c.id;
      newDraft.clientName = c.remarkName || c.name || "";
    } else if (matches.length > 1) {
      // Still ambiguous → go to disambiguation
      return {
        text: `找到 ${matches.length} 位匹配的客户，请选择：`,
        newState: {
          mode: "AWAITING_DISAMBIGUATION",
          pendingIntent,
          candidates: matches.map((m) => m.client),
          draft: newDraft,
        },
        candidates: matches.map((m) => toCandidate(m.client)),
        sideEffects: [],
      };
    }
  } else if (askingSlot === "action") {
    newDraft.action = result.value as string;
  } else if (askingSlot === "field") {
    newDraft.field = result.value as string;
  } else if (askingSlot === "value") {
    newDraft.value = result.value as string;
  }

  // OPEN_CLIENT: just needs a client
  if (pendingIntent.intent === "OPEN_CLIENT" && newDraft.clientId) {
    return {
      text: `正在打开「${newDraft.clientName}」的资料。`,
      newState: INITIAL_STATE,
      ctaClientId: newDraft.clientId,
      ctaClientName: newDraft.clientName,
      sideEffects: [{ type: "OPEN_CLIENT", clientId: newDraft.clientId }],
    };
  }

  // UPDATE_CLIENT: needs client + field + value
  if (pendingIntent.intent === "UPDATE_CLIENT") {
    if (newDraft.clientId) {
      const client = context.clients.find((c) => c.id === newDraft.clientId);
      if (client) return tryExecuteUpdate(newDraft, client, pendingIntent);
    }
    // Still need client
    return {
      text: "请问是哪个客户？",
      newState: { ...state, draft: newDraft, askingSlot: "client" },
      sideEffects: [],
    };
  }

  // Check what's still missing for CREATE_TASK
  if (pendingIntent.intent === "CREATE_TASK") {
    if (!newDraft.clientId) {
      return {
        text: "请问是哪个客户？",
        newState: {
          ...state,
          draft: newDraft,
          askingSlot: "client",
        },
        sideEffects: [],
      };
    }
    if (!newDraft.dueDate) {
      return {
        text: `好的。请问哪天提醒你？`,
        newState: {
          ...state,
          draft: newDraft,
          askingSlot: "dueDate",
        },
        sideEffects: [],
      };
    }
    // All filled → execute
    const client = context.clients.find((c) => c.id === newDraft.clientId);
    if (!client) return handleIdle(input, context);
    return executeCreateTask(newDraft, client, context);
  }

  // FIND_CLIENT with resolved client
  if (pendingIntent.intent === "FIND_CLIENT" && newDraft.clientId) {
    return {
      text: `找到了「${newDraft.clientName}」。`,
      newState: INITIAL_STATE,
      ctaClientId: newDraft.clientId,
      ctaClientName: newDraft.clientName,
      sideEffects: [],
    };
  }

  return handleIdle(input, context);
}

// ── selectCandidate (called when user clicks a card) ────────

export function selectCandidate(
  clientId: string,
  state: AssistantState,
  context: ChatContext
): AssistantResponse {
  const client = context.clients.find((c) => c.id === clientId);
  if (!client) {
    return { text: "找不到该客户。", newState: INITIAL_STATE, sideEffects: [] };
  }

  const name = client.remarkName || client.name || "";

  if (state.pendingIntent?.intent === "CREATE_TASK") {
    const draft = { ...state.draft, clientId: client.id, clientName: name };

    if (!draft.dueDate) {
      return {
        text: `好的，选择了「${name}」。请问哪天提醒你？`,
        newState: {
          mode: "AWAITING_MISSING_SLOTS",
          pendingIntent: state.pendingIntent,
          candidates: null,
          draft,
          askingSlot: "dueDate",
        },
        sideEffects: [],
      };
    }

    return executeCreateTask(draft, client, context);
  }

  // OPEN_CLIENT → directly open
  if (state.pendingIntent?.intent === "OPEN_CLIENT") {
    return {
      text: `正在打开「${name}」的资料。`,
      newState: INITIAL_STATE,
      ctaClientId: client.id,
      ctaClientName: name,
      sideEffects: [{ type: "OPEN_CLIENT", clientId: client.id }],
    };
  }

  // UPDATE_CLIENT → continue with field/value
  if (state.pendingIntent?.intent === "UPDATE_CLIENT") {
    const draft = { ...state.draft, clientId: client.id, clientName: name };
    return tryExecuteUpdate(draft, client, state.pendingIntent);
  }

  // FIND_CLIENT → open client
  return {
    text: `已选择「${name}」。`,
    newState: INITIAL_STATE,
    ctaClientId: client.id,
    ctaClientName: name,
    sideEffects: [{ type: "OPEN_CLIENT", clientId: client.id }],
  };
}
