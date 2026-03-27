import { supabaseAdmin } from "../lib/supabase.js";
import type {
  AddClientLogInput,
  CreateTaskInput,
  GetClientDetailInput,
  ListClientsByFilterInput,
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

export async function addClientLogTool(
  input: AddClientLogInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.addClientLog"]>> {
  const content = input.content.trim();
  if (!input.clientId || !content) {
    return { ok: false, error: "clientId and content are required" };
  }
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
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

  const { data: log, error: logError } = await supabaseAdmin
    .from("client_logs")
    .insert({
      client_id: input.clientId,
      date: new Date().toISOString(),
      content,
      next_action: input.nextAction ?? null,
      next_action_todo: null,
    })
    .select("id")
    .single();

  if (logError || !log) {
    console.error("[addClientLog]", { traceId: context.traceId, error: logError?.message });
    return { ok: false, error: "Failed to add log" };
  }

  return { ok: true, output: { logId: log.id } };
}

export async function getClientDetailTool(
  input: GetClientDetailInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.getClientDetail"]>> {
  if (!input.clientId) {
    return { ok: false, error: "clientId is required" };
  }
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, remark_name, status, urgency, phone, wechat, budget_min, budget_max, areas, tags, requirement_tags, client_logs(date, content, next_action)")
    .eq("id", input.clientId)
    .eq("user_id", context.userId)
    .single();

  if (error || !data) {
    return { ok: false, error: "client not found" };
  }

  const logs = (data.client_logs ?? []) as Array<{ date: string; content: string; next_action: string | null }>;
  // Sort by date desc, take last 5
  logs.sort((a, b) => b.date.localeCompare(a.date));
  const recentLogs = logs.slice(0, 5).map((l) => ({
    date: l.date,
    content: l.content,
    nextAction: l.next_action ?? undefined,
  }));

  const budget = [data.budget_min, data.budget_max].filter(Boolean).join(" - ") || undefined;

  return {
    ok: true,
    output: {
      id: data.id,
      name: (data.remark_name || data.name || "").trim(),
      status: data.status,
      urgency: data.urgency,
      phone: data.phone ?? undefined,
      wechat: data.wechat ?? undefined,
      budget,
      areas: data.areas ?? [],
      tags: [...(data.tags ?? []), ...(data.requirement_tags ?? [])],
      recentLogs,
    },
  };
}

export async function getClientStatsTool(
  _input: Record<string, never>,
  context: ToolContext
): Promise<ToolResult<{
  total: number;
  byStatus: Record<string, number>;
  byUrgency: Record<string, number>;
}>> {
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("status, urgency")
    .eq("user_id", context.userId);

  if (error) {
    console.error("[getClientStats]", { traceId: context.traceId, error: error.message });
    return { ok: false, error: "Database query failed" };
  }

  const rows = data ?? [];
  const byStatus: Record<string, number> = {};
  const byUrgency: Record<string, number> = {};

  for (const row of rows) {
    const s = row.status || "未知";
    byStatus[s] = (byStatus[s] || 0) + 1;
    const u = row.urgency || "medium";
    byUrgency[u] = (byUrgency[u] || 0) + 1;
  }

  return { ok: true, output: { total: rows.length, byStatus, byUrgency } };
}

export async function listClientsByFilterTool(
  input: ListClientsByFilterInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.listClientsByFilter"]>> {
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  let query = supabaseAdmin
    .from("clients")
    .select("id, name, remark_name, status, urgency", { count: "exact" })
    .eq("user_id", context.userId);

  if (input.status) {
    query = query.eq("status", input.status);
  }
  if (input.urgency) {
    query = query.eq("urgency", input.urgency);
  }

  const limit = Math.min(input.limit ?? 20, 50);
  query = query.order("created_at", { ascending: false }).limit(limit);

  const { data, error, count } = await query;

  if (error) {
    console.error("[listClientsByFilter]", { traceId: context.traceId, error: error.message });
    return { ok: false, error: "Database query failed" };
  }

  const clients = (data ?? []).map((row) => ({
    id: row.id,
    name: (row.remark_name || row.name || "").trim(),
    status: row.status,
    urgency: row.urgency,
  }));

  return { ok: true, output: { clients, total: count ?? clients.length } };
}
