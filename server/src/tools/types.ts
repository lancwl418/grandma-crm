import type { IntentType } from "../schema.js";

export type ToolName =
  | "crm.searchClient"
  | "crm.openClient"
  | "crm.updateClient"
  | "task.create"
  | "task.complete"
  | "task.reschedule"
  | "task.listToday"
  | "reminder.schedule"
  | "reminder.cancel"
  | "reminder.list";

export interface ToolContext {
  userId: string;
  traceId: string;
}

export interface ToolResult<TOutput = unknown> {
  ok: boolean;
  output?: TOutput;
  error?: string;
}

export interface SearchClientInput {
  query: string;
}

export interface OpenClientInput {
  clientId: string;
}

export interface UpdateClientInput {
  clientId: string;
  field: string;
  value: string;
}

export interface CreateTaskInput {
  clientId: string;
  action: string;
  dueDateISO: string;
}

export interface CompleteTaskInput {
  taskId: string;
}

export interface RescheduleTaskInput {
  taskId: string;
  dueDateISO: string;
}

export interface ListTodayTasksInput {
  includeOverdue?: boolean;
}

export interface ScheduleReminderInput {
  taskId: string;
  dueAtISO: string;
  channel?: "inapp" | "email";
}

export interface CancelReminderInput {
  reminderId: string;
}

export interface ListRemindersInput {
  status?: "pending" | "sent" | "failed" | "cancelled";
}

export type ToolInputMap = {
  "crm.searchClient": SearchClientInput;
  "crm.openClient": OpenClientInput;
  "crm.updateClient": UpdateClientInput;
  "task.create": CreateTaskInput;
  "task.complete": CompleteTaskInput;
  "task.reschedule": RescheduleTaskInput;
  "task.listToday": ListTodayTasksInput;
  "reminder.schedule": ScheduleReminderInput;
  "reminder.cancel": CancelReminderInput;
  "reminder.list": ListRemindersInput;
};

export type ToolOutputMap = {
  "crm.searchClient": { matches: Array<{ id: string; name: string }> };
  "crm.openClient": { clientId: string };
  "crm.updateClient": { clientId: string; field: string; value: string };
  "task.create": { taskId: string };
  "task.complete": { taskId: string };
  "task.reschedule": { taskId: string; dueDateISO: string };
  "task.listToday": { tasks: Array<{ taskId: string; clientId: string; title: string }> };
  "reminder.schedule": { reminderId: string };
  "reminder.cancel": { reminderId: string };
  "reminder.list": { reminders: Array<{ reminderId: string; taskId: string; status: string }> };
};

export interface ToolDefinition<K extends ToolName> {
  name: K;
  intentSupport: IntentType[];
  run: (
    input: ToolInputMap[K],
    context: ToolContext
  ) => Promise<ToolResult<ToolOutputMap[K]>>;
}

export type ToolRegistry = {
  [K in ToolName]: ToolDefinition<K>;
};
