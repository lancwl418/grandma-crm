import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle2,
  ChevronRight,
  Phone,
  MessageCircle,
  CalendarPlus,
  Clock,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { Client, ClientLog } from "@/types";
import * as Clipboard from "expo-clipboard";

interface FlatTask {
  id: string;
  clientId: string;
  clientName: string;
  logId: string;
  title: string;
  dueDate: Date;
}

function parseTasks(clients: Client[]): {
  overdue: FlatTask[];
  today: FlatTask[];
  week: FlatTask[];
} {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + (7 - weekEnd.getDay()));

  const overdue: FlatTask[] = [];
  const today: FlatTask[] = [];
  const week: FlatTask[] = [];

  for (const client of clients) {
    for (const log of client.logs || []) {
      if (!log.nextAction) continue;
      const match = log.nextAction.match(
        /(\d{1,2})\/(\d{1,2})|(\d{4})-(\d{2})-(\d{2})/
      );
      if (!match) continue;

      let dueDate: Date;
      if (match[3]) {
        dueDate = new Date(
          parseInt(match[3]),
          parseInt(match[4]) - 1,
          parseInt(match[5])
        );
      } else {
        dueDate = new Date(
          now.getFullYear(),
          parseInt(match[1]) - 1,
          parseInt(match[2])
        );
      }

      const title =
        log.nextActionTodo ||
        log.nextAction.split(/[：:]/)[1]?.trim() ||
        log.nextAction;
      const task: FlatTask = {
        id: `${log.id}-task`,
        clientId: client.id,
        clientName: client.remarkName || client.name || "未命名",
        logId: log.id,
        title,
        dueDate,
      };

      const dueDateStr = dueDate.toISOString().slice(0, 10);
      if (dueDateStr < todayStr) {
        overdue.push(task);
      } else if (dueDateStr === todayStr) {
        today.push(task);
      } else if (dueDate <= weekEnd) {
        week.push(task);
      }
    }
  }

  return { overdue, today, week };
}

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setLoading(false);
        return;
      }
      const { data: clientRows } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (!clientRows) {
        setLoading(false);
        return;
      }

      const clientIds = clientRows.map((c: any) => c.id);
      const { data: logRows } = await supabase
        .from("client_logs")
        .select("*")
        .in("client_id", clientIds)
        .order("date", { ascending: true });

      const logsByClient = new Map<string, ClientLog[]>();
      for (const log of logRows || []) {
        const list = logsByClient.get(log.client_id) || [];
        list.push({
          id: log.id,
          date: log.date,
          content: log.content,
          images: log.images,
          nextAction: log.next_action,
          nextActionTodo: log.next_action_todo,
        });
        logsByClient.set(log.client_id, list);
      }

      const parsed: Client[] = clientRows.map((c: any) => ({
        id: c.id,
        remarkName: c.remark_name || "",
        name: c.name || "",
        phone: c.phone || "",
        wechat: c.wechat || "",
        birthday: c.birthday || "",
        status: c.status || "新客户",
        urgency: c.urgency || "medium",
        tags: c.tags || [],
        requirements: c.requirements || {},
        logs: logsByClient.get(c.id) || [],
      }));

      setClients(parsed);
    } catch (err) {
      console.error("loadClients error:", err);
    } finally {
      setLoading(false);
    }
  };

  const { overdue, today, week } = useMemo(
    () => parseTasks(clients),
    [clients]
  );

  const handleComplete = useCallback(
    async (logId: string) => {
      setClients((prev) =>
        prev.map((c) => ({
          ...c,
          logs: c.logs.map((l) =>
            l.id === logId
              ? { ...l, nextAction: undefined, nextActionTodo: undefined }
              : l
          ),
        }))
      );
      if (supabase) {
        await supabase
          .from("client_logs")
          .update({ next_action: null, next_action_todo: null })
          .eq("id", logId);
      }
    },
    []
  );

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleCopyWechat = async (wechat: string) => {
    if (Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(wechat);
    }
    Alert.alert("已复制", `微信号 ${wechat} 已复制到剪贴板`);
  };

  const todayCount = overdue.length + today.length;

  if (loading) {
    return (
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.center}>
          <ActivityIndicator size="large" color="#2563eb" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        <Text style={s.pageTitle}>今日工作台</Text>

        {/* Briefing Card */}
        <View style={s.card}>
          <View style={s.cardHeader}>
            <Text style={s.cardTitle}>
              今日简报
              {todayCount > 0 && (
                <Text style={s.cardCount}> {todayCount} 件事</Text>
              )}
            </Text>
            <View style={s.cardHeaderRight}>
              {overdue.length > 0 && (
                <Text style={s.overdueCount}>
                  {overdue.length} 逾期
                </Text>
              )}
              <Text style={s.weekCount}>{week.length} 本周</Text>
            </View>
          </View>
          {todayCount === 0 ? (
            <View style={s.emptyBox}>
              <Text style={s.emptyText}>今日无待办，好好休息</Text>
            </View>
          ) : (
            <View style={s.taskList}>
              {[...overdue, ...today].map((task) => {
                const client = clients.find(
                  (c) => c.id === task.clientId
                );
                return (
                  <TaskCard
                    key={task.id}
                    task={task}
                    isOverdue={overdue.includes(task)}
                    clientPhone={client?.phone}
                    clientWechat={client?.wechat}
                    onComplete={handleComplete}
                    onCall={handleCall}
                    onCopyWechat={handleCopyWechat}
                  />
                );
              })}
            </View>
          )}
        </View>

        {/* Overdue Section */}
        {overdue.length > 0 && (
          <View style={s.section}>
            <Text style={s.sectionTitle}>逾期（先处理）</Text>
            {overdue.map((task) => {
              const client = clients.find(
                (c) => c.id === task.clientId
              );
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue
                  clientPhone={client?.phone}
                  clientWechat={client?.wechat}
                  onComplete={handleComplete}
                  onCall={handleCall}
                  onCopyWechat={handleCopyWechat}
                  showActions
                />
              );
            })}
          </View>
        )}

        {/* Today Tasks */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>今日截止</Text>
          {today.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>今日暂无截止任务</Text>
            </View>
          ) : (
            today.map((task) => {
              const client = clients.find(
                (c) => c.id === task.clientId
              );
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  clientPhone={client?.phone}
                  clientWechat={client?.wechat}
                  onComplete={handleComplete}
                  onCall={handleCall}
                  onCopyWechat={handleCopyWechat}
                  showActions
                />
              );
            })
          )}
        </View>

        {/* Week Tasks */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>本周推进</Text>
          {week.length === 0 ? (
            <View style={s.emptyCard}>
              <Text style={s.emptyText}>本周暂无截止任务</Text>
            </View>
          ) : (
            week.map((task) => {
              const client = clients.find(
                (c) => c.id === task.clientId
              );
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  isOverdue={false}
                  clientPhone={client?.phone}
                  clientWechat={client?.wechat}
                  onComplete={handleComplete}
                  onCall={handleCall}
                  onCopyWechat={handleCopyWechat}
                  showActions
                />
              );
            })
          )}
        </View>

        {/* Top Clients */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>优质客人</Text>
          {clients
            .sort((a, b) => {
              const order = { high: 3, medium: 2, low: 1 };
              return order[b.urgency] - order[a.urgency];
            })
            .slice(0, 3)
            .map((client) => (
              <View key={client.id} style={s.clientCard}>
                <View style={s.clientAvatar}>
                  <Text style={s.clientAvatarText}>
                    {(client.remarkName || client.name || "?")[0]}
                  </Text>
                </View>
                <View style={s.clientInfo}>
                  <Text style={s.clientName}>
                    {client.remarkName || client.name}
                  </Text>
                  <Text style={s.clientStatus}>{client.status}</Text>
                </View>
                <View
                  style={[
                    s.urgencyDot,
                    {
                      backgroundColor:
                        client.urgency === "high"
                          ? "#ef4444"
                          : client.urgency === "medium"
                          ? "#f59e0b"
                          : "#22c55e",
                    },
                  ]}
                />
              </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function TaskCard({
  task,
  isOverdue,
  clientPhone,
  clientWechat,
  onComplete,
  onCall,
  onCopyWechat,
  showActions,
}: {
  task: FlatTask;
  isOverdue: boolean;
  clientPhone?: string;
  clientWechat?: string;
  onComplete: (logId: string) => void;
  onCall: (phone: string) => void;
  onCopyWechat: (wechat: string) => void;
  showActions?: boolean;
}) {
  const isPhone = /📞|电话/.test(task.title);
  const isWechat = /💬|微信/.test(task.title);

  return (
    <View style={s.taskCard}>
      <View style={s.taskTop}>
        <View style={s.taskTags}>
          <View
            style={[
              s.tag,
              {
                backgroundColor: isOverdue ? "#fff7ed" : "#eff6ff",
              },
            ]}
          >
            <Text
              style={[
                s.tagText,
                { color: isOverdue ? "#c2410c" : "#2563eb" },
              ]}
            >
              {isOverdue ? "逾期" : "今日"}
            </Text>
          </View>
          <Text style={s.taskClientName}>{task.clientName}</Text>
        </View>
        <Text style={s.taskTitle}>{task.title}</Text>
      </View>
      {showActions && (
        <View style={s.taskActions}>
          <TouchableOpacity
            style={s.taskAction}
            onPress={() => onComplete(task.logId)}
          >
            <CheckCircle2 size={16} color="#16a34a" />
            <Text style={[s.taskActionText, { color: "#16a34a" }]}>
              完成
            </Text>
          </TouchableOpacity>
          {isPhone && clientPhone && (
            <TouchableOpacity
              style={s.taskAction}
              onPress={() => onCall(clientPhone)}
            >
              <Phone size={16} color="#2563eb" />
              <Text style={[s.taskActionText, { color: "#2563eb" }]}>
                拨号
              </Text>
            </TouchableOpacity>
          )}
          {isWechat && clientWechat && (
            <TouchableOpacity
              style={s.taskAction}
              onPress={() => onCopyWechat(clientWechat)}
            >
              <MessageCircle size={16} color="#16a34a" />
              <Text style={[s.taskActionText, { color: "#16a34a" }]}>
                微信
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    marginBottom: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#374151" },
  cardCount: { fontSize: 12, fontWeight: "400", color: "#9ca3af" },
  cardHeaderRight: { flexDirection: "row", gap: 10 },
  overdueCount: { fontSize: 12, color: "#ef4444", fontWeight: "500" },
  weekCount: { fontSize: 12, color: "#9ca3af" },
  emptyBox: { paddingVertical: 32, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  taskList: { padding: 8, gap: 6 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1f2937",
    marginBottom: 10,
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  taskCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
    marginBottom: 8,
  },
  taskTop: { paddingHorizontal: 14, paddingVertical: 12 },
  taskTags: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: { fontSize: 10, fontWeight: "500" },
  taskClientName: { fontSize: 12, color: "#9ca3af" },
  taskTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
    lineHeight: 20,
  },
  taskActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#f9fafb",
  },
  taskAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    borderRightWidth: 1,
    borderRightColor: "#f1f5f9",
  },
  taskActionText: { fontSize: 12, fontWeight: "500" },
  clientCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    marginBottom: 8,
  },
  clientAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  clientAvatarText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2563eb",
  },
  clientInfo: { flex: 1, marginLeft: 12 },
  clientName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  clientStatus: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
});
