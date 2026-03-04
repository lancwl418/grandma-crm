import type { IntentType } from "@/crm/utils/intentParser";

export interface ParseAPISlots {
  clientQuery?: string;
  action?: string;
  dueDateText?: string;
  field?: string;
  value?: string;
}

export interface ParseAPIResponse {
  intent: IntentType;
  slots: ParseAPISlots;
  confidence: number;
  traceId: string;
}

const VALID_INTENTS: IntentType[] = [
  "FIND_CLIENT",
  "CREATE_TASK",
  "ADD_CLIENT",
  "VIEW_TODAY",
  "UPDATE_CLIENT",
  "OPEN_CLIENT",
  "GREETING",
  "UNKNOWN",
];

export function isParseAPIResponse(data: unknown): data is ParseAPIResponse {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.intent === "string" &&
    VALID_INTENTS.includes(obj.intent as IntentType) &&
    typeof obj.confidence === "number" &&
    typeof obj.traceId === "string" &&
    typeof obj.slots === "object" &&
    obj.slots !== null
  );
}
