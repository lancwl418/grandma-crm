import type {
  ToolContext,
  ToolOutputMap,
  ToolResult,
} from "./types.js";

async function notImplemented<TOutput>(
  toolName: string,
  _context: ToolContext
): Promise<ToolResult<TOutput>> {
  return {
    ok: false,
    error: `${toolName} is not implemented yet`,
  };
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
