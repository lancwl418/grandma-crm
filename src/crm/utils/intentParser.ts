/**
 * Intent Parser — 结构化意图解析层
 *
 * 将用户自然语言输入转换为结构化 ParsedIntent。
 * 优先调用 /api/parse（LLM），失败时降级为本地正则。
 */
import type { Client } from "@/crm/types";
import {
  parseVoiceTask,
  matchClient,
  parseRelativeDate,
  type ClientMatch,
} from "@/crm/utils/voiceTaskParser";
import {
  isParseAPIResponse,
  type ParseAPIResponse,
} from "@/crm/ai/parseContract";

// ── Types ─────────────────────────────────────────────────────

export type IntentType =
  | "FIND_CLIENT"
  | "CREATE_TASK"
  | "ADD_CLIENT"
  | "VIEW_TODAY"
  | "UPDATE_CLIENT"
  | "OPEN_CLIENT"
  | "GREETING"
  | "UNKNOWN";

export interface ParsedIntent {
  intent: IntentType;
  slots: {
    clientQuery?: string;
    clientMatches: ClientMatch[];
    action?: string;
    dueDate?: Date;
    dueDateText?: string;
    /** UPDATE_CLIENT: which field to update */
    field?: string;
    /** UPDATE_CLIENT: new value for the field */
    value?: string;
  };
  missing: string[];
  confidence: number;
}

// ── Intent classification (regex, sync) ──────────────────────

const TASK_KEYWORDS =
  /提醒|安排|跟进|打电话|打个电话|发消息|发微信|发短信|看房|看盘|加个任务|建个任务|添加任务|新建任务|加个待办|建个待办/;

const INTENT_RULES: { intent: IntentType; patterns: RegExp[] }[] = [
  {
    intent: "GREETING",
    patterns: [/^(你好|嗨|hi|hello|hey|早上好|下午好|晚上好|早安|嘿|哈喽)/i],
  },
  {
    intent: "ADD_CLIENT",
    patterns: [
      /加(个|一个)?新?(客户|客人)/,
      /录入(客户|客人)/,
      /新(客户|客人)/,
      /添加(客户|客人)/,
    ],
  },
  {
    intent: "VIEW_TODAY",
    patterns: [
      /今[天日](有什么|有啥|的)?(任务|待办|事|工作|安排)/,
      /待办/,
      /逾期/,
      /任务(列表|清单)/,
      /有(什么|啥)(任务|事|要做)/,
      /今天(干啥|做啥|干什么|做什么)/,
    ],
  },
  // UPDATE_CLIENT: changing status, urgency, phone, budget, tags, etc.
  {
    intent: "UPDATE_CLIENT",
    patterns: [
      /(状态|紧急度|电话|手机|预算|微信|标签)(改|设|更新|换|变)(为|成|到)/,
      /(改|设|更新|换|变)(一下)?.*的?(状态|紧急度|电话|手机|预算|微信|标签)/,
      /把.+(状态|紧急度|电话|手机|预算|微信|标签)(改|设|更新|换|变)/,
      /更新.+(信息|资料)/,
    ],
  },
  // CREATE_TASK before FIND_CLIENT — task keywords take priority
  {
    intent: "CREATE_TASK",
    patterns: [
      TASK_KEYWORDS,
      /(加|建|添加|新建)(个|一个)?(任务|待办)/,
      /(带|陪).*(看房|看盘)/,
      /明天|后天|下周|本周|[0-9]+天后|[0-9]+号/,
    ],
  },
  // OPEN_CLIENT: explicitly open/view a client profile
  {
    intent: "OPEN_CLIENT",
    patterns: [
      /打开.*(资料|详情|页面|档案)/,
      /(查看|看看|看一下|看下).*(资料|详情|信息|档案)/,
      /打开[\u4e00-\u9fff]/,
    ],
  },
  {
    intent: "FIND_CLIENT",
    patterns: [
      /搜索(客户|客人)?/,
      /(找|查)(一下|下)?[\u4e00-\u9fff]/,
      /哪个客户/,
      /客户(信息|详情|资料)/,
      /姓[\u4e00-\u9fff]的?/,
    ],
  },
];

