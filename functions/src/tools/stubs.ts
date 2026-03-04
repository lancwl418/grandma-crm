import type {
  ToolContext,
  ToolOutputMap,
  ToolResult,
} from "./types";

async function notImplemented<TOutput>(
  toolName: string,
  _context: ToolContext
): Promise<ToolResult<TOutput>> {
  return {
    ok: false,
    error: `${toolName} is not implemented yet`,
  };
}

export async function stubSearchClient(
  _input: { query: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.searchClient"]>> {
  return notImplemented("crm.searchClient", context);
}

export async function stubOpenClient(
  _input: { clientId: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.openClient"]>> {
  return notImplemented("crm.openClient", context);
}

export async function stubUpdateClient(
  _input: { clientId: string; field: string; value: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["crm.updateClient"]>> {
  return notImplemented("crm.updateClient", context);
}

export async function stubCreateTask(
  _input: { clientId: string; action: string; dueDateISO: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["task.create"]>> {
  return notImplemented("task.create", context);
}

export async function stubCompleteTask(
  _input: { taskId: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["task.complete"]>> {
  return notImplemented("task.complete", context);
}

export async function stubRescheduleTask(
  _input: { taskId: string; dueDateISO: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["task.reschedule"]>> {
  return notImplemented("task.reschedule", context);
}

export async function stubListTodayTasks(
  _input: { includeOverdue?: boolean },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["task.listToday"]>> {
  return notImplemented("task.listToday", context);
}

export async function stubScheduleReminder(
  _input: { taskId: string; dueAtISO: string; channel?: "inapp" | "email" },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["reminder.schedule"]>> {
  return notImplemented("reminder.schedule", context);
}

export async function stubCancelReminder(
  _input: { reminderId: string },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["reminder.cancel"]>> {
  return notImplemented("reminder.cancel", context);
}

export async function stubListReminders(
  _input: { status?: "pending" | "sent" | "failed" | "cancelled" },
  context: ToolContext
): Promise<ToolResult<ToolOutputMap["reminder.list"]>> {
  return notImplemented("reminder.list", context);
}
