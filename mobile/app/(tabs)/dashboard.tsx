import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CheckCircle2,
  ChevronRight,
  Phone,
  MessageCircle,
  CalendarPlus,
  Clock,
  Plus,
  X,
  ChevronDown,
  Search,
  UserPlus,
  Mic,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { Client, ClientLog } from "@/types";
import * as Clipboard from "expo-clipboard";

// ── Constants (mirrors web) ──

const QUICK_LOG_TEMPLATES = [
  { key: "call_unanswered", label: "📞 电话未接", content: "致电客户无人接听，已通过微信留言告知事宜。" },
  { key: "organize_listings", label: "🔍 整理房源", content: "正在根据客户最新反馈筛选新一轮房源，计划整理好后发送给客户。" },
  { key: "sent_listings", label: "📬 已发房源", content: "已通过微信发送最新房源清单，请客户查看并反馈意向。" },
  { key: "confirmed_viewing", label: "📅 确认约看", content: "已与客户确认看房时间与地点，提醒提前安排好行程。" },
  { key: "viewing_satisfied", label: "✅ 带看满意", content: "本次带看整体满意，客户对其中一两套房源有进一步兴趣。" },
  { key: "viewing_rejected", label: "❌ 带看否决", content: "本次带看整体不合适，已与客户沟通具体原因并调整选房方向。" },
  { key: "still_considering", label: "🤔 还在考虑", content: "客户表示还在综合比较，计划几天后再做下一步跟进。" },
];

const NEXT_ACTION_OPTIONS = [
  { emoji: "📅", label: "安排看房", value: "安排线下看房，确认时间地点。" },
  { emoji: "📩", label: "发送房源", value: "发送新一轮匹配房源给客户。" },
  { emoji: "💰", label: "确认贷款", value: "与客户沟通贷款方案和预算区间。" },
  { emoji: "🔁", label: "跟进反馈", value: "通过微信跟进客户对现有房源的反馈。" },
];

// ── Helpers ──

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