/**
 * Synchronous regex-only intent classification.
 * Exported for use by chatEngine's looksLikeNewIntent().
 */
export function classifyIntent(input: string): IntentType {
  const t = input.trim();
  for (const { intent, patterns } of INTENT_RULES) {
    if (patterns.some((p) => p.test(t))) return intent;
  }
  // Surname+title fallback → FIND_CLIENT
  if (/[\u4e00-\u9fff]{1,4}(先生|女士|太太|小姐|老师|总|哥|姐|叔|阿姨)/.test(t)) {
    return "FIND_CLIENT";
  }
  return "UNKNOWN";
}

// ── LLM Parse API ─────────────────────────────────────────────

const API_TIMEOUT_MS = 10_000;

/** 防抖：如果同一输入在 2 秒内重复提交，复用上次结果 */
let lastCall: { input: string; time: number; result: ParseAPIResponse | null } | null = null;
const DEBOUNCE_MS = 2_000;

async function callParseAPI(input: string): Promise<ParseAPIResponse | null> {
  // 防抖：相同输入短时间内不重复请求
  if (lastCall && lastCall.input === input && Date.now() - lastCall.time < DEBOUNCE_MS) {
    return lastCall.result;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch("/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ utterance: input }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      lastCall = { input, time: Date.now(), result: null };
      return null;
    }

    const data: unknown = await response.json();
    const result = isParseAPIResponse(data) ? data : null;
    lastCall = { input, time: Date.now(), result };
    return result;
  } catch {
    lastCall = { input, time: Date.now(), result: null };
    return null;
  }
}

/** Convert API response to full ParsedIntent using local deterministic code */
function hydrateAPIResult(
  api: ParseAPIResponse,
  input: string,
  clients: Client[]
): ParsedIntent {
  const intent = api.intent;

  // Simple intents: no hydration needed
  if (intent === "GREETING" || intent === "VIEW_TODAY" || intent === "ADD_CLIENT" || intent === "UNKNOWN") {
    return {
      intent,
      slots: { clientMatches: [] },
      missing: [],
      confidence: api.confidence,
    };
  }

  // All remaining intents need client matching
  const clientQuery = api.slots.clientQuery;
  const clientMatches = clientQuery
    ? matchClient(clientQuery, clients)
    : matchClient(input, clients);

  // OPEN_CLIENT: just needs a client
  if (intent === "OPEN_CLIENT") {
    const missing: string[] = clientMatches.length === 0 ? ["client"] : [];
    return {
      intent,
      slots: { clientQuery: clientQuery || undefined, clientMatches },
      missing,
      confidence: missing.length === 0 ? api.confidence : 0.5,
    };
  }

  // UPDATE_CLIENT: needs client + field + value
  if (intent === "UPDATE_CLIENT") {
    const missing: string[] = [];
    if (clientMatches.length === 0) missing.push("client");
    if (!api.slots.field) missing.push("field");
    if (!api.slots.value) missing.push("value");
    const totalRequired = 3;
    const filled = totalRequired - missing.length;
    return {
      intent,
      slots: {
        clientQuery: clientQuery || undefined,
        clientMatches,
        field: api.slots.field || undefined,
        value: api.slots.value || undefined,
      },
      missing,
      confidence: Math.max(0.3, Math.min(api.confidence, filled / totalRequired)),
    };
  }

  // FIND_CLIENT / CREATE_TASK: hydrate slots with local matching
  const dateResult = api.slots.dueDateText
    ? parseRelativeDate(api.slots.dueDateText)
    : null;

  const slots: ParsedIntent["slots"] = {
    clientQuery: clientQuery || undefined,
    clientMatches,
    action: api.slots.action || undefined,
    dueDate: dateResult?.date ?? undefined,
    dueDateText: api.slots.dueDateText || undefined,
  };

  // Compute missing
  const missing: string[] = [];
  if (intent === "CREATE_TASK") {
    if (clientMatches.length === 0) missing.push("client");
    if (!dateResult) missing.push("dueDate");
    if (!api.slots.action) missing.push("action");
  }
  if (intent === "FIND_CLIENT") {
    if (clientMatches.length === 0) missing.push("client");
  }

  const totalRequired = intent === "CREATE_TASK" ? 3 : 1;
  const filled = totalRequired - missing.length;
  const confidence = Math.max(0.3, Math.min(api.confidence, filled / totalRequired));

  return { intent, slots, missing, confidence };
}

