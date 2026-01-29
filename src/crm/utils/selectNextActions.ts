import type { Client, ClientLog } from "@/crm/types";
import type { NextAction } from "@/crm/components/NextActionsModule";

/**
 * 从 nextAction 字符串中解析日期
 * 格式可能是: "2025-02-15：安排看房" 或 "下周末安排 2 套看房"
 */
function parseDateFromNextAction(nextAction: string): Date | null {
  // 尝试匹配日期格式 "YYYY-MM-DD："
  const dateMatch = nextAction.match(/^(\d{4}-\d{2}-\d{2})[：:]/);
  if (dateMatch) {
    const date = new Date(dateMatch[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

/**
 * 获取客户最后联系日期（最新日志的日期）
 */
function getLastContactDate(client: Client): Date | null {
  if (!client.logs || client.logs.length === 0) {
    return null;
  }
  
  const sortedLogs = [...client.logs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  const lastLogDate = new Date(sortedLogs[0].date);
  return isNaN(lastLogDate.getTime()) ? null : lastLogDate;
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * 检查日期是否是今天（只比较年月日）
 */
function isToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate.getTime() === today.getTime();
}

/**
 * 检查日期是否已过期（早于今天）
 */
function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate.getTime() < today.getTime();
}

/**
 * 生成行动建议列表
 */
export function selectNextActions(clients: Client[]): NextAction[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const actions: NextAction[] = [];
  const usedClientIds = new Set<string>();

  // 1. 收集已逾期任务（dueDate < today）
  for (const client of clients) {
    if (!client.logs || client.logs.length === 0) continue;
    
    for (const log of client.logs) {
      if (!log.nextAction) continue;
      
      const dueDate = parseDateFromNextAction(log.nextAction);
      if (!dueDate) continue;
      
      if (isOverdue(dueDate)) {
        const daysOverdue = daysBetween(dueDate, today);
        actions.push({
          id: `overdue-${client.id}-${log.id}`,
          clientId: client.id,
          clientName: client.remarkName || client.name || "未命名客户",
          badgeText: client.status || undefined,
          actionTitle: log.nextActionTodo || log.nextAction.split(/[：:]/)[1]?.trim() || log.nextAction,
          reason: `已逾期 ${daysOverdue} 天`,
          ctaText: "打开客户",
          kind: "overdue",
          taskId: log.id,
        });
        usedClientIds.add(client.id);
      }
    }
  }

  // 2. 收集今天截止任务（dueDate === today）
  for (const client of clients) {
    if (usedClientIds.has(client.id)) continue;
    if (!client.logs || client.logs.length === 0) continue;
    
    for (const log of client.logs) {
      if (!log.nextAction) continue;
      
      const dueDate = parseDateFromNextAction(log.nextAction);
      if (!dueDate) continue;
      
      if (isToday(dueDate)) {
        actions.push({
          id: `today-${client.id}-${log.id}`,
          clientId: client.id,
          clientName: client.remarkName || client.name || "未命名客户",
          badgeText: client.status || undefined,
          actionTitle: log.nextActionTodo || log.nextAction.split(/[：:]/)[1]?.trim() || log.nextAction,
          reason: "今天要收尾",
          ctaText: "打开客户",
          kind: "today",
          taskId: log.id,
        });
        usedClientIds.add(client.id);
        break; // 每个客户只取一条今天任务
      }
    }
  }

  // 3. 如果不足 3 条，用久未联系客户补足
  if (actions.length < 3) {
    const clientsWithLastContact = clients
      .filter((c) => !usedClientIds.has(c.id))
      .map((c) => ({
        client: c,
        lastContactDate: getLastContactDate(c),
      }))
      .filter((item) => item.lastContactDate !== null)
      .map((item) => ({
        ...item,
        daysSinceContact: daysBetween(item.lastContactDate!, today),
      }))
      .sort((a, b) => b.daysSinceContact - a.daysSinceContact); // 降序：最久未联系的在前面

    for (const { client, daysSinceContact } of clientsWithLastContact) {
      if (actions.length >= 3) break;
      
      actions.push({
        id: `revive-${client.id}`,
        clientId: client.id,
        clientName: client.remarkName || client.name || "未命名客户",
        badgeText: client.status || undefined,
        actionTitle: "发微信激活一下",
        reason: `${daysSinceContact} 天未联系`,
        ctaText: "去记录",
        kind: "revive",
      });
    }
  }

  // 限制最多 3 条
  return actions.slice(0, 3);
}