function formatDateForNextAction(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ── Add Task Modal ──

function AddTaskModal({
  visible,
  onClose,
  clients,
  preselectedClient,
  onAddLog,
}: {
  visible: boolean;
  onClose: () => void;
  clients: Client[];
  preselectedClient: Client | null;
  onAddLog: (log: ClientLog, client: Client) => void;
}) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [content, setContent] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextActionContent, setNextActionContent] = useState("");

  const client = preselectedClient || selectedClient;

  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.remarkName && c.remarkName.toLowerCase().includes(q)) ||
      (c.name && c.name?.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const resetAndClose = () => {
    setSelectedClient(null);
    setSearchQuery("");
    setShowClientPicker(false);
    setContent("");
    setNextDate("");
    setNextActionContent("");
    onClose();
  };

  const handleSubmit = () => {
    if (!client) {
      Alert.alert("提示", "请先选择客户");
      return;
    }
    const hasContent = content.trim().length > 0;
    const hasNextAction = nextDate && nextActionContent.trim();
    if (!hasContent && !hasNextAction) {
      Alert.alert("提示", "请输入内容或设定下一步计划");
      return;
    }

    const log: ClientLog = {
      id: createLogId(),
      date: new Date().toISOString(),
      content: content.trim() || (hasNextAction ? `设定任务：${nextActionContent.trim()}` : ""),
      nextAction: hasNextAction ? `${nextDate}：${nextActionContent.trim()}` : undefined,
      nextActionTodo: hasNextAction ? nextActionContent.trim() : undefined,
    };

    onAddLog(log, client);
    resetAndClose();
  };

  // Quick date helpers
  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNextDate(formatDateForNextAction(d));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={ms.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Header */}
          <View style={ms.header}>
            <TouchableOpacity onPress={resetAndClose}>
              <X size={22} color="#6b7280" />
            </TouchableOpacity>
            <Text style={ms.headerTitle}>
              {preselectedClient ? "记一笔" : "新建任务"}
            </Text>
            <TouchableOpacity onPress={handleSubmit}>
              <Text style={ms.headerSave}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={ms.body}>
            {/* Client Picker */}
            {!preselectedClient && (
              <View style={ms.section}>
                <Text style={ms.label}>选择客户</Text>
                {client ? (
                  <View style={ms.selectedClient}>
                    <Text style={ms.selectedClientName}>
                      {client.remarkName || client.name}
                    </Text>
                    <TouchableOpacity onPress={() => setSelectedClient(null)}>
                      <Text style={ms.switchBtn}>切换</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={ms.searchRow}>
                      <Search size={16} color="#9ca3af" />
                      <TextInput
                        style={ms.searchInput}
                        placeholder="搜索姓名、备注或电话..."
                        placeholderTextColor="#d1d5db"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        onFocus={() => setShowClientPicker(true)}
                      />
                    </View>
                    {(showClientPicker || searchQuery) && (
                      <View style={ms.clientList}>
                        {filteredClients.length === 0 ? (
                          <Text style={ms.emptyText}>未找到匹配客户</Text>
                        ) : (
                          filteredClients.slice(0, 8).map((c) => (
                            <TouchableOpacity
                              key={c.id}
                              style={ms.clientRow}
                              onPress={() => {
                                setSelectedClient(c);
                                setShowClientPicker(false);
                                setSearchQuery("");
                              }}
                            >
                              <View>
                                <Text style={ms.clientRowName}>
                                  {c.remarkName || c.name}
                                </Text>
                                {c.name && c.remarkName ? (
                                  <Text style={ms.clientRowSub}>{c.name}</Text>
                                ) : null}
                              </View>
                              <Text style={ms.clientRowStatus}>{c.status}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </View>
                    )}
                  </>
                )}
              </View>
            )}

            {preselectedClient && (
              <View style={ms.section}>
                <Text style={ms.label}>
                  客户：{preselectedClient.remarkName || preselectedClient.name}
                </Text>
              </View>
            )}

            {/* Quick Templates */}
            <View style={ms.section}>
              <Text style={ms.label}>快捷模板</Text>
              <View style={ms.templateRow}>
                {QUICK_LOG_TEMPLATES.map((tpl) => (
                  <TouchableOpacity
                    key={tpl.key}
                    style={[
                      ms.templateBtn,
                      content === tpl.content && ms.templateBtnActive,
                    ]}
                    onPress={() => setContent(tpl.content)}
                  >
                    <Text
                      style={[
                        ms.templateBtnText,
                        content === tpl.content && ms.templateBtnTextActive,
                      ]}
                    >
                      {tpl.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Content */}
            <View style={ms.section}>
              <Text style={ms.label}>跟进内容</Text>
              <TextInput
                style={ms.textarea}
                placeholder="写点什么..."
                placeholderTextColor="#d1d5db"
                multiline
                value={content}
                onChangeText={setContent}
              />
            </View>

            {/* Next Action */}
            <View style={ms.section}>
              <Text style={ms.label}>下一步计划（可选）</Text>
              <View style={ms.dateRow}>
                <TouchableOpacity
                  style={[ms.dateChip, nextDate && ms.dateChipActive]}
                  onPress={() => setQuickDate(0)}
                >
                  <Text style={[ms.dateChipText, nextDate === formatDateForNextAction(new Date()) && ms.dateChipTextActive]}>今天</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={ms.dateChip}
                  onPress={() => setQuickDate(1)}
                >
                  <Text style={ms.dateChipText}>明天</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={ms.dateChip}
                  onPress={() => setQuickDate(3)}
                >
                  <Text style={ms.dateChipText}>3天后</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={ms.dateChip}
                  onPress={() => setQuickDate(7)}
                >
                  <Text style={ms.dateChipText}>下周</Text>
                </TouchableOpacity>
              </View>
              {nextDate ? (
                <Text style={ms.dateDisplay}>截止日期：{nextDate}</Text>
              ) : null}
              <TextInput
                style={ms.nextActionInput}
                placeholder="下一步计划..."
                placeholderTextColor="#d1d5db"
                value={nextActionContent}
                onChangeText={setNextActionContent}
              />
              <View style={ms.templateRow}>
                {NEXT_ACTION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[
                      ms.templateBtn,
                      nextActionContent === opt.value && ms.templateBtnActive,
                    ]}
                    onPress={() => setNextActionContent(opt.value)}
                  >
                    <Text
                      style={[
                        ms.templateBtnText,
                        nextActionContent === opt.value && ms.templateBtnTextActive,
                      ]}
                    >
                      {opt.emoji} {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const ms = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  headerSave: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  body: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  clientList: {
    marginTop: 4,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    maxHeight: 240,
    overflow: "hidden",
  },
  clientRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  clientRowName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  clientRowSub: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  clientRowStatus: { fontSize: 12, color: "#9ca3af" },
  selectedClient: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectedClientName: { fontSize: 14, fontWeight: "600", color: "#1e40af" },
  switchBtn: { fontSize: 13, color: "#2563eb" },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  templateBtnActive: { backgroundColor: "#dbeafe" },
  templateBtnText: { fontSize: 12, color: "#4b5563" },
  templateBtnTextActive: { color: "#1e40af" },
  textarea: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: "#111827",
    minHeight: 100,
    textAlignVertical: "top",
  },
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
  },
  dateChipActive: { backgroundColor: "#dbeafe" },
  dateChipText: { fontSize: 12, color: "#4b5563" },
  dateChipTextActive: { color: "#1e40af" },
  dateDisplay: { fontSize: 12, color: "#2563eb", marginBottom: 8 },
  nextActionInput: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111827",
    marginBottom: 8,
  },
});

// ── Add Client Modal ──

const CLIENT_STATUSES = [
  "新客户", "看房中", "意向强烈", "已下Offer", "已成交", "停滞", "暂缓",
];

function AddClientModal({
  visible,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: any) => void;
}) {
  const [name, setName] = useState("");
  const [remarkName, setRemarkName] = useState("");
  const [phone, setPhone] = useState("");
  const [wechat, setWechat] = useState("");
  const [status, setStatus] = useState("新客户");
  const [urgency, setUrgency] = useState<"high" | "medium" | "low">("medium");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [areaInput, setAreaInput] = useState("");
  const [areas, setAreas] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const resetAndClose = () => {
    setName(""); setRemarkName(""); setPhone(""); setWechat("");
    setStatus("新客户"); setUrgency("medium");
    setBudgetMin(""); setBudgetMax("");
    setAreaInput(""); setAreas([]);
    setTagInput(""); setTags([]);
    onClose();
  };

  const handleSubmit = () => {
    if (!name && !remarkName) {
      Alert.alert("提示", "请至少填写姓名或备注");
      return;
    }
    onSubmit({
      name, remarkName, phone, wechat, status, urgency,
      tags,
      requirements: { budgetMin, budgetMax, areas, tags },
    });
    resetAndClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={cs.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={cs.header}>
            <TouchableOpacity onPress={resetAndClose}>
              <X size={22} color="#6b7280" />
            </TouchableOpacity>
            <Text style={cs.headerTitle}>录入新客户</Text>
            <TouchableOpacity onPress={handleSubmit}>
              <Text style={cs.headerSave}>保存</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={cs.body}>
            {/* Basic Info */}
            <View style={cs.section}>
              <Text style={cs.sectionLabel}>基本信息</Text>
              <View style={cs.fieldCard}>
                <View style={cs.fieldRow}>
                  <Text style={cs.fieldLabel}>姓名</Text>
                  <TextInput style={cs.fieldInput} placeholder="真实姓名" placeholderTextColor="#d1d5db" value={name} onChangeText={setName} />
                </View>
                <View style={cs.fieldRow}>
                  <Text style={cs.fieldLabel}>备注</Text>
                  <TextInput style={cs.fieldInput} placeholder="备注/小名" placeholderTextColor="#d1d5db" value={remarkName} onChangeText={setRemarkName} />
                </View>
                <View style={cs.fieldRow}>
                  <Text style={cs.fieldLabel}>手机</Text>
                  <TextInput style={cs.fieldInput} placeholder="手机号" placeholderTextColor="#d1d5db" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
                </View>
                <View style={cs.fieldRow}>
                  <Text style={cs.fieldLabel}>微信</Text>
                  <TextInput style={cs.fieldInput} placeholder="微信号" placeholderTextColor="#d1d5db" value={wechat} onChangeText={setWechat} />
                </View>
              </View>
            </View>

            {/* Status */}
            <View style={cs.section}>
              <Text style={cs.sectionLabel}>客户状态</Text>
              <View style={cs.chipRow}>
                {CLIENT_STATUSES.map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[cs.chip, status === s && cs.chipActive]}
                    onPress={() => setStatus(s)}
                  >
                    <Text style={[cs.chipText, status === s && cs.chipTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Urgency */}
            <View style={cs.section}>
              <Text style={cs.sectionLabel}>紧急程度</Text>
              <View style={cs.chipRow}>
                {([
                  { value: "high" as const, label: "高", color: "#ef4444" },
                  { value: "medium" as const, label: "中", color: "#f59e0b" },
                  { value: "low" as const, label: "低", color: "#22c55e" },
                ]).map((u) => (
                  <TouchableOpacity
                    key={u.value}
                    style={[cs.chip, urgency === u.value && { backgroundColor: u.color + "20", borderColor: u.color }]}
                    onPress={() => setUrgency(u.value)}
                  >
                    <Text style={[cs.chipText, urgency === u.value && { color: u.color }]}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Budget */}
            <View style={cs.section}>
              <Text style={cs.sectionLabel}>预算（万）</Text>
              <View style={cs.budgetRow}>
                <TextInput style={cs.budgetInput} placeholder="下限" placeholderTextColor="#d1d5db" keyboardType="numeric" value={budgetMin} onChangeText={setBudgetMin} />
                <Text style={cs.budgetDash}>—</Text>
                <TextInput style={cs.budgetInput} placeholder="上限" placeholderTextColor="#d1d5db" keyboardType="numeric" value={budgetMax} onChangeText={setBudgetMax} />
              </View>
            </View>

            {/* Areas */}
            <View style={cs.section}>
              <Text style={cs.sectionLabel}>意向区域</Text>
              <View style={cs.addRow}>
                <TextInput
                  style={cs.addInput}
                  placeholder="输入区域，如 Irvine"
                  placeholderTextColor="#d1d5db"
                  value={areaInput}
                  onChangeText={setAreaInput}
                />
                <TouchableOpacity
                  style={cs.addBtn}
                  onPress={() => {
                    if (areaInput.trim()) {
                      setAreas((prev) => [...prev, areaInput.trim()]);
                      setAreaInput("");
                    }
                  }}
                >
                  <Plus size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              {areas.length > 0 && (
                <View style={cs.chipRow}>
                  {areas.map((a) => (
                    <TouchableOpacity key={a} style={cs.tagChip} onPress={() => setAreas((p) => p.filter((x) => x !== a))}>
                      <Text style={cs.tagChipText}>{a} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Tags */}
            <View style={cs.section}>
              <Text style={cs.sectionLabel}>标签</Text>
              <View style={cs.addRow}>
                <TextInput
                  style={cs.addInput}
                  placeholder="输入标签，如 急、投资"
                  placeholderTextColor="#d1d5db"
                  value={tagInput}
                  onChangeText={setTagInput}
                />
                <TouchableOpacity
                  style={cs.addBtn}
                  onPress={() => {
                    if (tagInput.trim()) {
                      setTags((prev) => [...prev, tagInput.trim()]);
                      setTagInput("");
                    }
                  }}
                >
                  <Plus size={16} color="#fff" />
                </TouchableOpacity>
              </View>
              {tags.length > 0 && (
                <View style={cs.chipRow}>
                  {tags.map((t) => (
                    <TouchableOpacity key={t} style={[cs.tagChip, { backgroundColor: "#f0fdf4" }]} onPress={() => setTags((p) => p.filter((x) => x !== t))}>
                      <Text style={[cs.tagChipText, { color: "#15803d" }]}>{t} ✕</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const cs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  headerSave: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  body: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  fieldCard: {
    backgroundColor: "#fff", borderRadius: 12,
    borderWidth: 1, borderColor: "#f1f5f9", overflow: "hidden",
  },
  fieldRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#f9fafb",
  },
  fieldLabel: { width: 50, fontSize: 14, color: "#6b7280" },
  fieldInput: { flex: 1, fontSize: 14, color: "#111827", textAlign: "right" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "transparent",
  },
  chipActive: { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  chipText: { fontSize: 13, color: "#4b5563" },
  chipTextActive: { color: "#1e40af", fontWeight: "500" },
  budgetRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  budgetInput: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: "#111827", textAlign: "center",
  },
  budgetDash: { fontSize: 16, color: "#9ca3af" },
  addRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  addInput: {
    flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: "#111827",
  },
  addBtn: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: "#2563eb", alignItems: "center", justifyContent: "center",
  },
  tagChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16,
    backgroundColor: "#eff6ff",
  },
  tagChipText: { fontSize: 12, color: "#1e40af" },
});

// ── Voice Task Modal ──

function VoiceTaskModal({
  visible,
  onClose,
  clients,
  onAddLog,
}: {
  visible: boolean;
  onClose: () => void;
  clients: Client[];
  onAddLog: (log: ClientLog, client: Client) => void;
}) {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [actionText, setActionText] = useState("");
  const [selectedDate, setSelectedDate] = useState("");

  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.remarkName && c.remarkName.toLowerCase().includes(q)) ||
      (c.name && c.name?.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const resetAndClose = () => {
    setSelectedClient(null);
    setSearchQuery("");
    setShowClientPicker(false);
    setActionText("");
    setSelectedDate("");
    onClose();
  };

  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setSelectedDate(formatDateForNextAction(d));
  };

  const handleSubmit = () => {
    if (!selectedClient) {
      Alert.alert("提示", "请选择客户");
      return;
    }
    if (!selectedDate) {
      Alert.alert("提示", "请选择日期");
      return;
    }
    if (!actionText.trim()) {
      Alert.alert("提示", "请输入任务内容");
      return;
    }

    const log: ClientLog = {
      id: createLogId(),
      date: new Date().toISOString(),
      content: `语音建任务：${actionText.trim()}`,
      nextAction: `${selectedDate}：${actionText.trim()}`,
      nextActionTodo: actionText.trim(),
    };

    onAddLog(log, selectedClient);
    resetAndClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={vs.safe}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={vs.header}>
            <TouchableOpacity onPress={resetAndClose}>
              <X size={22} color="#6b7280" />
            </TouchableOpacity>
            <Text style={vs.headerTitle}>语音建任务</Text>
            <TouchableOpacity onPress={handleSubmit}>
              <Text style={vs.headerSave}>添加</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={vs.body}>
            {/* Mic icon (decorative for now) */}
            <View style={vs.micSection}>
              <View style={vs.micCircle}>
                <Mic size={32} color="#2563eb" />
              </View>
              <Text style={vs.micHint}>快速建任务</Text>
            </View>

            {/* Client Picker */}
            <View style={vs.section}>
              <Text style={vs.label}>客户</Text>
              {selectedClient ? (
                <View style={vs.selectedClient}>
                  <Text style={vs.selectedClientName}>
                    {selectedClient.remarkName || selectedClient.name}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedClient(null)}>
                    <Text style={vs.switchBtn}>切换</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={vs.searchRow}>
                    <Search size={16} color="#9ca3af" />
                    <TextInput
                      style={vs.searchInput}
                      placeholder="搜索客户..."
                      placeholderTextColor="#d1d5db"
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onFocus={() => setShowClientPicker(true)}
                    />
                  </View>
                  {(showClientPicker || searchQuery) && (
                    <View style={vs.clientList}>
                      {filteredClients.length === 0 ? (
                        <Text style={vs.emptyText}>未找到匹配客户</Text>
                      ) : (
                        filteredClients.slice(0, 6).map((c) => (
                          <TouchableOpacity
                            key={c.id}
                            style={vs.clientRow}
                            onPress={() => {
                              setSelectedClient(c);
                              setShowClientPicker(false);
                              setSearchQuery("");
                            }}
                          >
                            <Text style={vs.clientRowName}>
                              {c.remarkName || c.name}
                            </Text>
                            <Text style={vs.clientRowStatus}>{c.status}</Text>
                          </TouchableOpacity>
                        ))
                      )}
                    </View>
                  )}
                </>
              )}
            </View>

            {/* Date */}
            <View style={vs.section}>
              <Text style={vs.label}>日期</Text>
              <View style={vs.dateRow}>
                <TouchableOpacity style={vs.dateChip} onPress={() => setQuickDate(0)}>
                  <Text style={vs.dateChipText}>今天</Text>
                </TouchableOpacity>
                <TouchableOpacity style={vs.dateChip} onPress={() => setQuickDate(1)}>
                  <Text style={vs.dateChipText}>明天</Text>
                </TouchableOpacity>
                <TouchableOpacity style={vs.dateChip} onPress={() => setQuickDate(2)}>
                  <Text style={vs.dateChipText}>后天</Text>
                </TouchableOpacity>
                <TouchableOpacity style={vs.dateChip} onPress={() => setQuickDate(7)}>
                  <Text style={vs.dateChipText}>下周</Text>
                </TouchableOpacity>
              </View>
              {selectedDate ? (
                <Text style={vs.dateDisplay}>截止日期：{selectedDate}</Text>
              ) : null}
            </View>

            {/* Action */}
            <View style={vs.section}>
              <Text style={vs.label}>任务内容</Text>
              <TextInput
                style={vs.actionInput}
                placeholder="例如：给客户打电话跟进看房"
                placeholderTextColor="#d1d5db"
                value={actionText}
                onChangeText={setActionText}
              />
              <View style={vs.templateRow}>
                {NEXT_ACTION_OPTIONS.map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[vs.templateBtn, actionText === opt.value && vs.templateBtnActive]}
                    onPress={() => setActionText(opt.value)}
                  >
                    <Text style={[vs.templateBtnText, actionText === opt.value && vs.templateBtnTextActive]}>
                      {opt.emoji} {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const vs = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  headerSave: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  body: { padding: 16, paddingBottom: 40 },
  micSection: { alignItems: "center", marginBottom: 24 },
  micCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  micHint: { fontSize: 14, color: "#6b7280" },
  section: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  selectedClient: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#eff6ff", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
  },
  selectedClientName: { fontSize: 14, fontWeight: "600", color: "#1e40af" },
  switchBtn: { fontSize: 13, color: "#2563eb" },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: "#fff",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  clientList: {
    marginTop: 4, backgroundColor: "#fff",
    borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 10,
    maxHeight: 200, overflow: "hidden",
  },
  clientRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f9fafb",
  },
  clientRowName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  clientRowStatus: { fontSize: 12, color: "#9ca3af" },
  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  dateChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#f3f4f6",
  },
  dateChipText: { fontSize: 13, color: "#4b5563" },
  dateDisplay: { fontSize: 12, color: "#2563eb", marginBottom: 4 },
  actionInput: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12,
    fontSize: 14, color: "#111827", marginBottom: 10,
  },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f3f4f6",
  },
  templateBtnActive: { backgroundColor: "#dbeafe" },
  templateBtnText: { fontSize: 12, color: "#4b5563" },
  templateBtnTextActive: { color: "#1e40af" },
});

// ── Main Dashboard ──

export default function DashboardPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskFormClient, setTaskFormClient] = useState<Client | null>(null);
  const [showAddClient, setShowAddClient] = useState(false);
  const [showVoiceTask, setShowVoiceTask] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2000);
    return () => clearTimeout(t);
  }, [toastMessage]);

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

  const handleComplete = useCallback(async (logId: string) => {
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
    setToastMessage("已完成");
  }, []);

  const handlePostpone = useCallback(
    async (clientId: string, logId: string, daysFromNow: number) => {
      const newDate = new Date();
      newDate.setDate(newDate.getDate() + daysFromNow);
      const dateStr = formatDateForNextAction(newDate);
      let newNextAction = "";
      let newTitle = "";

      setClients((prev) =>
        prev.map((client) => {
          if (client.id !== clientId) return client;
          const updatedLogs = (client.logs || []).map((log) => {
            if (log.id !== logId || !log.nextAction) return log;
            const title =
              log.nextActionTodo ||
              log.nextAction.split(/[：:]/)[1]?.trim() ||
              log.nextAction;
            newNextAction = `${dateStr}：${title}`;
            newTitle = title;
            return { ...log, nextAction: newNextAction, nextActionTodo: title };
          });
          return { ...client, logs: updatedLogs };
        })
      );

      if (supabase && newNextAction) {
        await supabase
          .from("client_logs")
          .update({
            next_action: newNextAction,
            next_action_todo: newTitle,
          })
          .eq("id", logId);
      }
      setToastMessage(daysFromNow === 1 ? "已延期到明天" : "已延期到下周");
    },
    []
  );

  const handleQuickRecord = useCallback(
    (clientId: string) => {
      const client = clients.find((c) => c.id === clientId);
      setTaskFormClient(client ?? null);
      setShowAddTask(true);
    },
    [clients]
  );

  const handleAddLog = useCallback(
    async (log: ClientLog, targetClient: Client) => {
      // Optimistic update
      setClients((prev) =>
        prev.map((c) =>
          c.id === targetClient.id
            ? { ...c, logs: [...(c.logs || []), log] }
            : c
        )
      );
      const name = targetClient.remarkName || targetClient.name || "客户";
      setToastMessage(`已为「${name}」添加记录`);

      // Persist
      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: saved } = await supabase
            .from("client_logs")
            .insert({
              client_id: targetClient.id,
              date: log.date,
              content: log.content,
              images: log.images || null,
              next_action: log.nextAction || null,
              next_action_todo: log.nextActionTodo || null,
            })
            .select("id")
            .single();

          if (saved) {
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
        }
      }
    },
    []
  );

  const handleAddClient = useCallback(
    async (data: any) => {
      const mergedTags: string[] = Array.from(
        new Set([...(data.tags || []), ...(data.requirements?.tags || [])])
      );
      const clientData: Partial<Client> = {
        remarkName: data.remarkName || "",
        name: data.name || "",
        phone: data.phone || "",
        wechat: data.wechat || "",
        status: data.status || "新客户",
        urgency: data.urgency || "medium",
        tags: mergedTags,
        requirements: {
          budgetMin: data.requirements?.budgetMin || "",
          budgetMax: data.requirements?.budgetMax || "",
          areas: data.requirements?.areas || [],
          tags: mergedTags,
        },
      };

      if (supabase) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: saved } = await supabase
            .from("clients")
            .insert({
              user_id: session.user.id,
              name: clientData.name,
              remark_name: clientData.remarkName,
              phone: clientData.phone,
              wechat: clientData.wechat,
              status: clientData.status,
              urgency: clientData.urgency,
              tags: clientData.tags,
              requirements: clientData.requirements,
            })
            .select("id")
            .single();

          if (saved) {
            const newClient: Client = {
              ...clientData,
              id: saved.id,
              remarkName: clientData.remarkName!,
              status: clientData.status!,
              urgency: clientData.urgency as "high" | "medium" | "low",
              tags: clientData.tags!,
              requirements: clientData.requirements!,
              logs: [],
            };
            setClients((prev) => [newClient, ...prev]);
            setToastMessage(`已添加客户「${newClient.remarkName || newClient.name}」`);
            return;
          }
        }
      }

      // Fallback: add locally
      const newClient: Client = {
        ...clientData,
        id: Date.now().toString(),
        remarkName: clientData.remarkName!,
        status: clientData.status!,
        urgency: clientData.urgency as "high" | "medium" | "low",
        tags: clientData.tags!,
        requirements: clientData.requirements!,
        logs: [],
      };
      setClients((prev) => [newClient, ...prev]);
      setToastMessage(`已添加客户「${newClient.remarkName || newClient.name}」`);
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
      {/* Toast */}
      {toastMessage ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Header with action buttons */}
        <View style={s.headerRow}>
          <Text style={s.pageTitle}>今日工作台</Text>
          <View style={s.headerBtns}>
            <TouchableOpacity
              style={[s.headerBtn, { backgroundColor: "#9333ea" }]}
              onPress={() => setShowAddClient(true)}
            >
              <UserPlus size={14} color="#fff" />
              <Text style={s.headerBtnText}>加客户</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.headerBtn, { backgroundColor: "#16a34a" }]}
              onPress={() => setShowVoiceTask(true)}
            >
              <Mic size={14} color="#fff" />
              <Text style={s.headerBtnText}>语音</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.headerBtn, { backgroundColor: "#2563eb" }]}
              onPress={() => {
                setTaskFormClient(null);
                setShowAddTask(true);
              }}
            >
              <Plus size={14} color="#fff" />
              <Text style={s.headerBtnText}>任务</Text>
            </TouchableOpacity>
          </View>
        </View>

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
                    onPostpone={handlePostpone}
                    onQuickRecord={handleQuickRecord}
                    showActions
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
                  onPostpone={handlePostpone}
                  onQuickRecord={handleQuickRecord}
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
                  onPostpone={handlePostpone}
                  onQuickRecord={handleQuickRecord}
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
                  onPostpone={handlePostpone}
                  onQuickRecord={handleQuickRecord}
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

      {/* Add Task Modal */}
      <AddTaskModal
        visible={showAddTask}
        onClose={() => {
          setShowAddTask(false);
          setTaskFormClient(null);
        }}
        clients={clients}
        preselectedClient={taskFormClient}
        onAddLog={handleAddLog}
      />

      {/* Add Client Modal */}
      <AddClientModal
        visible={showAddClient}
        onClose={() => setShowAddClient(false)}
        onSubmit={handleAddClient}
      />

      {/* Voice Task Modal */}
      <VoiceTaskModal
        visible={showVoiceTask}
        onClose={() => setShowVoiceTask(false)}
        clients={clients}
        onAddLog={handleAddLog}
      />
    </SafeAreaView>
  );
}

