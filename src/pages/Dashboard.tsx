import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronRight, AlertCircle, Calendar, Users, Eye, Clock, CalendarPlus, Phone, MessageCircle, Plus, Mic, UserPlus } from "lucide-react";
import type { Client, ClientLog } from "@/crm/types";
import { getSampleClientsWithDemoTasks } from "@/crm/constants";
import { fetchClients, addClientLog as addClientLogDB, updateClientLog as updateClientLogDB } from "@/lib/clientService";
import {
  getOverdueTasks,
  getTodayDueTasks,
  getMomentumTasks,
  formatDateForNextAction,
  type FlatTask,
} from "@/crm/utils/dashboardTasks";
import FocusClientCard from "@/crm/components/FocusClientCard";
import BriefingCard from "@/crm/components/BriefingCard";
import ClientDetail from "@/crm/components/ClientDetail";
import AddTaskModal from "@/crm/components/AddTaskModal";
import VoiceTaskFlow from "@/crm/components/VoiceTaskFlow";
import { requestNotificationPermission, sendTaskReminders, cleanupOldNotifications } from "@/crm/utils/notifications";
import FloatingActionButton from "@/crm/components/FloatingActionButton";
import AddClientPopup from "@/crm/components/AddClientPopup";
import { createClient as createClientDB } from "@/lib/clientService";

function isPhoneTask(title: string): boolean {
  return /📞|电话/.test(title);
}
function isWechatTask(title: string): boolean {
  return /💬|微信/.test(title);
}

/** 按客户分组，保持原列表顺序（按首次出现的客户顺序） */
function groupTasksByClient(tasks: FlatTask[]): { clientId: string; clientName: string; tasks: FlatTask[] }[] {
  const map = new Map<string, FlatTask[]>();
  const order: string[] = [];
  for (const t of tasks) {
    if (!map.has(t.clientId)) {
      map.set(t.clientId, []);
      order.push(t.clientId);
    }
    map.get(t.clientId)!.push(t);
  }
  return order.map((clientId) => {
    const list = map.get(clientId)!;
    return { clientId, clientName: list[0].clientName, tasks: list };
  });
}

