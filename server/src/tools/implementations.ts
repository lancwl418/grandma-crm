import { supabaseAdmin } from "../lib/supabase.js";
import type {
  CreateTaskInput,
  OpenClientInput,
  SearchClientInput,
  ToolContext,
  ToolOutputMap,
  ToolResult,
  UpdateClientInput,
} from "./types.js";

function formatDueDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export async function searchClientTool(
  input: SearchClientInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.searchClient"]>> {
  const query = input.query.trim().toLowerCase();
  if (!query) {
    return { ok: false, error: "query is required" };
  }
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, remark_name")
    .eq("user_id", context.userId)
    .or(`remark_name.ilike.%${query}%,name.ilike.%${query}%`)
    .limit(10);

  if (error) {
    console.error("[searchClient]", { traceId: context.traceId, error: error.message });
    return { ok: false, error: "Database query failed" };
  }

  const matches = (data ?? []).map((row) => ({
    id: row.id,
    name: (row.remark_name || row.name || "").trim(),
  }));

  return { ok: true, output: { matches } };
}

export async function createTaskTool(
  input: CreateTaskInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["task.create"]>> {
  const action = input.action.trim();
  if (!input.clientId || !action || !input.dueDateISO) {
    return { ok: false, error: "clientId, action and dueDateISO are required" };
  }
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const dueDate = new Date(input.dueDateISO);
  if (Number.isNaN(dueDate.getTime())) {
    return { ok: false, error: "dueDateISO is invalid" };
  }

  // Verify client exists
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("user_id", context.userId)
    .single();

  if (clientError || !client) {
    return { ok: false, error: "client not found" };
  }

  // Insert log into client_logs table
  const { data: log, error: logError } = await supabaseAdmin
    .from("client_logs")
    .insert({
      client_id: input.clientId,
      date: new Date().toISOString(),
      content: `[AI任务] ${action}`,
      next_action: `${formatDueDate(dueDate)}：${action}`,
      next_action_todo: action,
    })
    .select("id")
    .single();

  if (logError || !log) {
    console.error("[createTask]", { traceId: context.traceId, error: logError?.message });
    return { ok: false, error: "Failed to create task" };
  }

  return { ok: true, output: { taskId: log.id } };
}

export async function openClientTool(
  input: OpenClientInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.openClient"]>> {
  if (!input.clientId) {
    return { ok: false, error: "clientId is required" };
  }
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", input.clientId)
    .eq("user_id", context.userId)
    .single();

  if (error || !data) {
    return { ok: false, error: "client not found" };
  }

  return { ok: true, output: { clientId: input.clientId } };
}

export async function updateClientTool(
  input: UpdateClientInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.updateClient"]>> {
  const { clientId, field } = input;
  const value = input.value.trim();
  if (!clientId || !field || !value) {
    return { ok: false, error: "clientId, field and value are required" };
  }
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  // Verify client exists
  const { data: client, error: clientError } = await supabaseAdmin
    .from("clients")
    .select("id")
    .eq("id", clientId)
    .eq("user_id", context.userId)
    .single();

  if (clientError || !client) {
    return { ok: false, error: "client not found" };
  }

  // Build update payload
  const payload: Record<string, unknown> = {};
  if (field === "status") payload.status = value;
  else if (field === "urgency") payload.urgency = value;
  else if (field === "phone") payload.phone = value;
  else if (field === "wechat") payload.wechat = value;
  else if (field === "budget") payload.budget_max = value;
  else if (field === "tags") {
    const tags = value.split(/[,，、\s]+/).filter(Boolean);
    payload.tags = tags;
    payload.requirement_tags = tags;
  } else {
    return { ok: false, error: `unsupported field: ${field}` };
  }

  const { error: updateError } = await supabaseAdmin
    .from("clients")
    .update(payload)
    .eq("id", clientId)
    .eq("user_id", context.userId);

  if (updateError) {
    console.error("[updateClient]", { traceId: context.traceId, error: updateError.message });
    return { ok: false, error: "Failed to update client" };
  }

  return { ok: true, output: { clientId, field, value } };
}
