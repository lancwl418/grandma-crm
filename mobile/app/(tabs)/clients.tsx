import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Phone,
  MessageCircle,
  ChevronRight,
  X,
  ArrowLeft,
  Calendar,
  Plus,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { Client, ClientLog } from "@/types";
import * as Clipboard from "expo-clipboard";

const STATUS_TABS = [
  "全部", "新客户", "看房中", "意向强烈", "已下Offer", "已成交", "停滞", "暂缓",
];

const STATUS_OPTIONS = [
  "新客户", "看房中", "意向强烈", "已下Offer", "已成交", "停滞", "暂缓",
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  新客户: { bg: "#dbeafe", text: "#2563eb" },
  看房中: { bg: "#fef3c7", text: "#d97706" },
  意向强烈: { bg: "#fee2e2", text: "#dc2626" },
  "已下Offer": { bg: "#fce7f3", text: "#db2777" },
  已成交: { bg: "#dcfce7", text: "#16a34a" },
  停滞: { bg: "#f3f4f6", text: "#6b7280" },
  暂缓: { bg: "#f3f4f6", text: "#9ca3af" },
};

const URGENCY_COLORS: Record<string, string> = {
  high: "#ef4444",
  medium: "#f59e0b",
  low: "#22c55e",
};

const QUICK_LOG_TEMPLATES = [
  { key: "call", label: "📞 电话未接", content: "致电客户无人接听，已通过微信留言告知事宜。" },
  { key: "listings", label: "📬 已发房源", content: "已通过微信发送最新房源清单，请客户查看并反馈意向。" },
  { key: "viewing", label: "📅 确认约看", content: "已与客户确认看房时间与地点，提醒提前安排好行程。" },
  { key: "satisfied", label: "✅ 带看满意", content: "本次带看整体满意，客户对其中一两套房源有进一步兴趣。" },
  { key: "considering", label: "🤔 还在考虑", content: "客户表示还在综合比较，计划几天后再做下一步跟进。" },
];

const NEXT_ACTION_OPTIONS = [
  { emoji: "📅", label: "安排看房", value: "安排线下看房，确认时间地点。" },
  { emoji: "📩", label: "发送房源", value: "发送新一轮匹配房源给客户。" },
  { emoji: "💰", label: "确认贷款", value: "与客户沟通贷款方案和预算区间。" },
  { emoji: "🔁", label: "跟进反馈", value: "通过微信跟进客户对现有房源的反馈。" },
];