// ── Local regex parse (fallback) ──────────────────────────────

function parseLocal(input: string, clients: Client[]): ParsedIntent {
  const intent = classifyIntent(input);

  // For simple intents, no slot extraction needed
  if (intent === "GREETING" || intent === "VIEW_TODAY" || intent === "ADD_CLIENT" || intent === "UNKNOWN") {
    return {
      intent,
      slots: { clientMatches: [] },
      missing: [],
      confidence: intent === "UNKNOWN" ? 0.3 : 0.95,
    };
  }

  // OPEN_CLIENT: extract client name from input
  if (intent === "OPEN_CLIENT") {
    const cleaned = input
      .replace(/打开|查看|看看|看一下|看下|的?(资料|详情|信息|页面|档案)/g, "")
      .trim();
    const clientMatches = cleaned ? matchClient(cleaned, clients) : [];
    return {
      intent,
      slots: { clientQuery: cleaned || undefined, clientMatches },
      missing: clientMatches.length === 0 ? ["client"] : [],
      confidence: clientMatches.length > 0 ? 0.9 : 0.5,
    };
  }

  // UPDATE_CLIENT: extract client, field, value from input (basic regex)
  if (intent === "UPDATE_CLIENT") {
    const fieldMap: Record<string, string> = {
      "状态": "status", "紧急度": "urgency", "电话": "phone",
      "手机": "phone", "预算": "budget", "微信": "wechat", "标签": "tags",
    };
    let field: string | undefined;
    let value: string | undefined;
    // Pattern: "把XX的状态改为看房中"
    const updateMatch = input.match(/(?:把)?(.+?)的?(状态|紧急度|电话|手机|预算|微信|标签)(?:改|设|更新|换|变)(?:为|成|到)?(.+)/);
    if (updateMatch) {
      const clientQuery = updateMatch[1].replace(/^(帮我|请)/, "").trim();
      field = fieldMap[updateMatch[2]] || updateMatch[2];
      value = updateMatch[3].trim();
      const clientMatches = matchClient(clientQuery, clients);
      const missing: string[] = [];
      if (clientMatches.length === 0) missing.push("client");
      if (!field) missing.push("field");
      if (!value) missing.push("value");
      return {
        intent,
        slots: { clientQuery, clientMatches, field, value },
        missing,
        confidence: missing.length === 0 ? 0.9 : 0.5,
      };
    }
    // Fallback: couldn't parse structure
    return {
      intent,
      slots: { clientMatches: [] },
      missing: ["client", "field", "value"],
      confidence: 0.3,
    };
  }

  // Full slot extraction via voiceTaskParser
  const parsed = parseVoiceTask(input, clients);

  // Extract raw client query text (fallback for when matchClient finds nothing)
  let rawClientQuery: string | undefined = parsed.clientMatches[0]?.matchedText;
  if (!rawClientQuery && intent === "FIND_CLIENT") {
    // Handle "姓王的" → "王"
    const surnameMatch = input.match(/姓([\u4e00-\u9fff])的?/);
    if (surnameMatch) {
      rawClientQuery = surnameMatch[1];
    } else {
      // Strip search verbs to get the name part: "帮我找王" → "王"
      const extracted = input
        .replace(/帮我|请|搜索|找一下|查一下|找下|查下|找|查/g, "")
        .replace(/客户|客人|的?(信息|详情|资料)/g, "")
        .trim();
      rawClientQuery = extracted || undefined;
    }
  }

  const slots: ParsedIntent["slots"] = {
    clientMatches: parsed.clientMatches,
    clientQuery: rawClientQuery,
    action: parsed.action || undefined,
    dueDate: parsed.date ?? undefined,
    dueDateText: parsed.dateText ?? undefined,
  };

  // Compute missing fields
  const missing: string[] = [];
  if (intent === "CREATE_TASK") {
    if (parsed.clientMatches.length === 0) missing.push("client");
    if (!parsed.date) missing.push("dueDate");
    if (!parsed.action) missing.push("action");
  }
  if (intent === "FIND_CLIENT") {
    if (parsed.clientMatches.length === 0) missing.push("client");
  }

  // Confidence based on how many required slots are filled
  const totalRequired = intent === "CREATE_TASK" ? 3 : 1;
  const filled = totalRequired - missing.length;
  const confidence = Math.max(0.3, filled / totalRequired);

  return { intent, slots, missing, confidence };
}

