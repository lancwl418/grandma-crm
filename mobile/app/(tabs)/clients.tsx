import { useEffect, useState, useMemo } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Search,
  Phone,
  MessageCircle,
  ChevronRight,
  X,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { Client } from "@/types";

const STATUS_TABS = [
  "全部",
  "新客户",
  "看房中",
  "意向强烈",
  "已下Offer",
  "已成交",
  "停滞",
  "暂缓",
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

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("全部");
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
      const { data } = await supabase
        .from("clients")
        .select("*")
        .eq("user_id", session.user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setClients(
          data.map((c: any) => ({
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
            logs: [],
          }))
        );
      }
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
              style={[
                s.tabText,
                activeTab === tab && s.tabTextActive,
              ]}
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
            const expanded = expandedId === client.id;
            return (
              <View key={client.id} style={s.clientCard}>
                <TouchableOpacity
                  style={s.clientRow}
                  onPress={() =>
                    setExpandedId(expanded ? null : client.id)
                  }
                  activeOpacity={0.6}
                >
                  <View style={s.clientAvatar}>
                    <Text style={s.clientAvatarText}>
                      {(
                        client.remarkName ||
                        client.name ||
                        "?"
                      )[0]}
                    </Text>
                  </View>
                  <View style={s.clientInfo}>
                    <Text style={s.clientName}>
                      {client.remarkName || client.name}
                    </Text>
                    {client.phone ? (
                      <Text style={s.clientPhone}>
                        {client.phone}
                      </Text>
                    ) : null}
                  </View>
                  <View
                    style={[
                      s.statusBadge,
                      { backgroundColor: statusColor.bg },
                    ]}
                  >
                    <Text
                      style={[
                        s.statusText,
                        { color: statusColor.text },
                      ]}
                    >
                      {client.status}
                    </Text>
                  </View>
                  <View
                    style={[
                      s.urgencyDot,
                      {
                        backgroundColor:
                          URGENCY_COLORS[client.urgency] || "#f59e0b",
                      },
                    ]}
                  />
                </TouchableOpacity>

                {expanded && (
                  <View style={s.expandedArea}>
                    {client.requirements?.notes ? (
                      <Text style={s.requirementText}>
                        需求: {client.requirements.notes}
                      </Text>
                    ) : null}
                    {client.tags?.length > 0 && (
                      <View style={s.tagRow}>
                        {client.tags.map((tag) => (
                          <View key={tag} style={s.tagChip}>
                            <Text style={s.tagChipText}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    <View style={s.actionRow}>
                      {client.phone ? (
                        <TouchableOpacity
                          style={s.actionBtn}
                          onPress={() =>
                            Linking.openURL(`tel:${client.phone}`)
                          }
                        >
                          <Phone size={16} color="#2563eb" />
                          <Text style={s.actionBtnText}>拨号</Text>
                        </TouchableOpacity>
                      ) : null}
                      {client.wechat ? (
                        <TouchableOpacity
                          style={s.actionBtn}
                          onPress={() =>
                            Alert.alert(
                              "微信号",
                              client.wechat,
                              [{ text: "好的" }]
                            )
                          }
                        >
                          <MessageCircle size={16} color="#16a34a" />
                          <Text
                            style={[
                              s.actionBtnText,
                              { color: "#16a34a" },
                            ]}
                          >
                            微信
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>
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
  tabContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  tabActive: {
    backgroundColor: "#1e293b",
    borderColor: "#1e293b",
  },
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
  clientInfo: { flex: 1 },
  clientName: { fontSize: 14, fontWeight: "500", color: "#111827" },
  clientPhone: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusText: { fontSize: 11, fontWeight: "500" },
  urgencyDot: { width: 8, height: 8, borderRadius: 4 },
  expandedArea: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: "#f9fafb",
    paddingTop: 10,
  },
  requirementText: { fontSize: 13, color: "#4b5563", marginBottom: 8 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  tagChip: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  tagChipText: { fontSize: 11, color: "#6b7280" },
  actionRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 8,
  },
  actionBtnText: { fontSize: 12, fontWeight: "500", color: "#2563eb" },
});
