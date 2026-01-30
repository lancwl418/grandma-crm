import type { Client } from "@/crm/types";

export type FlatTask = {
  id: string;
  clientId: string;
  clientName: string;
  logId: string;
  dueDate: Date;
  title: string;
  isOverdue: boolean;
  isToday: boolean;
  isThisWeek: boolean;
  daysOverdue: number; // 0 when not overdue; when overdue, positive number
};

function parseDateFromNextAction(nextAction: string): Date | null {
  const dateMatch = nextAction.match(/^(\d{4}-\d{2}-\d{2})[：:]/);
  if (dateMatch) {
    const date = new Date(dateMatch[1]);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function toDateOnly(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((toDateOnly(a).getTime() - toDateOnly(b).getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * 从所有客户中提取带截止日期的任务（扁平列表）
 */
function extractFlatTasks(clients: Client[]): FlatTask[] {
  const today = toDateOnly(new Date());
  const tasks: FlatTask[] = [];

  for (const client of clients) {
    if (!client.logs) continue;
    const clientName = client.remarkName || client.name || "未命名客户";

    for (const log of client.logs) {
      if (!log.nextAction) continue;
      const dueDate = parseDateFromNextAction(log.nextAction);
      if (!dueDate) continue;

      const dueOnly = toDateOnly(dueDate);
      const isOverdue = dueOnly.getTime() < today.getTime();
      const isTodayDue = dueOnly.getTime() === today.getTime();
      const daysOverdue = isOverdue ? Math.abs(daysBetween(today, dueOnly)) : 0;
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const isThisWeek = dueOnly.getTime() > today.getTime() && dueOnly.getTime() <= weekEnd.getTime();

      const title = log.nextActionTodo || log.nextAction.split(/[：:]/)[1]?.trim() || log.nextAction;

      tasks.push({
        id: `${client.id}-${log.id}`,
        clientId: client.id,
        clientName,
        logId: log.id,
        dueDate: dueOnly,
        title,
        isOverdue,
        isToday: isTodayDue,
        isThisWeek,
        daysOverdue,
      });
    }
  }

  return tasks;
}

/**
 * 已逾期：dueDate < today，按逾期天数降序
 */
export function getOverdueTasks(clients: Client[]): FlatTask[] {
  const all = extractFlatTasks(clients);
  const overdue = all.filter((t) => t.isOverdue);
  return overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
}

/**
 * 今日到期：dueDate === today
 */
export function getTodayDueTasks(clients: Client[]): FlatTask[] {
  const all = extractFlatTasks(clients);
  return all.filter((t) => t.isToday).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/**
 * 今天必须处理：已逾期 + 今日到期（合并列表，供需要统一展示时使用）
 */
export function getActionTasks(clients: Client[]): FlatTask[] {
  return [...getOverdueTasks(clients), ...getTodayDueTasks(clients)];
}

/**
 * 本周需要推进：dueDate > today 且 dueDate <= today+7
 */
export function getMomentumTasks(clients: Client[]): FlatTask[] {
  const all = extractFlatTasks(clients);
  const momentum = all.filter((t) => t.isThisWeek);
  return momentum.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/** 格式化为 nextAction 日期前缀 YYYY-MM-DD */
export function formatDateForNextAction(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