// ── Task Card ──

function TaskCard({
  task,
  isOverdue,
  clientPhone,
  clientWechat,
  onComplete,
  onCall,
  onCopyWechat,
  onPostpone,
  onQuickRecord,
  showActions,
}: {
  task: FlatTask;
  isOverdue: boolean;
  clientPhone?: string;
  clientWechat?: string;
  onComplete: (logId: string) => void;
  onCall: (phone: string) => void;
  onCopyWechat: (wechat: string) => void;
  onPostpone: (clientId: string, logId: string, days: number) => void;
  onQuickRecord: (clientId: string) => void;
  showActions?: boolean;
}) {
  const [postponeExpanded, setPostponeExpanded] = useState(false);
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
          {/* Complete */}
          <TouchableOpacity
            style={s.taskAction}
            onPress={() => onComplete(task.logId)}
          >
            <CheckCircle2 size={16} color="#16a34a" />
            <Text style={[s.taskActionText, { color: "#16a34a" }]}>
              完成
            </Text>
          </TouchableOpacity>

          {/* Phone */}
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

          {/* WeChat */}
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

          {/* Postpone */}
          {postponeExpanded ? (
            <>
              <TouchableOpacity
                style={s.taskAction}
                onPress={() => {
                  onPostpone(task.clientId, task.logId, 1);
                  setPostponeExpanded(false);
                }}
              >
                <Text style={[s.taskActionText, { color: "#6b7280" }]}>
                  明天
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.taskAction}
                onPress={() => {
                  onPostpone(task.clientId, task.logId, 7);
                  setPostponeExpanded(false);
                }}
              >
                <Text style={[s.taskActionText, { color: "#6b7280" }]}>
                  下周
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={s.taskAction}
              onPress={() => setPostponeExpanded(true)}
            >
              <CalendarPlus size={16} color="#6b7280" />
              <Text style={[s.taskActionText, { color: "#6b7280" }]}>
                延期
              </Text>
            </TouchableOpacity>
          )}

          {/* Quick Record */}
          <TouchableOpacity
            style={s.taskAction}
            onPress={() => onQuickRecord(task.clientId)}
          >
            <Plus size={16} color="#2563eb" />
            <Text style={[s.taskActionText, { color: "#2563eb" }]}>
              记录
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ── Styles ──

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Toast
  toast: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    zIndex: 50,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#1f2937",
    borderRadius: 8,
  },
  toastText: { fontSize: 14, color: "#fff" },

  // Header
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  headerBtns: {
    flexDirection: "row",
    gap: 6,
  },
  headerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  headerBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },

  // Briefing card
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

  // Sections
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

  // Task card
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

  // Client cards
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
