import { supabase } from "./supabase";
import type { Client, ClientLog } from "@/crm/types";

// ── Row → Client 转换 ─────────────────────────────

interface ClientRow {
  id: string;
  name: string | null;
  remark_name: string;
  phone: string | null;
  wechat: string | null;
  birthday: string | null;
  status: string;
  urgency: "high" | "medium" | "low";
  tags: string[];
  budget_min: string | null;
  budget_max: string | null;
  areas: string[];
  property_type: string | null;
  requirement_tags: string[];
  requirement_notes: string | null;
  client_logs?: LogRow[];
}

interface LogRow {
  id: string;
  date: string;
  content: string;
  images: string[];
  next_action: string | null;
  next_action_todo: string | null;
}

function logRowToClientLog(row: LogRow): ClientLog {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    images: row.images?.length ? row.images : undefined,
    nextAction: row.next_action ?? undefined,
    nextActionTodo: row.next_action_todo ?? undefined,
  };
}

function rowToClient(row: ClientRow): Client {
  const logs = (row.client_logs ?? []).map(logRowToClientLog);
  return {
    id: row.id,
    name: row.name ?? undefined,
    remarkName: row.remark_name,
    phone: row.phone ?? undefined,
    wechat: row.wechat ?? undefined,
    birthday: row.birthday ?? undefined,
    status: row.status,
    urgency: row.urgency,
    tags: row.tags ?? [],
    requirements: {
      budgetMin: row.budget_min ?? undefined,
      budgetMax: row.budget_max ?? undefined,
      areas: row.areas ?? [],
      type: row.property_type ?? undefined,
      tags: row.requirement_tags ?? [],
      notes: row.requirement_notes ?? undefined,
    },
    logs,
  };
}

// ── CRUD ─────────────────────────────────────────

export async function fetchClients(): Promise<Client[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("clients")
    .select("*, client_logs(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchClients error:", error);
    return [];
  }

  return (data ?? []).map((row: any) => rowToClient(row));
}

export async function createClient(client: Partial<Client>): Promise<Client | null> {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("clients")
    .insert({
      user_id: user.id,
      name: client.name ?? null,
      remark_name: client.remarkName ?? "",
      phone: client.phone ?? null,
      wechat: client.wechat ?? null,
      birthday: client.birthday ?? null,
      status: client.status ?? "新客户",
      urgency: client.urgency ?? "medium",
      tags: client.tags ?? [],
      budget_min: client.requirements?.budgetMin ?? null,
      budget_max: client.requirements?.budgetMax ?? null,
      areas: client.requirements?.areas ?? [],
      property_type: client.requirements?.type ?? null,
      requirement_tags: client.requirements?.tags ?? [],
      requirement_notes: client.requirements?.notes ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("createClient error:", error);
    return null;
  }

  return rowToClient({ ...data, client_logs: [] });
}

export async function updateClient(id: string, updates: Partial<Client>): Promise<boolean> {
  if (!supabase) return false;

  const row: Record<string, unknown> = {};
  if (updates.remarkName !== undefined) row.remark_name = updates.remarkName;
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.phone !== undefined) row.phone = updates.phone;
  if (updates.wechat !== undefined) row.wechat = updates.wechat;
  if (updates.birthday !== undefined) row.birthday = updates.birthday;
  if (updates.status !== undefined) row.status = updates.status;
  if (updates.urgency !== undefined) row.urgency = updates.urgency;
  if (updates.tags !== undefined) row.tags = updates.tags;
  if (updates.requirements) {
    const r = updates.requirements;
    if (r.budgetMin !== undefined) row.budget_min = r.budgetMin;
    if (r.budgetMax !== undefined) row.budget_max = r.budgetMax;
    if (r.areas !== undefined) row.areas = r.areas;
    if (r.type !== undefined) row.property_type = r.type;
    if (r.tags !== undefined) row.requirement_tags = r.tags;
    if (r.notes !== undefined) row.requirement_notes = r.notes;
  }

  if (Object.keys(row).length === 0) return true;

  const { error } = await supabase
    .from("clients")
    .update(row)
    .eq("id", id);

  if (error) {
    console.error("updateClient error:", error);
    return false;
  }
  return true;
}

export async function addClientLog(
  clientId: string,
  log: Omit<ClientLog, "id">
): Promise<ClientLog | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("client_logs")
    .insert({
      client_id: clientId,
      date: log.date,
      content: log.content,
      images: log.images ?? [],
      next_action: log.nextAction ?? null,
      next_action_todo: log.nextActionTodo ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("addClientLog error:", error);
    return null;
  }
  return logRowToClientLog(data);
}

export async function updateClientLog(
  logId: string,
  updates: Partial<ClientLog>
): Promise<boolean> {
  if (!supabase) return false;

  const row: Record<string, unknown> = {};
  if (updates.content !== undefined) row.content = updates.content;
  if (updates.nextAction !== undefined) row.next_action = updates.nextAction;
  if (updates.nextActionTodo !== undefined) row.next_action_todo = updates.nextActionTodo;

  if (Object.keys(row).length === 0) return true;

  const { error } = await supabase
    .from("client_logs")
    .update(row)
    .eq("id", logId);

  if (error) {
    console.error("updateClientLog error:", error);
    return false;
  }
  return true;
}