function TaskRow({
  task,
  statusTag,
  clientPhone,
  clientWechat,
  onComplete,
  onSnooze,
  onPostpone,
  onOpenClient,
  onQuickRecord,
  showActionButtons,
  grouped,
}: {
  task: FlatTask;
  statusTag: "overdue" | "today" | "momentum";
  clientPhone?: string;
  clientWechat?: string;
  onComplete: (logId: string) => void;
  onSnooze?: (taskId: string) => void;
  onPostpone?: (clientId: string, logId: string, newDate: Date) => void;
  onOpenClient: (clientId: string) => void;
  onQuickRecord?: (clientId: string) => void;
  showActionButtons?: boolean;
  /** 是否在客户分组内，为 true 时不重复显示客户名 */
  grouped?: boolean;
}) {
  const [postponeExpanded, setPostponeExpanded] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const isPhone = isPhoneTask(task.title);
  const isWechat = isWechatTask(task.title);

  const handleCopyWechat = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (clientWechat) {
      navigator.clipboard.writeText(clientWechat);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  };

  const pickPostpone = (daysFromToday: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromToday);
    d.setHours(0, 0, 0, 0);
    onPostpone?.(task.clientId, task.logId, d);
    setPostponeExpanded(false);
  };

  return (
    <div className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg border border-gray-100 bg-white hover:bg-gray-50/50 transition">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <span
          className={`
            flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium
            ${statusTag === "overdue" ? "bg-orange-100 text-orange-700" : ""}
            ${statusTag === "today" ? "bg-blue-100 text-blue-700" : ""}
            ${statusTag === "momentum" ? "bg-gray-100 text-gray-600" : ""}
          `}
        >
          {statusTag === "overdue" ? "逾期" : statusTag === "today" ? "今日" : "本周"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{task.title}</p>
          <div className="flex items-center gap-2 flex-wrap">
            {!grouped && <p className="text-xs text-gray-500">{task.clientName}</p>}
            {isPhone && clientPhone && (
              <a
                href={`tel:${clientPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5"
              >
                <Phone className="h-3 w-3" />
                {clientPhone}
              </a>
            )}
            {isWechat && clientWechat && (
              <button
                type="button"
                onClick={handleCopyWechat}
                className="text-xs text-green-600 hover:text-green-700 flex items-center gap-0.5"
              >
                <MessageCircle className="h-3 w-3" />
                {copyFeedback ? "已复制" : "复制微信号"}
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onComplete(task.logId);
          }}
          className="text-xs text-green-600 hover:text-green-700 flex items-center gap-1"
        >
          <CheckCircle2 className="h-4 w-4" />
          完成
        </button>
        {showActionButtons && onSnooze && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSnooze(task.id);
            }}
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"
          >
            <Clock className="h-4 w-4" />
            稍后
          </button>
        )}
        {showActionButtons && onPostpone && (
          <div className="relative flex items-center gap-1">
            {postponeExpanded ? (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickPostpone(1);
                  }}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  明天
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickPostpone(2);
                  }}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  后天
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    pickPostpone(7);
                  }}
                  className="text-xs px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                >
                  下周
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPostponeExpanded(true);
                }}
                className="text-xs text-gray-600 hover:text-gray-700 flex items-center gap-1"
              >
                <CalendarPlus className="h-4 w-4" />
                延期
              </button>
            )}
          </div>
        )}
        {onQuickRecord && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onQuickRecord(task.clientId);
            }}
            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded"
          >
            去记录
          </button>
        )}
        <button
          onClick={() => onOpenClient(task.clientId)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
        >
          打开客户
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function SectionTitle({
  title,
  onViewClick,
  rightAction,
}: {
  title: string;
  onViewClick?: () => void;
  rightAction?: { label: string; onClick: () => void };
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-2">
        {rightAction && (
          <button
            type="button"
            onClick={rightAction.onClick}
            className="text-sm text-gray-600 hover:text-gray-700"
          >
            {rightAction.label}
          </button>
        )}
        {onViewClick && (
          <button
            type="button"
            onClick={onViewClick}
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            <Eye className="h-4 w-4" />
            查看
          </button>
        )}
      </div>
    </div>
  );
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    fetchClients().then((data) => {
      setClients(data.length > 0 ? data : getSampleClientsWithDemoTasks());
    });
  }, []);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskFormClient, setTaskFormClient] = useState<Client | null>(null);
  const [snoozedTaskIds, setSnoozedTaskIds] = useState<Set<string>>(() => new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showVoiceFlow, setShowVoiceFlow] = useState(false);
  const [showAddClientPopup, setShowAddClientPopup] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  const todayTasksRef = useRef<HTMLElement>(null);
  const weekPlanRef = useRef<HTMLElement>(null);
  const premiumClientsRef = useRef<HTMLElement>(null);

  const scrollToSection = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const overdueTasksRaw = useMemo(() => getOverdueTasks(clients), [clients]);
  const todayTasksRaw = useMemo(() => getTodayDueTasks(clients), [clients]);
  const momentumTasksRaw = useMemo(() => getMomentumTasks(clients), [clients]);

  const overdueTasks = useMemo(
    () => overdueTasksRaw.filter((t) => !snoozedTaskIds.has(t.id)),
    [overdueTasksRaw, snoozedTaskIds]
  );
  const todayTasks = useMemo(
    () => todayTasksRaw.filter((t) => !snoozedTaskIds.has(t.id)),
    [todayTasksRaw, snoozedTaskIds]
  );
  const momentumTasks = useMemo(
    () => momentumTasksRaw.filter((t) => !snoozedTaskIds.has(t.id)),
    [momentumTasksRaw, snoozedTaskIds]
  );

  // 浏览器通知
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    const actionTasks = [...overdueTasks, ...todayTasks];
    sendTaskReminders(actionTasks);
    cleanupOldNotifications(actionTasks);
  }, [overdueTasks, todayTasks]);

  const todayTasksCount = overdueTasks.length + todayTasks.length;

  const top3Clients = useMemo(() => {
    return [...clients]
      .sort((a, b) => {
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      })
      .slice(0, 3);
  }, [clients]);

  const handleCompleteTask = (logId: string) => {
    setClients((prev) =>
      prev.map((client) => {
        const updatedLogs = (client.logs || []).map((log) =>
          log.id === logId ? { ...log, nextAction: undefined, nextActionTodo: undefined } : log
        );
        return { ...client, logs: updatedLogs };
      })
    );
    // 持久化
    updateClientLogDB(logId, { nextAction: undefined, nextActionTodo: undefined });
  };

  const handleSnooze = useCallback((taskId: string) => {
    setSnoozedTaskIds((prev) => new Set(prev).add(taskId));
    setToastMessage("已在 1 小时后提醒");
  }, []);

  const handlePostpone = useCallback(
    (clientId: string, logId: string, newDate: Date) => {
      const dateStr = formatDateForNextAction(newDate);
      let newNextAction = "";
      let newTitle = "";
      setClients((prev) =>
        prev.map((client) => {
          if (client.id !== clientId) return client;
          const updatedLogs = (client.logs || []).map((log) => {
            if (log.id !== logId || !log.nextAction) return log;
            const title = log.nextActionTodo || log.nextAction.split(/[：:]/)[1]?.trim() || log.nextAction;
            newNextAction = `${dateStr}：${title}`;
            newTitle = title;
            return { ...log, nextAction: newNextAction, nextActionTodo: title };
          });
          return { ...client, logs: updatedLogs };
        })
      );
      // 持久化
      if (newNextAction) {
        updateClientLogDB(logId, { nextAction: newNextAction, nextActionTodo: newTitle });
      }
    },
    []
  );

  const handleUpdateClient = (updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  const handleQuickRecord = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setTaskFormClient(client ?? null);
    setShowAddTaskModal(true);
  };

  const handleAddClient = async (data: any) => {
    const mergedTags: string[] = Array.from(
      new Set([...(data.tags || []), ...(data.requirements?.tags || [])])
    );
    const clientData: Partial<Client> = {
      remarkName: data.remarkName || "",
      name: data.name || "",
      phone: data.phone || "",
      wechat: data.wechat || "",
      birthday: data.birthday || "",
      status: data.status || "新客户",
      urgency: data.urgency || "medium",
      tags: mergedTags,
      requirements: {
        budgetMin: data.requirements?.budgetMin || "",
        budgetMax: data.requirements?.budgetMax || "",
        notes: data.requirements?.notes || "",
        areas: data.requirements?.areas || [],
        tags: mergedTags,
      },
    };
    const saved = await createClientDB(clientData);
    const newClient: Client = saved ?? {
      ...clientData,
      id: Date.now().toString(),
      remarkName: clientData.remarkName!,
      status: clientData.status!,
      urgency: clientData.urgency!,
      tags: clientData.tags!,
      requirements: clientData.requirements!,
      logs: [],
    } as Client;
    setClients((prev) => [newClient, ...prev]);
    setShowAddClientPopup(false);
    setToastMessage(`已添加客户「${newClient.remarkName || newClient.name}」`);
  };

  const handleAddLogFromModal = async (log: ClientLog, targetClient: Client) => {
    // 先乐观更新 UI
    setClients((prev) =>
      prev.map((c) =>
        c.id === targetClient.id
          ? { ...c, logs: [...(c.logs || []), log] }
          : c
      )
    );
    const name = targetClient.remarkName || targetClient.name || "客户";
    setToastMessage(`已为「${name}」添加记录`);

    // 持久化到 Supabase
    const saved = await addClientLogDB(targetClient.id, log);
    if (saved) {
      // 用 Supabase 返回的真实 ID 替换临时 ID
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== targetClient.id) return c;
          const updatedLogs = c.logs.map((l) =>
            l.id === log.id ? { ...l, id: saved.id } : l
          );
          return { ...c, logs: updatedLogs };
        })
      );
    }
  };

  if (selectedClient) {
    return (
      <ClientDetail
        client={selectedClient}
        onBack={() => setSelectedClientId(null)}
        onUpdate={handleUpdateClient}
        availableTags={Array.from(new Set(clients.flatMap((c) => c.tags || [])))}
        availableAreas={Array.from(new Set(clients.flatMap((c) => c.requirements?.areas || [])))}
      />
    );
  }

  return (
    <div className="h-full w-full bg-slate-50 p-4 md:p-6 overflow-y-auto relative">
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">今日工作台</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddClientPopup(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition shadow-sm"
            >
              <UserPlus className="h-4 w-4" />
              加客户
            </button>
            <button
              type="button"
              onClick={() => setShowVoiceFlow(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition shadow-sm"
            >
              <Mic className="h-4 w-4" />
              语音建任务
            </button>
            <button
              type="button"
              onClick={() => {
                setTaskFormClient(null);
                setShowAddTaskModal(true);
              }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
            >
              <Plus className="h-4 w-4" />
              新建任务
            </button>
          </div>
        </div>

        {/* 今日简报 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              今日简报
              {todayTasksCount > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">{todayTasksCount} 件事</span>
              )}
            </h2>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              {overdueTasks.length > 0 && (
                <span className="text-red-500 font-medium">{overdueTasks.length} 逾期</span>
              )}
              <span>{momentumTasks.length} 本周</span>
            </div>
          </div>
          {todayTasksCount === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-gray-400">
              今日无待办，好好休息
            </div>
          ) : (
            <div className="p-2 space-y-1.5">
              {[...overdueTasks, ...todayTasks].map((task) => {
                const client = clients.find((c) => c.id === task.clientId);
                return (
                  <BriefingCard
                    key={task.id}
                    task={task}
                    clientPhone={client?.phone}
                    clientWechat={client?.wechat}
                    onComplete={handleCompleteTask}
                    onOpenClient={setSelectedClientId}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* 区块 1：今日待办（内部：逾期 + 今日截止） */}
        <section id="todayTasks" ref={todayTasksRef}>
          <SectionTitle
            title="今日待办"
            onViewClick={() => scrollToSection(todayTasksRef)}
          />
          {/* A) 逾期（先处理） */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">逾期（先处理）</h3>
            <div className="space-y-4">
              {overdueTasks.length === 0 ? (
                <p className="text-sm text-gray-500 py-3 px-4 bg-white rounded-xl border border-gray-100">
                  暂无逾期任务
                </p>
              ) : (
                groupTasksByClient(overdueTasks).map((group) => {
                  const client = clients.find((c) => c.id === group.clientId);
                  return (
                    <div key={group.clientId} className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(group.clientId)}
                        className="w-full flex items-center justify-between gap-2 py-2.5 px-4 bg-white border-b border-gray-100 text-left hover:bg-gray-50 transition"
                      >
                        <span className="text-sm font-semibold text-gray-800">{group.clientName}</span>
                        <span className="text-xs text-gray-500">{group.tasks.length} 项</span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                      <div className="p-2 space-y-2">
                        {group.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            statusTag="overdue"
                            clientPhone={client?.phone}
                            clientWechat={client?.wechat}
                            onComplete={handleCompleteTask}
                            onSnooze={handleSnooze}
                            onPostpone={handlePostpone}
                            onOpenClient={setSelectedClientId}
                            onQuickRecord={handleQuickRecord}
                            showActionButtons
                            grouped
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          {/* B) 今日截止（今天必须完成） */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">今日截止（今天必须完成）</h3>
            <div className="space-y-4">
              {todayTasks.length === 0 ? (
                <p className="text-sm text-gray-500 py-3 px-4 bg-white rounded-xl border border-gray-100">
                  今日暂无截止任务
                </p>
              ) : (
                groupTasksByClient(todayTasks).map((group) => {
                  const client = clients.find((c) => c.id === group.clientId);
                  return (
                    <div key={group.clientId} className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setSelectedClientId(group.clientId)}
                        className="w-full flex items-center justify-between gap-2 py-2.5 px-4 bg-white border-b border-gray-100 text-left hover:bg-gray-50 transition"
                      >
                        <span className="text-sm font-semibold text-gray-800">{group.clientName}</span>
                        <span className="text-xs text-gray-500">{group.tasks.length} 项</span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </button>
                      <div className="p-2 space-y-2">
                        {group.tasks.map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            statusTag="today"
                            clientPhone={client?.phone}
                            clientWechat={client?.wechat}
                            onComplete={handleCompleteTask}
                            onSnooze={handleSnooze}
                            onPostpone={handlePostpone}
                            onOpenClient={setSelectedClientId}
                            onQuickRecord={handleQuickRecord}
                            showActionButtons
                            grouped
                          />
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* 区块 2：本周推进（任务列表） */}
        <section id="weekPlan" ref={weekPlanRef}>
          <SectionTitle
            title="本周推进"
            onViewClick={() => scrollToSection(weekPlanRef)}
          />
          <div className="space-y-4">
            {momentumTasks.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 px-4 bg-white rounded-xl border border-gray-100">
                本周暂无截止任务
              </p>
            ) : (
              groupTasksByClient(momentumTasks).map((group) => {
                const client = clients.find((c) => c.id === group.clientId);
                return (
                  <div key={group.clientId} className="rounded-xl border border-gray-100 bg-gray-50/50 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setSelectedClientId(group.clientId)}
                      className="w-full flex items-center justify-between gap-2 py-2.5 px-4 bg-white border-b border-gray-100 text-left hover:bg-gray-50 transition"
                    >
                      <span className="text-sm font-semibold text-gray-800">{group.clientName}</span>
                      <span className="text-xs text-gray-500">{group.tasks.length} 项</span>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </button>
                    <div className="p-2 space-y-2">
                      {group.tasks.map((task) => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          statusTag="momentum"
                          clientPhone={client?.phone}
                          clientWechat={client?.wechat}
                          onComplete={handleCompleteTask}
                          onSnooze={handleSnooze}
                          onPostpone={handlePostpone}
                          onOpenClient={setSelectedClientId}
                          onQuickRecord={handleQuickRecord}
                          showActionButtons
                          grouped
                        />
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* 区块 3：优质客人（客户卡片） */}
        <section id="premiumClients" ref={premiumClientsRef}>
          <SectionTitle
            title="优质客人"
            onViewClick={() => scrollToSection(premiumClientsRef)}
            rightAction={{ label: "去客户列表", onClick: () => navigate("/app/clients") }}
          />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-1">
            {top3Clients.map((client) => (
              <FocusClientCard
                key={client.id}
                client={client}
                onViewDetail={() => setSelectedClientId(client.id)}
              />
            ))}
          </div>
        </section>
      </div>

      <AddTaskModal
        open={showAddTaskModal}
        onClose={() => {
          setShowAddTaskModal(false);
          setTaskFormClient(null);
        }}
        client={taskFormClient}
        clients={clients}
        onAddLog={handleAddLogFromModal}
      />

      <VoiceTaskFlow
        open={showVoiceFlow}
        onClose={() => setShowVoiceFlow(false)}
        clients={clients}
        onAddLog={handleAddLogFromModal}
      />

      <AddClientPopup
        open={showAddClientPopup}
        onClose={() => setShowAddClientPopup(false)}
        onSubmit={handleAddClient}
      />

      <FloatingActionButton
        onNewTask={() => {
          setTaskFormClient(null);
          setShowAddTaskModal(true);
        }}
        onVoiceTask={() => setShowVoiceFlow(true)}
      />
    </div>
  );
};

export default Dashboard;
