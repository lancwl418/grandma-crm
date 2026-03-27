import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import type { Client, ClientLog } from "@/crm/types";
import { getSampleClientsWithDemoTasks } from "@/crm/constants";
import {
  getOverdueTasks,
  getTodayDueTasks,
  type FlatTask,
} from "@/crm/utils/dashboardTasks";
import AssistantAvatar from "@/crm/components/AssistantAvatar";
import RadialActionMenu, { type ActionKey } from "@/crm/components/RadialActionMenu";
import AddClientPopup from "@/crm/components/AddClientPopup";
import AddTaskModal from "@/crm/components/AddTaskModal";
import BriefingCard from "@/crm/components/BriefingCard";
import ClientDetail from "@/crm/components/ClientDetail";
import ClientSearchOverlay from "@/crm/components/ClientSearchOverlay";
import ChatPanel from "@/crm/components/ChatPanel";
import type { SideEffect } from "@/crm/utils/chatEngine";
import { X } from "lucide-react";
import { runTool, searchClientOnServer } from "@/crm/ai/toolClient";
import { supabase } from "@/lib/supabase";

const AssistantDashboard: React.FC = () => {
  const navigate = useNavigate();

  // ── Auth: get current user ID ──────────────────────────────
  const [userId, setUserId] = useState<string | undefined>();
  const authChecked = useRef(false);
  useEffect(() => {
    if (authChecked.current) return;
    authChecked.current = true;
    supabase?.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });
  }, []);

  // ── State (mirrors Dashboard pattern) ──────────────────────
  const [clients, setClients] = useState<Client[]>(getSampleClientsWithDemoTasks());
  const [menuOpen, setMenuOpen] = useState(false);

  // Modal visibility
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddTask, setShowAddTask] = useState(false);
  const [showTodayView, setShowTodayView] = useState(false);
  const [showClientSearch, setShowClientSearch] = useState(false);

  // Client detail drill-down
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [taskFormClient, setTaskFormClient] = useState<Client | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  // ── Derived data ───────────────────────────────────────────
  const overdueTasks = useMemo(() => getOverdueTasks(clients), [clients]);
  const todayTasks = useMemo(() => getTodayDueTasks(clients), [clients]);
  const briefingTasks = useMemo(
    () => [...overdueTasks, ...todayTasks].slice(0, 3),
    [overdueTasks, todayTasks]
  );
  const totalTaskCount = overdueTasks.length + todayTasks.length;

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  // ── Handlers (reused from Dashboard.tsx) ───────────────────
  const handleCompleteTask = useCallback((logId: string) => {
    setClients((prev) =>
      prev.map((client) => {
        const updatedLogs = (client.logs || []).map((log) =>
          log.id === logId ? { ...log, nextAction: undefined, nextActionTodo: undefined } : log
        );
        return { ...client, logs: updatedLogs };
      })
    );
  }, []);

  const handleUpdateClient = useCallback((updated: Client) => {
    setClients((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }, []);

  const handleAddLogFromModal = useCallback((log: ClientLog, targetClient: Client) => {
    setClients((prev) =>
      prev.map((c) =>
        c.id === targetClient.id
          ? { ...c, logs: [...(c.logs || []), log] }
          : c
      )
    );
    const name = targetClient.remarkName || targetClient.name || "客户";
    setToastMessage(`已为「${name}」添加记录`);
  }, []);

  const applyLocalClientUpdate = useCallback((effect: Extract<SideEffect, { type: "UPDATE_CLIENT" }>) => {
    setClients((prev) =>
      prev.map((c) => {
        if (c.id !== effect.clientId) return c;
        const field = effect.field;
        const value = effect.value;
        if (field === "status") return { ...c, status: value };
        if (field === "urgency") {
          const valid = ["high", "medium", "low"];
          if (valid.includes(value)) return { ...c, urgency: value as Client["urgency"] };
          return c;
        }
        if (field === "phone") return { ...c, phone: value };
        if (field === "wechat") return { ...c, wechat: value };
        if (field === "budget") {
          return { ...c, requirements: { ...c.requirements, budgetMax: value } };
        }
        if (field === "tags") {
          const newTags = value.split(/[,，、\s]+/).filter(Boolean);
          return { ...c, tags: [...new Set([...c.tags, ...newTags])] };
        }
        return c;
      })
    );
  }, []);

  const extractDueDateISO = (log: ClientLog): string => {
    const dateText = log.nextAction?.match(/^(\d{4}-\d{2}-\d{2})[：:]/)?.[1];
    return dateText || new Date().toISOString().slice(0, 10);
  };

  const handleAddClient = useCallback((data: any) => {
    const newClient: Client = {
      id: Date.now().toString(),
      name: data.name || "",
      remarkName: data.remarkName || "",
      phone: data.phone || "",
      wechat: data.wechat || "",
      status: data.status || "new",
      urgency: data.urgency || "medium",
      tags: data.tags || [],
      requirements: data.requirements || {},
      logs: [],
    };
    setClients((prev) => [...prev, newClient]);
    setToastMessage(`已添加客户「${newClient.remarkName || newClient.name}」`);
  }, []);

  // ── Side effect handler (from ChatPanel) ──────────────────
  const handleSideEffect = useCallback(async (effect: SideEffect) => {
    switch (effect.type) {
      case "ADD_LOG": {
        handleAddLogFromModal(effect.log, effect.client);
        const taskAction = effect.log.nextActionTodo || effect.log.content || "跟进";
        const dueDateISO = extractDueDateISO(effect.log);
        const result = await runTool("task.create", {
          clientId: effect.client.id,
          action: taskAction,
          dueDateISO,
        });
        if (!result.ok) {
          console.warn("[AI] task.create fallback to local only:", result.error);
        }
        break;
      }
      case "OPEN_CLIENT":
        await runTool("crm.openClient", { clientId: effect.clientId });
        setSelectedClientId(effect.clientId);
        break;
      case "SEARCH_CLIENT": {
        const serverResult = await searchClientOnServer(effect.query);
        if (!serverResult.ok) {
          setToastMessage(`云端搜索失败：${serverResult.error || "请稍后再试"}`);
          break;
        }
        if (serverResult.matches.length === 0) {
          setToastMessage(`云端也没找到「${effect.query}」`);
          break;
        }
        if (serverResult.matches.length === 1) {
          const one = serverResult.matches[0];
          setSelectedClientId(one.id);
          setToastMessage(`云端找到「${one.name}」`);
          break;
        }
        setToastMessage(`云端找到 ${serverResult.matches.length} 位客户，请去客户列表筛选`);
        break;
      }
      case "OPEN_ADD_CLIENT":
        setShowAddClient(true);
        break;
      case "OPEN_ADD_TASK":
        setTaskFormClient(null);
        setShowAddTask(true);
        break;
      case "COMPLETE_TASK":
        handleCompleteTask(effect.logId);
        break;
      case "UPDATE_CLIENT": {
        applyLocalClientUpdate(effect);
        const result = await runTool("crm.updateClient", {
          clientId: effect.clientId,
          field: effect.field,
          value: effect.value,
        });
        if (!result.ok) {
          console.warn("[AI] crm.updateClient fallback to local only:", result.error);
        }
        setToastMessage(`已更新客户信息`);
        break;
      }
    }
  }, [applyLocalClientUpdate, handleAddLogFromModal, handleCompleteTask]);

  // ── Action dispatch ────────────────────────────────────────
  const handleAction = useCallback((key: ActionKey) => {
    setMenuOpen(false);
    switch (key) {
      case "addClient":
        setShowAddClient(true);
        break;
      case "addTask":
        setTaskFormClient(null);
        setShowAddTask(true);
        break;
      case "viewToday":
        setShowTodayView(true);
        break;
      case "searchClient":
        setShowClientSearch(true);
        break;
      case "organizeNotes":
        navigate("/app/clients");
        break;
    }
  }, [navigate]);

  // ── Client detail view (takes over page) ───────────────────
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

  // ── Helper: find client for a task ─────────────────────────
  const clientForTask = (task: FlatTask) =>
    clients.find((c) => c.id === task.clientId);

  return (
    <div
      className="h-full w-full bg-slate-50 flex flex-col items-center justify-center relative overflow-y-auto"
      onClick={() => menuOpen && setMenuOpen(false)}
    >
      {/* Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Greeting */}
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Hi! 今天有 {totalTaskCount} 件事要做
        </h1>
        <p className="text-sm text-gray-400 mt-1">点击助理开始</p>
      </div>

      {/* Avatar + Radial Menu */}
      <div
        className="relative"
        onClick={(e) => e.stopPropagation()}
        style={{ width: 300, height: 300, display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        <RadialActionMenu open={menuOpen} onAction={handleAction} />
        <AssistantAvatar
          onClick={() => setMenuOpen((v) => !v)}
          isActive={menuOpen}
        />
      </div>

      {/* Briefing cards below avatar */}
      {briefingTasks.length > 0 && (
        <div className="w-full max-w-md px-4 space-y-2 mt-4">
          <p className="text-xs text-gray-400 font-medium px-1">待处理</p>
          {briefingTasks.map((task) => {
            const c = clientForTask(task);
            return (
              <BriefingCard
                key={task.id}
                task={task}
                clientPhone={c?.phone}
                clientWechat={c?.wechat}
                onComplete={handleCompleteTask}
                onOpenClient={setSelectedClientId}
              />
            );
          })}
        </div>
      )}

      {/* Chat Panel */}
      <ChatPanel
        clients={clients}
        overdueTasks={overdueTasks}
        todayTasks={todayTasks}
        userId={userId}
        onSideEffect={handleSideEffect}
      />

      {/* ── Modals (reuse existing components) ──────────────── */}

      {/* Add Client */}
      <AddClientPopup
        open={showAddClient}
        onClose={() => setShowAddClient(false)}
        onSubmit={handleAddClient}
      />

      {/* Add Task */}
      {showAddTask && (
        <AddTaskModal
          open={showAddTask}
          onClose={() => setShowAddTask(false)}
          client={taskFormClient}
          clients={clients}
          onAddLog={handleAddLogFromModal}
        />
      )}

      {/* Client Search */}
      {showClientSearch && (
        <ClientSearchOverlay
          clients={clients}
          onSelectClient={(id) => {
            setShowClientSearch(false);
            setSelectedClientId(id);
          }}
          onClose={() => setShowClientSearch(false)}
        />
      )}

      {/* Today View overlay */}
      {showTodayView && (
        <div
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={() => setShowTodayView(false)}
        >
          <div
            className="bg-white rounded-xl w-full max-w-lg shadow-xl max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">今日待办</h2>
              <button
                type="button"
                onClick={() => setShowTodayView(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {[...overdueTasks, ...todayTasks].length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">今天没有待办事项</p>
              ) : (
                [...overdueTasks, ...todayTasks].map((task) => {
                  const c = clientForTask(task);
                  return (
                    <BriefingCard
                      key={task.id}
                      task={task}
                      clientPhone={c?.phone}
                      clientWechat={c?.wechat}
                      onComplete={(logId) => {
                        handleCompleteTask(logId);
                      }}
                      onOpenClient={(id) => {
                        setShowTodayView(false);
                        setSelectedClientId(id);
                      }}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssistantDashboard;
