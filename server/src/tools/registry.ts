import type { ToolRegistry } from "./types.js";
import {
  stubCompleteTask,
  stubListTodayTasks,
  stubRescheduleTask,
  stubScheduleReminder,
  stubCancelReminder,
  stubListReminders,
} from "./stubs.js";
import {
  createTaskTool,
  openClientTool,
  searchClientTool,
  updateClientTool,
} from "./implementations.js";

export const TOOL_REGISTRY: ToolRegistry = {
  "crm.searchClient": {
    name: "crm.searchClient",
    intentSupport: ["FIND_CLIENT", "OPEN_CLIENT", "CREATE_TASK", "UPDATE_CLIENT"],
    run: searchClientTool,
  },
  "crm.openClient": {
    name: "crm.openClient",
    intentSupport: ["OPEN_CLIENT", "FIND_CLIENT"],
    run: openClientTool,
  },
  "crm.updateClient": {
    name: "crm.updateClient",
    intentSupport: ["UPDATE_CLIENT"],
    run: updateClientTool,
  },
  "task.create": {
    name: "task.create",
    intentSupport: ["CREATE_TASK"],
    run: createTaskTool,
  },
  "task.complete": {
    name: "task.complete",
    intentSupport: [],
    run: stubCompleteTask,
  },
  "task.reschedule": {
    name: "task.reschedule",
    intentSupport: ["CREATE_TASK"],
    run: stubRescheduleTask,
  },
  "task.listToday": {
    name: "task.listToday",
    intentSupport: ["VIEW_TODAY", "GREETING"],
    run: stubListTodayTasks,
  },
  "reminder.schedule": {
    name: "reminder.schedule",
    intentSupport: ["CREATE_TASK"],
    run: stubScheduleReminder,
  },
  "reminder.cancel": {
    name: "reminder.cancel",
    intentSupport: [],
    run: stubCancelReminder,
  },
  "reminder.list": {
    name: "reminder.list",
    intentSupport: ["VIEW_TODAY"],
    run: stubListReminders,
  },
};
