import { FieldValue } from "firebase-admin/firestore";
import { db, getClientsCollectionPath } from "../firebaseAdmin";
import type {
  CreateTaskInput,
  OpenClientInput,
  SearchClientInput,
  ToolContext,
  ToolOutputMap,
  ToolResult,
  UpdateClientInput,
} from "./types";

function formatDueDate(date: Date): string {
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function buildTaskLog(action: string, dueDate: Date, logId: string) {
  return {
    id: logId,
    date: new Date().toISOString(),
    content: `[AI任务] ${action}`,
    nextAction: `${formatDueDate(dueDate)}：${action}`,
    nextActionTodo: action,
  };
}

export async function searchClientTool(
  input: SearchClientInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.searchClient"]>> {
  const query = input.query.trim().toLowerCase();
  if (!query) {
    return { ok: false, error: "query is required" };
  }

  const clientsPath = getClientsCollectionPath(context.userId);
  const snapshot = await db.collection(clientsPath).limit(200).get();

  const matches = snapshot.docs
    .map((doc) => {
      const data = doc.data() as { name?: string; remarkName?: string };
      const name = (data.remarkName || data.name || "").trim();
      return { id: doc.id, name };
    })
    .filter((client) => client.name.toLowerCase().includes(query))
    .sort((a, b) => {
      const aStarts = a.name.toLowerCase().startsWith(query) ? 1 : 0;
      const bStarts = b.name.toLowerCase().startsWith(query) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;
      return a.name.length - b.name.length;
    })
    .slice(0, 10);

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

  const dueDate = new Date(input.dueDateISO);
  if (Number.isNaN(dueDate.getTime())) {
    return { ok: false, error: "dueDateISO is invalid" };
  }

  const clientsPath = getClientsCollectionPath(context.userId);
  const clientRef = db.collection(clientsPath).doc(input.clientId);
  const clientSnap = await clientRef.get();

  if (!clientSnap.exists) {
    return { ok: false, error: "client not found" };
  }

  const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const log = buildTaskLog(action, dueDate, taskId);

  await clientRef.update({
    logs: FieldValue.arrayUnion(log),
  });

  return { ok: true, output: { taskId } };
}

export async function openClientTool(
  input: OpenClientInput,
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.openClient"]>> {
  if (!input.clientId) {
    return { ok: false, error: "clientId is required" };
  }
  const clientsPath = getClientsCollectionPath(context.userId);
  const clientSnap = await db.collection(clientsPath).doc(input.clientId).get();
  if (!clientSnap.exists) {
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

  const clientsPath = getClientsCollectionPath(context.userId);
  const clientRef = db.collection(clientsPath).doc(clientId);
  const clientSnap = await clientRef.get();

  if (!clientSnap.exists) {
    return { ok: false, error: "client not found" };
  }

  const payload: Record<string, unknown> = {};
  if (field === "status") payload.status = value;
  else if (field === "urgency") payload.urgency = value;
  else if (field === "phone") payload.phone = value;
  else if (field === "wechat") payload.wechat = value;
  else if (field === "budget") payload["requirements.budgetMax"] = value;
  else if (field === "tags") {
    const tags = value.split(/[,，、\s]+/).filter(Boolean);
    payload.tags = tags;
    payload["requirements.tags"] = tags;
  } else {
    return { ok: false, error: `unsupported field: ${field}` };
  }

  await clientRef.update(payload);
  return { ok: true, output: { clientId, field, value } };
}