// ── Main parse function (async, LLM + fallback) ──────────────

/**
 * Parse user input into a structured intent.
 * Calls /api/parse (LLM), falls back to local regex on failure.
 */
export async function parse(input: string, clients: Client[]): Promise<ParsedIntent> {
  // 1. Try LLM API
  const apiResult = await callParseAPI(input);

  if (apiResult) {
    return hydrateAPIResult(apiResult, input, clients);
  }

  // 2. Fallback: local regex
  console.warn("[intentParser] API unavailable, using local regex fallback");
  return parseLocal(input, clients);
}

/**
 * Re-parse for missing slot extraction (used in AWAITING_MISSING_SLOTS).
 * Only extracts the specific slot type from user's reply.
 * Remains synchronous — slot-level extraction doesn't benefit from LLM.
 */
export function parseSlot(
  input: string,
  slotName: string,
  clients: Client[]
): { value: any; matched: boolean } {
  if (slotName === "dueDate") {
    const result = parseRelativeDate(input);
    return result ? { value: result.date, matched: true } : { value: null, matched: false };
  }
  if (slotName === "client") {
    let matches = matchClient(input, clients);

    // Fallback: single-char surname → startsWith
    if (matches.length === 0 && input.trim().length === 1) {
      const ch = input.trim();
      const found = clients.filter((c) => {
        const names = [c.remarkName, c.name].filter(Boolean) as string[];
        return names.some((n) => n.startsWith(ch));
      });
      matches = found.map((c) => ({ client: c, score: 0.4, matchedText: ch }));
    }

    // Fallback: "小X" nickname → surname match
    if (matches.length === 0) {
      const xiaoMatch = input.trim().match(/^小([\u4e00-\u9fff])$/);
      if (xiaoMatch) {
        const surname = xiaoMatch[1];
        const found = clients.filter((c) => {
          const names = [c.remarkName, c.name].filter(Boolean) as string[];
          return names.some((n) => n.startsWith(surname));
        });
        matches = found.map((c) => ({ client: c, score: 0.4, matchedText: input.trim() }));
      }
    }

    // Fallback: substring match (e.g., "学区房" matches remarkName "学区房客户")
    if (matches.length === 0) {
      const q = input.trim().toLowerCase();
      if (q.length >= 1) {
        const found = clients.filter((c) => {
          const names = [c.remarkName, c.name].filter(Boolean) as string[];
          return names.some((n) => n.toLowerCase().includes(q));
        });
        matches = found.map((c) => ({ client: c, score: 0.5, matchedText: q }));
      }
    }

    return matches.length > 0
      ? { value: matches, matched: true }
      : { value: null, matched: false };
  }
  if (slotName === "action") {
    const trimmed = input.trim();
    return trimmed ? { value: trimmed, matched: true } : { value: null, matched: false };
  }
  if (slotName === "field") {
    const fieldMap: Record<string, string> = {
      "状态": "status", "紧急度": "urgency", "电话": "phone",
      "手机": "phone", "预算": "budget", "微信": "wechat", "标签": "tags",
    };
    const trimmed = input.trim();
    const mapped = fieldMap[trimmed];
    if (mapped) return { value: mapped, matched: true };
    // Check if user typed the English field name directly
    if (Object.values(fieldMap).includes(trimmed)) return { value: trimmed, matched: true };
    return { value: null, matched: false };
  }
  if (slotName === "value") {
    const trimmed = input.trim();
    return trimmed ? { value: trimmed, matched: true } : { value: null, matched: false };
  }
  return { value: null, matched: false };
}
