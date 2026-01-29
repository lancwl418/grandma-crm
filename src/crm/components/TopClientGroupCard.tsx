import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronUp, AlertCircle, Calendar, CheckCircle2, Clock } from "lucide-react";
import type { Client, ClientLog } from "@/crm/types";

interface Task {
  id: string;
  dueDate: Date;
  title: string;
  isOverdue: boolean;
  isToday: boolean;
  daysOverdue?: number;
  logId: string;
}

interface Props {
  client: Client;
  onViewDetail: () => void;
  onCompleteTask?: (taskId: string) => void;
  onQuickRecord?: (clientId: string) => void;
}

/**
 * 从 nextAction 字符串中解析日期
 */
function parseDateFromNextAction(nextAction: string): Date | null {
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
 * 计算两个日期之间的天数差
 */
function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((date1.getTime() - date2.getTime()) / oneDay));
}

/**
 * 检查日期是否是今天
 */
function isToday(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate.getTime() === today.getTime();
}

/**
 * 检查日期是否已过期
 */
function isOverdue(date: Date): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(date);
  compareDate.setHours(0, 0, 0, 0);
  return compareDate.getTime() < today.getTime();
}

/**
 * 根据预算计算佣金等级
 */
function getCommissionLevel(budgetMin?: string, budgetMax?: string): { level: string; label: string } {
  const min = budgetMin ? parseFloat(budgetMin.replace(/[^0-9.]/g, "")) : 0;
  const max = budgetMax ? parseFloat(budgetMax.replace(/[^0-9.]/g, "")) : 0;
  const avg = (min + max) / 2 || min || max;

  if (avg >= 300) {
    return { level: "high", label: "高佣金" };
  } else if (avg >= 150) {
    return { level: "medium", label: "中佣金" };
  } else if (avg >= 80) {
    return { level: "low", label: "标准" };
  } else {
    return { level: "minimal", label: "基础" };
  }
}

/**
 * 计算两个日期之间的天数差（带符号，负数表示已过期）
 */
