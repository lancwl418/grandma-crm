import React, { useState, useMemo } from "react";
import { AlertCircle, Calendar, Users } from "lucide-react";
import NextActionsModule from "@/crm/components/NextActionsModule";
import { selectNextActions } from "@/crm/utils/selectNextActions";
import type { Client, ClientLog } from "@/crm/types";
import { SAMPLE_CLIENTS } from "@/crm/constants";
import TopClientGroupCard from "@/crm/components/TopClientGroupCard";
import ClientDetail from "@/crm/components/ClientDetail";
import AddTaskModal from "@/crm/components/AddTaskModal";

const Dashboard: React.FC = () => {
  const [clients, setClients] = useState<Client[]>(SAMPLE_CLIENTS);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [showAddTaskModal, setShowAddTaskModal] = useState(false);
  const [taskFormClient, setTaskFormClient] = useState<Client | null>(null);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  // 生成行动建议
  const nextActions = useMemo(() => selectNextActions(clients), [clients]);

  // 计算统计数据（示例逻辑）
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let overdueCount = 0;
    let todayCount = 0;
    
    clients.forEach((client) => {
      if (!client.logs) return;
      client.logs.forEach((log) => {
        if (!log.nextAction) return;
        const dateMatch = log.nextAction.match(/^(\d{4}-\d{2}-\d{2})[：:]/);
        if (dateMatch) {
          const dueDate = new Date(dateMatch[1]);
          dueDate.setHours(0, 0, 0, 0);
          if (dueDate.getTime() < today.getTime()) {
            overdueCount++;
          } else if (dueDate.getTime() === today.getTime()) {
            todayCount++;
          }
        }
      });
    });
    
    return {
      overdue: overdueCount,
      today: todayCount,
      total: clients.length,
    };
  }, [clients]);

  // Top 3 客户（按任务逾期/预算排序的示例逻辑）
  const top3Clients = useMemo(() => {
    return [...clients]
      .sort((a, b) => {
        // 简单排序：按 urgency 和 status
        const urgencyOrder = { high: 3, medium: 2, low: 1 };
        return urgencyOrder[b.urgency] - urgencyOrder[a.urgency];
      })
      .slice(0, 3);
  }, [clients]);

  // 处理完成任务
  const handleCompleteTask = (taskId: string) => {
    // 找到对应的日志并移除 nextAction
    setClients((prev) =>
      prev.map((client) => {
        const updatedLogs = (client.logs || []).map((log) =>
          log.id === taskId ? { ...log, nextAction: undefined, nextActionTodo: undefined } : log
        );
        return { ...client, logs: updatedLogs };
      })
    );
  };

  // 处理添加记录（打开客户详情页面，用户可以在那里添加记录）
  const handleAddLog = (clientId: string) => {
    setSelectedClientId(clientId);
  };

  // 处理更新客户
  const handleUpdateClient = (updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  };

  // 快速记录（打开 AddTaskModal）
  const handleQuickRecord = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    setTaskFormClient(client ?? null);
    setShowAddTaskModal(true);
  };

  // 从 Modal 添加记录
  const handleAddLogFromModal = (log: ClientLog) => {
    if (!taskFormClient) return;

    setClients((prev) =>
      prev.map((client) =>
        client.id === taskFormClient.id
          ? { ...client, logs: [...(client.logs || []), log] }
          : client
      )
    );
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
    <div className="h-full w-full bg-slate-50 p-4 md:p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* 标题 */}
        <h1 className="text-2xl font-bold text-gray-900">今日工作台</h1>

        {/* 统计卡片 - 移到顶部 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">已逾期</p>
                <p className="text-2xl font-bold text-red-600">{stats.overdue}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">今日待办</p>
                <p className="text-2xl font-bold text-orange-600">{stats.today}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">客户总数</p>
                <p className="text-2xl font-bold text-blue-600">{stats.total}</p>
              </div>
              <Users className="h-8 w-8 text-blue-500" />
            </div>
          </div>
        </div>

        {/* Top 3 客户区域 */}
        <div>
          <h2 className="text-lg font-semibold text-gray-800 mb-4">今日最重要 Top 3</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {top3Clients.map((client) => (
              <TopClientGroupCard
                key={client.id}
                client={client}
                onViewDetail={() => setSelectedClientId(client.id)}
                onCompleteTask={handleCompleteTask}
                onQuickRecord={handleQuickRecord}
              />
            ))}
          </div>
        </div>

        {/* NextActionsModule */}
        <NextActionsModule
          actions={nextActions}
          onOpenClient={(clientId) => setSelectedClientId(clientId)}
          onCompleteTask={handleCompleteTask}
          onAddLog={handleAddLog}
        />

        {/* 其他今日待办（列表） */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">其他今日待办</h2>
          <div className="space-y-2">
            {clients.length === 0 ? (
              <p className="text-sm text-gray-400">暂无待办事项</p>
            ) : (
              <p className="text-sm text-gray-500">待办列表功能待实现</p>
            )}
          </div>
        </div>
      </div>

      {/* AddTaskModal */}
      <AddTaskModal
        open={showAddTaskModal}
        onClose={() => {
          setShowAddTaskModal(false);
          setTaskFormClient(null);
        }}
        client={taskFormClient}
        onAddLog={handleAddLogFromModal}
      />
    </div>
  );
};

export default Dashboard;
