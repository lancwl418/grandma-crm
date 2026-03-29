import type { FlatTask } from "./dashboardTasks";

const NOTIFIED_KEY = "grandma-crm-notified-tasks";

function getNotifiedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveNotifiedIds(ids: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
}

export function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return Promise.resolve("denied" as NotificationPermission);
  if (Notification.permission === "granted") return Promise.resolve("granted");
  if (Notification.permission === "denied") return Promise.resolve("denied");
  return Notification.requestPermission();
}

export function sendTaskReminders(tasks: FlatTask[]) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (tasks.length === 0) return;

  const notified = getNotifiedIds();
  const newTasks = tasks.filter((t) => !notified.has(t.id));
  if (newTasks.length === 0) return;

  // 发送一条汇总通知
  const title = `Estate Epic · 你有 ${newTasks.length} 件待办`;
  const lines = newTasks.slice(0, 3).map((t) => {
    const suffix = t.isOverdue ? `（逾期 ${t.daysOverdue} 天）` : "";
    return `${t.clientName} - ${t.title}${suffix}`;
  });
  if (newTasks.length > 3) {
    lines.push(`...还有 ${newTasks.length - 3} 项`);
  }

  new Notification(title, {
    body: lines.join("\n"),
    icon: "/favicon.ico",
    tag: "grandma-crm-tasks",
  });

  // 标记为已通知
  for (const t of newTasks) {
    notified.add(t.id);
  }
  saveNotifiedIds(notified);
}

/** 每日清理旧通知记录（避免 localStorage 无限增长） */
export function cleanupOldNotifications(activeTasks: FlatTask[]) {
  const activeIds = new Set(activeTasks.map((t) => t.id));
  const notified = getNotifiedIds();
  const cleaned = new Set([...notified].filter((id) => activeIds.has(id)));
  saveNotifiedIds(cleaned);
}
