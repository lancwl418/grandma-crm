import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Users,
  UserPlus,
  Eye,
  TrendingUp,
  Search,
  ClipboardList,
  ChevronRight,
  Share2,
  Pencil,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { AgentProfile, Stats } from "@/types";

const DEFAULT_PROFILE: AgentProfile = {
  username: "",
  display_name: "",
  title: "房地产经纪人",
  phone: "",
  wechat: "",
  email: "",
  avatar_url: "",
};

export default function HomePage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    newThisMonth: 0,
    activeViewers: 0,
    inquiries: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadProfile(session.user.id);
        loadStats(session.user.id);
      } else {
        setLoading(false);
      }
    });
  }, []);

  const loadProfile = async (uid: string) => {
    if (!supabase) return;
    const { data } = await supabase
      .from("agent_profiles")
      .select("*")
      .eq("user_id", uid)
      .single();
    if (data) {
      setProfile({
        username: data.username || "",
        display_name: data.display_name || "",
        title: data.title || "房地产经纪人",
        phone: data.phone || "",
        wechat: data.wechat || "",
        email: data.email || "",
        avatar_url: data.avatar_url || "",
      });
    }
  };

  const loadStats = async (uid: string) => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { count: total } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid);

      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      const { count: newCount } = await supabase
        .from("clients")
        .select("id", { count: "exact", head: true })
        .eq("user_id", uid)
        .gte("created_at", monthStart.toISOString());

      const { data: myClients } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", uid);
      const myClientIds = (myClients ?? []).map((c: any) => c.id);

      let activeViewers = 0;
      let inquiries = 0;
      if (myClientIds.length > 0) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: viewData } = await supabase
          .from("client_listing_views")
          .select("client_id")
          .in("client_id", myClientIds)
          .gte("created_at", weekAgo.toISOString());
        activeViewers = new Set(
          (viewData ?? []).map((v: any) => v.client_id)
        ).size;

        const { count: iqCount } = await supabase
          .from("client_listing_views")
          .select("id", { count: "exact", head: true })
          .in("client_id", myClientIds)
          .eq("action", "inquiry")
          .gte("created_at", weekAgo.toISOString());
        inquiries = iqCount ?? 0;
      }

      setStats({
        totalClients: total ?? 0,
        newThisMonth: newCount ?? 0,
        activeViewers,
        inquiries,
      });
    } catch (err) {
      console.error("loadStats error:", err);
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    profile.display_name || profile.username || "Agent";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  return (
    <SafeAreaView style={s.safe} edges={["top"]}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>
        {/* Profile Header */}
        <View style={s.headerBg}>
          <View style={s.headerRow}>
            <View style={s.avatar}>
              <Text style={s.avatarText}>{initial}</Text>
            </View>
            <View style={s.headerInfo}>
              <Text style={s.headerName}>{displayName}</Text>
              {profile.username ? (
                <Text style={s.headerUsername}>@{profile.username}</Text>
              ) : null}
              <Text style={s.headerTitle}>
                {profile.title || "房地产经纪人"}
              </Text>
            </View>
            <TouchableOpacity
              style={s.editBtn}
              onPress={() => router.push("/(tabs)/profile")}
            >
              <Pencil size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Stats */}
        <View style={s.statsGrid}>
          <StatCard
            icon={<Users size={20} color="#2563eb" />}
            label="客户总数"
            value={stats.totalClients}
            loading={loading}
            onPress={() => router.push("/(tabs)/clients")}
          />
          <StatCard
            icon={<UserPlus size={20} color="#16a34a" />}
            label="本月新增"
            value={stats.newThisMonth}
            loading={loading}
            onPress={() => router.push("/(tabs)/clients")}
          />
          <StatCard
            icon={<Eye size={20} color="#9333ea" />}
            label="访客"
            value={stats.activeViewers}
            loading={loading}
            subtitle="近7天"
          />
          <StatCard
            icon={<TrendingUp size={20} color="#ea580c" />}
            label="感兴趣"
            value={stats.inquiries}
            loading={loading}
            subtitle="近7天"
          />
        </View>

        {/* Share Link */}
        {userId && (
          <View style={s.section}>
            <TouchableOpacity style={s.shareBtn} activeOpacity={0.7}>
              <Share2 size={16} color="#fff" />
              <Text style={s.shareBtnText}>生成推广链接</Text>
            </TouchableOpacity>
            <Text style={s.shareHint}>
              新客户打开链接填写信息后自动创建
            </Text>
          </View>
        )}

        {/* Quick Actions */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>快捷入口</Text>
          <View style={s.menuCard}>
            <MenuItem
              icon={<ClipboardList size={20} color="#2563eb" />}
              label="工作台"
              subtitle="查看今日待办和跟进"
              onPress={() => router.push("/(tabs)/dashboard")}
            />
            <MenuItem
              icon={<Users size={20} color="#16a34a" />}
              label="客户管理"
              subtitle="查看和管理所有客户"
              onPress={() => router.push("/(tabs)/clients")}
            />
            <MenuItem
              icon={<Search size={20} color="#9333ea" />}
              label="房源搜索"
              subtitle="搜索并分享给客户"
              onPress={() => router.push("/(tabs)/search")}
            />
            <MenuItem
              icon={<Eye size={20} color="#ea580c" />}
              label="访客管理"
              subtitle="查看客户浏览动态"
            />
          </View>
        </View>

        <Text style={s.footer}>Estate Epic v1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  subtitle?: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={s.statCard}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={s.statCardHeader}>
        {icon}
        <Text style={s.statLabel}>{label}</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="small" color="#9ca3af" />
      ) : (
        <Text style={s.statValue}>{value}</Text>
      )}
      {subtitle && <Text style={s.statSubtitle}>{subtitle}</Text>}
    </TouchableOpacity>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={s.menuItem}
      onPress={onPress}
      activeOpacity={0.6}
    >
      {icon}
      <View style={s.menuItemText}>
        <Text style={s.menuItemLabel}>{label}</Text>
        <Text style={s.menuItemSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight size={16} color="#d1d5db" />
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f8fafc" },
  scroll: { flex: 1 },
  content: { paddingBottom: 32 },
  headerBg: {
    backgroundColor: "#1e293b",
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 56,
  },
  headerRow: { flexDirection: "row", alignItems: "center" },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "700", color: "#fff" },
  headerInfo: { flex: 1, marginLeft: 14 },
  headerName: { fontSize: 20, fontWeight: "700", color: "#fff" },
  headerUsername: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    marginTop: 1,
  },
  headerTitle: { fontSize: 13, color: "#93c5fd", marginTop: 2 },
  editBtn: {
    padding: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    marginTop: -32,
    gap: 10,
  },
  statCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  statCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statLabel: { fontSize: 12, color: "#6b7280" },
  statValue: { fontSize: 24, fontWeight: "700", color: "#111827" },
  statSubtitle: { fontSize: 10, color: "#9ca3af", marginTop: 2 },
  section: { paddingHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    marginBottom: 10,
    paddingLeft: 4,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#2563eb",
  },
  shareBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  shareHint: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
    marginTop: 6,
  },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  menuItemText: { flex: 1 },
  menuItemLabel: { fontSize: 14, fontWeight: "500", color: "#111827" },
  menuItemSubtitle: { fontSize: 12, color: "#9ca3af", marginTop: 1 },
  footer: {
    textAlign: "center",
    fontSize: 12,
    color: "#d1d5db",
    marginTop: 24,
  },
});