function createLogId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateForNextAction(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatLogDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Client Detail View ──

function ClientDetailView({
  client,
  onBack,
  onUpdate,
}: {
  client: Client;
  onBack: () => void;
  onUpdate: (updated: Client) => void;
}) {
  const [showAddLog, setShowAddLog] = useState(false);
  const [logContent, setLogContent] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [nextActionContent, setNextActionContent] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Editable fields
  const [editingField, setEditingField] = useState<string | null>(null);
  const [fieldDraft, setFieldDraft] = useState("");

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 2000);
    return () => clearTimeout(t);
  }, [toastMsg]);

  const update = useCallback(
    async (patch: Partial<Client>) => {
      const updated = {
        ...client,
        ...patch,
        requirements: {
          ...client.requirements,
          ...((patch as any).requirements || {}),
        },
      };
      onUpdate(updated);

      // Persist to supabase
      if (supabase) {
        const dbPatch: any = {};
        if (patch.phone !== undefined) dbPatch.phone = patch.phone;
        if (patch.wechat !== undefined) dbPatch.wechat = patch.wechat;
        if (patch.birthday !== undefined) dbPatch.birthday = patch.birthday;
        if (patch.status !== undefined) dbPatch.status = patch.status;
        if (patch.urgency !== undefined) dbPatch.urgency = patch.urgency;
        if (patch.tags !== undefined) dbPatch.tags = patch.tags;
        if ((patch as any).requirements) {
          dbPatch.requirements = updated.requirements;
        }
        if (Object.keys(dbPatch).length > 0) {
          await supabase.from("clients").update(dbPatch).eq("id", client.id);
        }
      }
    },
    [client, onUpdate]
  );

  const handleAddLog = useCallback(async () => {
    const hasContent = logContent.trim().length > 0;
    const hasNextAction = nextDate && nextActionContent.trim();
    if (!hasContent && !hasNextAction) return;

    const log: ClientLog = {
      id: createLogId(),
      date: new Date().toISOString(),
      content: logContent.trim() || (hasNextAction ? `设定任务：${nextActionContent.trim()}` : ""),
      nextAction: hasNextAction ? `${nextDate}：${nextActionContent.trim()}` : undefined,
      nextActionTodo: hasNextAction ? nextActionContent.trim() : undefined,
    };

    // Optimistic update
    onUpdate({ ...client, logs: [...(client.logs || []), log] });
    setLogContent("");
    setNextDate("");
    setNextActionContent("");
    setShowAddLog(false);
    setToastMsg("已添加记录");

    // Persist
    if (supabase) {
      const { data: saved } = await supabase
        .from("client_logs")
        .insert({
          client_id: client.id,
          date: log.date,
          content: log.content,
          images: log.images || null,
          next_action: log.nextAction || null,
          next_action_todo: log.nextActionTodo || null,
        })
        .select("id")
        .single();

      if (saved) {
        onUpdate({
          ...client,
          logs: [...(client.logs || []), { ...log, id: saved.id }],
        });
      }
    }
  }, [client, logContent, nextDate, nextActionContent, onUpdate]);

  const handleCopyWechat = async () => {
    if (client.wechat && Clipboard.setStringAsync) {
      await Clipboard.setStringAsync(client.wechat);
      setToastMsg("微信号已复制");
    }
  };

  const setQuickDate = (daysFromNow: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysFromNow);
    setNextDate(formatDateForNextAction(d));
  };

  const statusColor = STATUS_COLORS[client.status] || { bg: "#f3f4f6", text: "#6b7280" };
  const sortedLogs = [...(client.logs || [])].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const startEdit = (field: string, currentValue: string) => {
    setEditingField(field);
    setFieldDraft(currentValue);
  };

  const saveEdit = () => {
    if (!editingField) return;
    if (editingField === "phone") update({ phone: fieldDraft });
    else if (editingField === "wechat") update({ wechat: fieldDraft });
    else if (editingField === "notes") update({ requirements: { notes: fieldDraft } as any });
    setEditingField(null);
    setFieldDraft("");
    setToastMsg("已保存");
  };

  return (
    <SafeAreaView style={d.safe} edges={["top"]}>
      {/* Toast */}
      {toastMsg ? (
        <View style={d.toast}>
          <Text style={d.toastText}>{toastMsg}</Text>
        </View>
      ) : null}

      {/* Header */}
      <View style={d.header}>
        <TouchableOpacity onPress={onBack} style={d.backBtn}>
          <ArrowLeft size={20} color="#374151" />
          <Text style={d.backText}>返回</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={d.scroll} contentContainerStyle={d.content}>
        {/* Name Card */}
        <View style={d.nameCard}>
          <View style={d.nameAvatar}>
            <Text style={d.nameAvatarText}>
              {(client.remarkName || client.name || "?")[0]}
            </Text>
          </View>
          <View style={d.nameInfo}>
            <Text style={d.nameMain}>{client.remarkName || "未命名客户"}</Text>
            {client.name && client.remarkName ? (
              <Text style={d.nameSub}>{client.name}</Text>
            ) : null}
          </View>
          <View style={[d.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[d.statusText, { color: statusColor.text }]}>{client.status}</Text>
          </View>
          <View style={[d.urgencyDot, { backgroundColor: URGENCY_COLORS[client.urgency] || "#f59e0b" }]} />
        </View>

        {/* Status & Urgency Pickers */}
        <View style={d.card}>
          <Text style={d.cardLabel}>客户状态</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={d.chipRow}>
              {STATUS_OPTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[d.chip, client.status === s && d.chipActive]}
                  onPress={() => update({ status: s })}
                >
                  <Text style={[d.chipText, client.status === s && d.chipTextActive]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
          <Text style={[d.cardLabel, { marginTop: 12 }]}>紧急程度</Text>
          <View style={d.chipRow}>
            {([
              { value: "high" as const, label: "高", color: "#ef4444" },
              { value: "medium" as const, label: "中", color: "#f59e0b" },
              { value: "low" as const, label: "低", color: "#22c55e" },
            ]).map((u) => (
              <TouchableOpacity
                key={u.value}
                style={[d.chip, client.urgency === u.value && { backgroundColor: u.color + "20", borderColor: u.color }]}
                onPress={() => update({ urgency: u.value })}
              >
                <Text style={[d.chipText, client.urgency === u.value && { color: u.color, fontWeight: "600" }]}>{u.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Contact Info */}
        <View style={d.card}>
          <TouchableOpacity
            style={d.infoRow}
            onPress={() => startEdit("phone", client.phone || "")}
          >
            <Phone size={16} color="#6b7280" />
            <Text style={d.infoLabel}>电话</Text>
            {editingField === "phone" ? (
              <View style={d.editRow}>
                <TextInput
                  style={d.editInput}
                  value={fieldDraft}
                  onChangeText={setFieldDraft}
                  keyboardType="phone-pad"
                  autoFocus
                />
                <TouchableOpacity onPress={saveEdit}>
                  <Text style={d.editSave}>保存</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={d.infoValue}>{client.phone || "未设置"}</Text>
            )}
          </TouchableOpacity>

          {client.phone ? (
            <TouchableOpacity style={d.quickAction} onPress={() => Linking.openURL(`tel:${client.phone}`)}>
              <Phone size={14} color="#2563eb" />
              <Text style={d.quickActionText}>拨打电话</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={d.infoRow}
            onPress={() => startEdit("wechat", client.wechat || "")}
          >
            <MessageCircle size={16} color="#6b7280" />
            <Text style={d.infoLabel}>微信</Text>
            {editingField === "wechat" ? (
              <View style={d.editRow}>
                <TextInput
                  style={d.editInput}
                  value={fieldDraft}
                  onChangeText={setFieldDraft}
                  autoFocus
                />
                <TouchableOpacity onPress={saveEdit}>
                  <Text style={d.editSave}>保存</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={d.infoValue}>{client.wechat || "未设置"}</Text>
            )}
          </TouchableOpacity>

          {client.wechat ? (
            <TouchableOpacity style={d.quickAction} onPress={handleCopyWechat}>
              <MessageCircle size={14} color="#16a34a" />
              <Text style={[d.quickActionText, { color: "#16a34a" }]}>复制微信号</Text>
            </TouchableOpacity>
          ) : null}

          <View style={d.infoRow}>
            <Calendar size={16} color="#ec4899" />
            <Text style={d.infoLabel}>生日</Text>
            <Text style={d.infoValue}>{client.birthday || "未设置"}</Text>
          </View>
        </View>

        {/* Budget */}
        {(client.requirements?.budgetMin || client.requirements?.budgetMax) ? (
          <View style={d.card}>
            <Text style={d.cardLabel}>预算</Text>
            <Text style={d.budgetText}>
              {client.requirements.budgetMin || "?"}万 — {client.requirements.budgetMax || "?"}万
            </Text>
          </View>
        ) : null}

        {/* Areas */}
        {(client.requirements?.areas?.length ?? 0) > 0 && (
          <View style={d.card}>
            <Text style={d.cardLabel}>意向区域</Text>
            <View style={d.chipRow}>
              {client.requirements!.areas!.map((a) => (
                <View key={a} style={d.tagChip}>
                  <Text style={d.tagChipText}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Tags */}
        {client.tags?.length > 0 && (
          <View style={d.card}>
            <Text style={d.cardLabel}>标签</Text>
            <View style={d.chipRow}>
              {client.tags.map((t) => (
                <View key={t} style={[d.tagChip, { backgroundColor: "#f0fdf4" }]}>
                  <Text style={[d.tagChipText, { color: "#15803d" }]}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Notes */}
        <View style={d.card}>
          <View style={d.cardLabelRow}>
            <Text style={d.cardLabel}>备注</Text>
            {editingField !== "notes" && (
              <TouchableOpacity onPress={() => startEdit("notes", client.requirements?.notes || "")}>
                <Text style={d.editBtn}>编辑</Text>
              </TouchableOpacity>
            )}
          </View>
          {editingField === "notes" ? (
            <View>
              <TextInput
                style={d.notesInput}
                value={fieldDraft}
                onChangeText={setFieldDraft}
                multiline
                autoFocus
              />
              <TouchableOpacity style={d.saveBtn} onPress={saveEdit}>
                <Text style={d.saveBtnText}>保存</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={d.notesText}>{client.requirements?.notes || "无备注"}</Text>
          )}
        </View>

        {/* Follow-up Logs */}
        <View style={d.logsSection}>
          <View style={d.logsSectionHeader}>
            <Text style={d.logsSectionTitle}>跟进记录</Text>
            <TouchableOpacity
              style={d.addLogBtn}
              onPress={() => setShowAddLog(true)}
            >
              <Plus size={14} color="#fff" />
              <Text style={d.addLogBtnText}>添加</Text>
            </TouchableOpacity>
          </View>

          {sortedLogs.length === 0 ? (
            <View style={d.emptyLogs}>
              <Text style={d.emptyLogsText}>还没有跟进记录</Text>
            </View>
          ) : (
            sortedLogs.map((log, idx) => (
              <View key={log.id ?? idx} style={d.logCard}>
                <View style={d.logHeader}>
                  <Text style={d.logDate}>{formatLogDate(log.date)}</Text>
                  {log.nextActionTodo ? (
                    <View style={d.logTaskBadge}>
                      <Text style={d.logTaskBadgeText}>有任务</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={d.logContent}>{log.content}</Text>
                {log.nextAction ? (
                  <View style={d.logNextAction}>
                    <Text style={d.logNextActionLabel}>下一步：</Text>
                    <Text style={d.logNextActionText}>{log.nextAction}</Text>
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Log Modal */}
      <Modal visible={showAddLog} animationType="slide" presentationStyle="pageSheet">
        <SafeAreaView style={d.safe}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={d.modalHeader}>
              <TouchableOpacity onPress={() => setShowAddLog(false)}>
                <X size={22} color="#6b7280" />
              </TouchableOpacity>
              <Text style={d.modalTitle}>添加跟进记录</Text>
              <TouchableOpacity onPress={handleAddLog}>
                <Text style={d.modalSave}>保存</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={d.modalBody}>
              {/* Quick Templates */}
              <View style={d.modalSection}>
                <Text style={d.modalLabel}>快捷模板</Text>
                <View style={d.templateRow}>
                  {QUICK_LOG_TEMPLATES.map((tpl) => (
                    <TouchableOpacity
                      key={tpl.key}
                      style={[d.templateBtn, logContent === tpl.content && d.templateBtnActive]}
                      onPress={() => setLogContent(tpl.content)}
                    >
                      <Text style={[d.templateBtnText, logContent === tpl.content && d.templateBtnTextActive]}>
                        {tpl.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Content */}
              <View style={d.modalSection}>
                <Text style={d.modalLabel}>跟进内容</Text>
                <TextInput
                  style={d.textarea}
                  placeholder="写点什么..."
                  placeholderTextColor="#d1d5db"
                  multiline
                  value={logContent}
                  onChangeText={setLogContent}
                />
              </View>

              {/* Next Action */}
              <View style={d.modalSection}>
                <Text style={d.modalLabel}>下一步计划（可选）</Text>
                <View style={d.dateRow}>
                  <TouchableOpacity style={d.dateChip} onPress={() => setQuickDate(0)}>
                    <Text style={d.dateChipText}>今天</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={d.dateChip} onPress={() => setQuickDate(1)}>
                    <Text style={d.dateChipText}>明天</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={d.dateChip} onPress={() => setQuickDate(3)}>
                    <Text style={d.dateChipText}>3天后</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={d.dateChip} onPress={() => setQuickDate(7)}>
                    <Text style={d.dateChipText}>下周</Text>
                  </TouchableOpacity>
                </View>
                {nextDate ? <Text style={d.dateDisplay}>截止日期：{nextDate}</Text> : null}
                <TextInput
                  style={d.nextActionInput}
                  placeholder="下一步计划..."
                  placeholderTextColor="#d1d5db"
                  value={nextActionContent}
                  onChangeText={setNextActionContent}
                />
                <View style={d.templateRow}>
                  {NEXT_ACTION_OPTIONS.map((opt) => (
                    <TouchableOpacity
                      key={opt.label}
                      style={[d.templateBtn, nextActionContent === opt.value && d.templateBtnActive]}
                      onPress={() => setNextActionContent(opt.value)}
                    >
                      <Text style={[d.templateBtnText, nextActionContent === opt.value && d.templateBtnTextActive]}>
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
    </SafeAreaView>
  );
}

const d = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  toast: {
    position: "absolute", bottom: 24, alignSelf: "center", zIndex: 50,
    paddingHorizontal: 20, paddingVertical: 10, backgroundColor: "#1f2937", borderRadius: 8,
  },
  toastText: { fontSize: 14, color: "#fff" },

  // Header
  header: {
    paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff",
  },
  backBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  backText: { fontSize: 14, color: "#374151" },

  // Name Card
  nameCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#f1f5f9",
    flexDirection: "row", alignItems: "center", marginBottom: 12,
  },
  nameAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
  },
  nameAvatarText: { fontSize: 20, fontWeight: "700", color: "#2563eb" },
  nameInfo: { flex: 1, marginLeft: 12 },
  nameMain: { fontSize: 18, fontWeight: "700", color: "#111827" },
  nameSub: { fontSize: 13, color: "#9ca3af", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, marginRight: 8 },
  statusText: { fontSize: 11, fontWeight: "500" },
  urgencyDot: { width: 10, height: 10, borderRadius: 5 },

  // Card
  card: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#f1f5f9", marginBottom: 12,
  },
  cardLabel: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginBottom: 8 },
  cardLabelRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  editBtn: { fontSize: 13, color: "#2563eb" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#f3f4f6", borderWidth: 1, borderColor: "transparent",
  },
  chipActive: { backgroundColor: "#dbeafe", borderColor: "#2563eb" },
  chipText: { fontSize: 12, color: "#4b5563" },
  chipTextActive: { color: "#1e40af", fontWeight: "600" },
  tagChip: { backgroundColor: "#eff6ff", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  tagChipText: { fontSize: 12, color: "#1e40af" },

  // Info rows
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f9fafb",
  },
  infoLabel: { fontSize: 14, color: "#6b7280", width: 40 },
  infoValue: { flex: 1, fontSize: 14, color: "#111827", textAlign: "right" },
  editRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  editInput: {
    flex: 1, fontSize: 14, color: "#111827", textAlign: "right",
    borderBottomWidth: 1, borderBottomColor: "#2563eb", paddingVertical: 2,
  },
  editSave: { fontSize: 13, color: "#2563eb", fontWeight: "600" },
  quickAction: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingVertical: 8, paddingHorizontal: 12, marginTop: 4, marginBottom: 4,
    backgroundColor: "#eff6ff", borderRadius: 8, alignSelf: "flex-start",
  },
  quickActionText: { fontSize: 12, fontWeight: "500", color: "#2563eb" },

  // Budget
  budgetText: { fontSize: 15, color: "#111827", fontWeight: "500" },

  // Notes
  notesText: { fontSize: 14, color: "#4b5563", lineHeight: 20 },
  notesInput: {
    backgroundColor: "#fefce8", borderWidth: 1, borderColor: "#fde68a",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#111827",
    minHeight: 80, textAlignVertical: "top", marginBottom: 8,
  },
  saveBtn: {
    backgroundColor: "#2563eb", borderRadius: 8, paddingVertical: 10, alignItems: "center",
  },
  saveBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },

  // Logs
  logsSection: { marginTop: 4 },
  logsSectionHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12,
  },
  logsSectionTitle: { fontSize: 16, fontWeight: "700", color: "#111827" },
  addLogBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#2563eb", borderRadius: 8,
  },
  addLogBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  emptyLogs: { paddingVertical: 24, alignItems: "center" },
  emptyLogsText: { fontSize: 14, color: "#9ca3af" },
  logCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#f1f5f9", marginBottom: 8,
  },
  logHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  logDate: { fontSize: 12, color: "#9ca3af" },
  logTaskBadge: { backgroundColor: "#dbeafe", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  logTaskBadgeText: { fontSize: 10, color: "#2563eb", fontWeight: "500" },
  logContent: { fontSize: 14, color: "#374151", lineHeight: 20 },
  logNextAction: {
    marginTop: 8, backgroundColor: "#fffbeb", borderRadius: 8, padding: 10,
    flexDirection: "row", flexWrap: "wrap",
  },
  logNextActionLabel: { fontSize: 12, color: "#92400e", fontWeight: "600" },
  logNextActionText: { fontSize: 12, color: "#92400e" },

  // Add Log Modal
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#f1f5f9", backgroundColor: "#fff",
  },
  modalTitle: { fontSize: 16, fontWeight: "600", color: "#111827" },
  modalSave: { fontSize: 14, fontWeight: "600", color: "#2563eb" },
  modalBody: { padding: 16, paddingBottom: 40 },
  modalSection: { marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  templateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  templateBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f3f4f6" },
  templateBtnActive: { backgroundColor: "#dbeafe" },
  templateBtnText: { fontSize: 12, color: "#4b5563" },
  templateBtnTextActive: { color: "#1e40af" },
  textarea: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 10, padding: 12, fontSize: 14, color: "#111827",
    minHeight: 100, textAlignVertical: "top",
  },
  dateRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  dateChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#f3f4f6" },
  dateChipText: { fontSize: 12, color: "#4b5563" },
  dateDisplay: { fontSize: 12, color: "#2563eb", marginBottom: 8 },
  nextActionInput: {
    backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e7eb",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: "#111827", marginBottom: 8,
  },
});

// ── Main Client List ──

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("全部");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

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

      // Also load logs
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

      setClients(
        clientRows.map((c: any) => ({
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
        }))
      );
    } catch (err) {
      console.error("loadClients error:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    let list = clients;
    if (activeTab !== "全部") {
      list = list.filter((c) => c.status === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          (c.remarkName || "").toLowerCase().includes(q) ||
          (c.name || "").toLowerCase().includes(q) ||
          (c.phone || "").includes(q)
      );
    }
    return list;
  }, [clients, activeTab, search]);

  const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

  const handleUpdateClient = useCallback((updated: Client) => {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }, []);

  // Show detail view
  if (selectedClient) {
    return (
      <ClientDetailView
        client={selectedClient}
        onBack={() => setSelectedClientId(null)}
        onUpdate={handleUpdateClient}
      />
    );
  }

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
      <View style={s.header}>
        <Text style={s.pageTitle}>客户管理</Text>
        <Text style={s.clientCount}>{clients.length} 位客户</Text>
      </View>

      {/* Search */}
      <View style={s.searchBox}>
        <Search size={16} color="#9ca3af" />
        <TextInput
          style={s.searchInput}
          placeholder="搜索姓名或电话"
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <X size={16} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Status Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabScroll}
        contentContainerStyle={s.tabContainer}
      >
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text
              style={[s.tabText, activeTab === tab && s.tabTextActive]}
            >
              {tab}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Client List */}
      <ScrollView style={s.list} contentContainerStyle={s.listContent}>
        {filtered.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyText}>暂无客户</Text>
          </View>
        ) : (
          filtered.map((client) => {
            const statusColor = STATUS_COLORS[client.status] || {
              bg: "#f3f4f6",
              text: "#6b7280",
            };
            return (
              <TouchableOpacity
                key={client.id}
                style={s.clientCard}
                onPress={() => setSelectedClientId(client.id)}
                activeOpacity={0.6}
              >
                <View style={s.clientRow}>
                  <View style={s.clientAvatar}>
                    <Text style={s.clientAvatarText}>
                      {(client.remarkName || client.name || "?")[0]}
                    </Text>
                  </View>
                  <View style={s.clientInfo}>
                    <Text style={s.clientName}>
                      {client.remarkName || client.name}
                    </Text>
                    {client.phone ? (
                      <Text style={s.clientPhone}>{client.phone}</Text>
                    ) : null}
                  </View>
                  <View
                    style={[s.statusBadge, { backgroundColor: statusColor.bg }]}
                  >
                    <Text style={[s.statusText, { color: statusColor.text }]}>
                      {client.status}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.urgencyDot,
                      { backgroundColor: URGENCY_COLORS[client.urgency] || "#f59e0b" },
                    ]}
                  />
                  <ChevronRight size={16} color="#d1d5db" />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", color: "#111827" },
  clientCount: { fontSize: 13, color: "#6b7280" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: "#111827" },
  tabScroll: { marginTop: 12, maxHeight: 40 },
  tabContainer: { paddingHorizontal: 16, gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tabActive: { backgroundColor: "#1e293b", borderColor: "#1e293b" },
  tabText: { fontSize: 13, color: "#6b7280" },
  tabTextActive: { color: "#fff", fontWeight: "500" },
  list: { flex: 1, marginTop: 12 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyBox: { paddingVertical: 40, alignItems: "center" },
  emptyText: { fontSize: 14, color: "#9ca3af" },
  clientCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 8,
    overflow: "hidden",
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 10,
  },
  clientAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#eff6ff", alignItems: "center", justifyContent: "center",
  },
  clientAvatarText: { fontSize: 16, fontWeight: "600", color: "#2563eb" },
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  clientPhone: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusText: { fontSize: 11, fontWeight: "500" },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
});
