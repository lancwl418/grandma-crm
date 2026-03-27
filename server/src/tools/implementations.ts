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

export async function getRecentActivityTool(
  input: { days?: number },
  context: ToolContext
): Promise<ToolResult<{
  activities: Array<{ clientName: string; date: string; content: string }>;
  total: number;
}>> {
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const days = input.days ?? 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error } = await supabaseAdmin
    .from("client_logs")
    .select("date, content, client_id, clients!inner(name, remark_name, user_id)")
    .eq("clients.user_id", context.userId)
    .gte("date", since.toISOString())
    .order("date", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[getRecentActivity]", { traceId: context.traceId, error: error.message });
    return { ok: false, error: "Database query failed" };
  }

  const activities = (data ?? []).map((row: any) => ({
    clientName: (row.clients?.remark_name || row.clients?.name || "").trim(),
    date: row.date,
    content: row.content,
  }));

  return { ok: true, output: { activities, total: activities.length } };
}

export async function getStaleClientsTool(
  input: { days?: number },
  context: ToolContext
): Promise<ToolResult<{
  clients: Array<{ id: string; name: string; status: string; lastContactDate: string | null; daysSinceContact: number }>;
  total: number;
}>> {
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const days = input.days ?? 7;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  // Get all active clients with their latest log date
  const { data, error } = await supabaseAdmin
    .from("clients")
    .select("id, name, remark_name, status, client_logs(date)")
    .eq("user_id", context.userId)
    .not("status", "in", '("已成交","暂缓")');

  if (error) {
    console.error("[getStaleClients]", { traceId: context.traceId, error: error.message });
    return { ok: false, error: "Database query failed" };
  }

  const now = Date.now();
  const stale = (data ?? [])
    .map((row: any) => {
      const logs = (row.client_logs ?? []) as Array<{ date: string }>;
      const lastLog = logs.length > 0
        ? logs.sort((a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date))[0].date
        : null;
      const daysSince = lastLog
        ? Math.floor((now - new Date(lastLog).getTime()) / (1000 * 60 * 60 * 24))
        : 999;
      return {
        id: row.id,
        name: (row.remark_name || row.name || "").trim(),
        status: row.status,
        lastContactDate: lastLog,
        daysSinceContact: daysSince,
      };
    })
    .filter((c) => c.daysSinceContact >= days)
    .sort((a, b) => b.daysSinceContact - a.daysSinceContact)
    .slice(0, 20);

  return { ok: true, output: { clients: stale, total: stale.length } };
}

export async function getNewClientsCountTool(
  input: { days?: number },
  context: ToolContext
): Promise<ToolResult<{
  count: number;
  clients: Array<{ id: string; name: string; status: string; createdAt: string }>;
}>> {
  if (!supabaseAdmin) {
    return { ok: false, error: "Database not configured" };
  }

  const days = input.days ?? 7;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const { data, error, count } = await supabaseAdmin
    .from("clients")
    .select("id, name, remark_name, status, created_at", { count: "exact" })
    .eq("user_id", context.userId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getNewClientsCount]", { traceId: context.traceId, error: error.message });
    return { ok: false, error: "Database query failed" };
  }

  const clients = (data ?? []).map((row) => ({
    id: row.id,
    name: (row.remark_name || row.name || "").trim(),
    status: row.status,
    createdAt: row.created_at,
  }));

  return { ok: true, output: { count: count ?? clients.length, clients } };
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
