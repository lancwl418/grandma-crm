/**
 * Intent Parser — 结构化意图解析层
 *
 * 将用户自然语言输入转换为结构化 ParsedIntent。
 * 当前使用本地正则 + voiceTaskParser；
 * 后续可替换为 LLM API 调用，输出接口不变。
 */
import type { Client } from "@/crm/types";
import {
  parseVoiceTask,
  matchClient,
  parseRelativeDate,
  type ClientMatch,
} from "@/crm/utils/voiceTaskParser";

// ── Types ─────────────────────────────────────────────────────

export type IntentType =
  | "FIND_CLIENT"
  | "CREATE_TASK"
  | "ADD_CLIENT"
  | "VIEW_TODAY"
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
  };
  missing: string[];
  confidence: number;
}

// ── Intent classification (regex) ─────────────────────────────

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

function classifyIntent(input: string): IntentType {
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

// ── Main parse function ───────────────────────────────────────

/**
 * Parse user input into a structured intent.
 * This is the single swap point for LLM integration.
 */
export function parse(input: string, clients: Client[]): ParsedIntent {
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

/**
 * Re-parse for missing slot extraction (used in AWAITING_MISSING_SLOTS).
 * Only extracts the specific slot type from user's reply.
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
    const matches = matchClient(input, clients);
    return matches.length > 0
      ? { value: matches, matched: true }
      : { value: null, matched: false };
  }
  if (slotName === "action") {
    const trimmed = input.trim();
    return trimmed ? { value: trimmed, matched: true } : { value: null, matched: false };
  }
  return { value: null, matched: false };
}