function getDaysDiff(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const compareDate = new Date(dueDate);
  compareDate.setHours(0, 0, 0, 0);
  const diffTime = compareDate.getTime() - today.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 生成 Top 3 排序解释文案
 */
function getTopReason(tasks: Task[], primaryTask: Task | undefined): { text: string; color: string } {
  // 如果最紧急任务已逾期
  if (primaryTask && primaryTask.isOverdue && primaryTask.daysOverdue !== undefined) {
    return {
      text: `已逾期 ${primaryTask.daysOverdue} 天：${primaryTask.title}`,
      color: "text-red-600",
    };
  }

  // 如果未逾期但今天截止
  if (primaryTask && primaryTask.isToday) {
    return {
      text: `今天截止：${primaryTask.title}`,
      color: "text-blue-600",
    };
  }

  // 如果该客户有多个待办任务
  if (tasks.length > 1) {
    return {
      text: `当前有 ${tasks.length} 个待办任务需要处理`,
      color: "text-gray-600",
    };
  }

  // 否则
  return {
    text: "今天需要处理该客户事项",
    color: "text-gray-500",
  };
}

/**
 * 提取并排序客户的任务
 */
function extractAndSortTasks(client: Client): Task[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tasks: Task[] = [];

  if (!client.logs) return tasks;

  for (const log of client.logs) {
    if (!log.nextAction) continue;

    const dueDate = parseDateFromNextAction(log.nextAction);
    if (!dueDate) continue;

    const taskTitle = log.nextActionTodo || log.nextAction.split(/[：:]/)[1]?.trim() || log.nextAction;
    const overdue = isOverdue(dueDate);
    const todayDue = isToday(dueDate);
    const daysOverdue = overdue ? daysBetween(dueDate, today) : undefined;

    tasks.push({
      id: log.id,
      dueDate,
      title: taskTitle,
      isOverdue: overdue,
      isToday: todayDue,
      daysOverdue,
      logId: log.id,
    });
  }

  // 排序：逾期优先（按逾期天数降序），然后今天截止，最后按日期升序
  return tasks.sort((a, b) => {
    if (a.isOverdue && b.isOverdue) {
      return (b.daysOverdue || 0) - (a.daysOverdue || 0);
    }
    if (a.isOverdue) return -1;
    if (b.isOverdue) return 1;
    if (a.isToday && !b.isToday) return -1;
    if (!a.isToday && b.isToday) return 1;
    return a.dueDate.getTime() - b.dueDate.getTime();
  });
}

const TopClientGroupCard: React.FC<Props> = ({ client, onViewDetail, onCompleteTask, onQuickRecord }) => {
  const [expanded, setExpanded] = useState(false);

  const tasks = useMemo(() => extractAndSortTasks(client), [client]);
  const primaryTask = tasks[0];
  const hasMultipleTasks = tasks.length > 1;
  const commission = useMemo(
    () => getCommissionLevel(client.requirements?.budgetMin, client.requirements?.budgetMax),
    [client.requirements]
  );

  // 区域简写（只显示第一个）
  const areaShort = client.requirements?.areas?.[0] || "";

  // 生成排序解释文案
  const topReason = useMemo(() => getTopReason(tasks, primaryTask), [tasks, primaryTask]);

  // 生成核心理由
  const getCoreReason = (): { text: string; color: string; icon: React.ReactNode } => {
    if (!primaryTask) {
      return {
        text: "暂无待办任务",
        color: "text-gray-500",
        icon: null,
      };
    }

    if (primaryTask.isOverdue) {
      return {
        text: `已逾期 ${primaryTask.daysOverdue} 天：${primaryTask.title}`,
        color: "text-red-600",
        icon: <AlertCircle className="h-4 w-4 text-red-500" />,
      };
    }

    if (primaryTask.isToday) {
      return {
        text: `今天截止：${primaryTask.title}`,
        color: "text-orange-600",
        icon: <Calendar className="h-4 w-4 text-orange-500" />,
      };
    }

    return {
      text: primaryTask.title,
      color: "text-gray-700",
      icon: <Clock className="h-4 w-4 text-gray-500" />,
    };
  };

  const coreReason = getCoreReason();

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* 折叠态 */}
      <div className="p-5">
        {/* 顶部：客户标识 + 佣金标签 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-lg font-bold text-gray-900">
                {client.remarkName || client.name}
              </h3>
              {areaShort && (
                <span className="text-xs text-gray-500 bg-gray-50 px-2 py-0.5 rounded">
                  {areaShort}
                </span>
              )}
            </div>
            {/* 排序解释文案 */}
            <p className={`text-sm ${topReason.color} mt-1`}>
              {topReason.text}
            </p>
          </div>
          {/* 佣金标签 - 右上角 */}
          <div className="flex flex-col items-end">
            <span
              className={`
                text-xs font-semibold px-2 py-1 rounded
                ${
                  commission.level === "high"
                    ? "bg-purple-100 text-purple-700"
                    : commission.level === "medium"
                    ? "bg-blue-100 text-blue-700"
                    : commission.level === "low"
                    ? "bg-green-100 text-green-700"
                    : "bg-gray-100 text-gray-600"
                }
              `}
            >
              {commission.label}
            </span>
          </div>
        </div>

        {/* 核心理由 - 视觉中心 */}
        <div className={`flex items-start gap-2 mb-3 ${coreReason.color}`}>
          {coreReason.icon}
          <p className="text-base font-semibold flex-1 leading-relaxed">{coreReason.text}</p>
          {onQuickRecord && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickRecord(client.id);
              }}
              className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded transition flex-shrink-0"
            >
              去记录
            </button>
          )}
        </div>

        {/* 多个待办提示 */}
        {hasMultipleTasks && !expanded && (
          <div className="text-sm text-gray-500 mb-3">
            · 共 {tasks.length} 个待办
          </div>
        )}

        {/* 行动入口 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-4 w-4" />
                收起
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4" />
                查看详情
              </>
            )}
          </button>
        </div>
      </div>

      {/* 展开态 - 任务清单 */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-3">
          <div className="text-sm font-semibold text-gray-700 mb-3">任务清单</div>
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-lg p-3 border border-gray-100 flex items-start justify-between gap-3"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {task.isOverdue && (
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                  )}
                  {task.isToday && !task.isOverdue && (
                    <Calendar className="h-4 w-4 text-orange-500 flex-shrink-0" />
                  )}
                  <span
                    className={`text-sm font-medium ${
                      task.isOverdue
                        ? "text-red-700"
                        : task.isToday
                        ? "text-orange-700"
                        : "text-gray-700"
                    }`}
                  >
                    {task.title}
                  </span>
                </div>
                <div className="text-xs text-gray-500 ml-6">
                  {task.isOverdue
                    ? `已逾期 ${task.daysOverdue} 天`
                    : task.isToday
                    ? "今天截止"
                    : `截止：${task.dueDate.toLocaleDateString("zh-CN", {
                        month: "short",
                        day: "numeric",
                      })}`}
                </div>
              </div>
              {onCompleteTask && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCompleteTask(task.logId);
                  }}
                  className="flex-shrink-0 text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  完成
                </button>
              )}
            </div>
          ))}

          {/* 进入客户详情页按钮 */}
          <button
            onClick={onViewDetail}
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-lg text-sm font-medium transition"
          >
            进入客户详情页
          </button>
        </div>
      )}
    </div>
  );
};

export default TopClientGroupCard;
