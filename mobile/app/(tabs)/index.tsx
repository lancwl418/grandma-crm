import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Dimensions,
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
  LayoutDashboard,
  Home,
  Heart,
  MessageCircle,
} from "lucide-react-native";
import { supabase } from "@/lib/supabase";
import type { AgentProfile, Stats } from "@/types";

const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "https://grandma-crm.onrender.com";

interface RecentActivity {
  clientId: string;
  clientName: string;
  action: string;
  address: string;
  time: string;
  zpid?: string;
  imageUrl?: string;
}

// Group activities by client for card display
interface ClientActivity {
  clientId: string;
  clientName: string;
  listings: { address: string; action: string; time: string; imageUrl?: string }[];
}

const { width: SCREEN_W } = Dimensions.get("window");

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
  const [recentClients, setRecentClients] = useState<ClientActivity[]>([]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUserId(session.user.id);
        loadProfile(session.user.id);
        loadStats(session.user.id);
        loadRecentActivity(session.user.id);
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
    if (!supabase) { setLoading(false); return; }
    try {
      const { count: total } = await supabase
        .from("clients").select("id", { count: "exact", head: true }).eq("user_id", uid);
      const monthStart = new Date();
      monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
      const { count: newCount } = await supabase
        .from("clients").select("id", { count: "exact", head: true })
        .eq("user_id", uid).gte("created_at", monthStart.toISOString());

      const { data: myClients } = await supabase
        .from("clients").select("id").eq("user_id", uid);
      const myClientIds = (myClients ?? []).map((c: any) => c.id);

      let activeViewers = 0;
      let inquiries = 0;
      if (myClientIds.length > 0) {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: viewData } = await supabase
          .from("client_listing_views").select("client_id")
          .in("client_id", myClientIds).gte("created_at", weekAgo.toISOString());
        activeViewers = new Set((viewData ?? []).map((v: any) => v.client_id)).size;
        const { count: iqCount } = await supabase
          .from("client_listing_views").select("id", { count: "exact", head: true })
          .in("client_id", myClientIds).eq("action", "inquiry")
          .gte("created_at", weekAgo.toISOString());
        inquiries = iqCount ?? 0;
      }

      setStats({ totalClients: total ?? 0, newThisMonth: newCount ?? 0, activeViewers, inquiries });
    } catch (err) {
      console.error("loadStats error:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecentActivity = async (uid: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/browse/agent-activity/${uid}`);
      if (!res.ok) return;
      const data = await res.json();
      const rawActivities: any[] = data.activities || [];

      // Group by client
      const map = new Map<string, ClientActivity>();
      for (const a of rawActivities) {
        const cid = a.clientId;
        if (!map.has(cid)) {
          map.set(cid, { clientId: cid, clientName: a.clientName || "未知", listings: [] });
        }
        const client = map.get(cid)!;
        if (client.listings.length < 4) {
          client.listings.push({
            address: a.address || "",
            action: a.action || "view",
            time: a.createdAt || a.time || "",
            imageUrl: a.imageUrl || a.image_url || undefined,
          });
        }
      }
      setRecentClients(Array.from(map.values()).slice(0, 5));
    } catch {}
  };

  const displayName = profile.display_name || profile.username || "Agent";
  const initial = displayName[0]?.toUpperCase() ?? "A";
  const formatRelativeTime = (iso?: string) => {
    if (!iso) return "";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "刚刚";
    if (mins < 60) return `${mins}分钟前`;
    const hours = Math.floor(diff / 3600000);
    if (hours < 24) return `${hours}小时前`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}天前`;
    const d = new Date(iso);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 6) return "夜深了";
    if (h < 12) return "早上好";
    if (h < 18) return "下午好";
    return "晚上好";
  })();

  return (
    <View style={s.root}>
      <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scrollContent}>

          {/* ── Profile Header ── */}
          <View style={s.header}>
            <View>
              <Text style={s.greeting}>{greeting}</Text>
              <Text style={s.displayName}>{displayName}</Text>
              <Text style={s.title}>{profile.title || "房地产经纪人"}</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/profile")}
              activeOpacity={0.8}
            >
              <View style={s.avatar}>
                {profile.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
                ) : (
                  <Text style={s.avatarInitial}>{initial}</Text>
                )}
              </View>
            </TouchableOpacity>
          </View>

          {/* ── Stats Cards ── */}
          <View style={s.statsRow}>
            <TouchableOpacity style={s.statCardLarge} onPress={() => router.push("/(tabs)/clients")} activeOpacity={0.85}>
              <Text style={s.statNum}>{loading ? "–" : stats.totalClients}</Text>
              <Text style={s.statLabel}>客户总数</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.statCardLarge} onPress={() => router.push("/(tabs)/clients")} activeOpacity={0.85}>
              <Text style={[s.statNum, { color: "#16a34a" }]}>{loading ? "–" : stats.newThisMonth}</Text>
              <Text style={s.statLabel}>本月新增</Text>
            </TouchableOpacity>
          </View>
          <View style={s.statsRow}>
            <View style={s.statCardSmall}>
              <Eye size={16} color="#999" />
              <Text style={s.statSmallNum}>{loading ? "–" : stats.activeViewers}</Text>
              <Text style={s.statSmallLabel}>近7天访客</Text>
            </View>
            <View style={s.statCardSmall}>
              <TrendingUp size={16} color="#999" />
              <Text style={s.statSmallNum}>{loading ? "–" : stats.inquiries}</Text>
              <Text style={s.statSmallLabel}>近7天咨询</Text>
            </View>
          </View>

          {/* ── Quick Actions Grid ── */}
          <Text style={s.sectionLabel}>快捷操作</Text>
          <View style={s.actionsGrid}>
            <TouchableOpacity style={s.actionCard} onPress={() => router.push("/(tabs)/dashboard")} activeOpacity={0.85}>
              <View style={[s.actionIcon, { backgroundColor: "#000" }]}>
                <LayoutDashboard size={20} color="#fff" />
              </View>
              <Text style={s.actionTitle}>工作台</Text>
              <Text style={s.actionSub}>待办与跟进</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionCard} onPress={() => router.push("/(tabs)/clients")} activeOpacity={0.85}>
              <View style={[s.actionIcon, { backgroundColor: "#000" }]}>
                <Users size={20} color="#fff" />
              </View>
              <Text style={s.actionTitle}>客户管理</Text>
              <Text style={s.actionSub}>查看全部客户</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionCard} onPress={() => router.push("/(tabs)/search")} activeOpacity={0.85}>
              <View style={[s.actionIcon, { backgroundColor: "#000" }]}>
                <Search size={20} color="#fff" />
              </View>
              <Text style={s.actionTitle}>房源搜索</Text>
              <Text style={s.actionSub}>查找并分享</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.actionCard} activeOpacity={0.85}>
              <View style={[s.actionIcon, { backgroundColor: "#000" }]}>
                <Eye size={20} color="#fff" />
              </View>
              <Text style={s.actionTitle}>访客动态</Text>
              <Text style={s.actionSub}>浏览记录</Text>
            </TouchableOpacity>
          </View>

          {/* ── Recent Client Activity ── */}
          {recentClients.length > 0 && (
            <>
              <Text style={s.sectionLabel}>最近浏览</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 20, gap: 14 }}
              >
                {recentClients.map((client) => (
                  <TouchableOpacity
                    key={client.clientId}
                    style={s.visitorCard}
                    activeOpacity={0.85}
                    onPress={() => router.push("/(tabs)/clients")}
                  >
                    {/* Client avatar + name */}
                    <View style={s.visitorHeader}>
                      <View style={s.visitorAvatar}>
                        <Text style={s.visitorAvatarText}>
                          {client.clientName[0]}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={s.visitorName}>{client.clientName}</Text>
                        <Text style={s.visitorTime}>
                          {formatRelativeTime(client.listings[0]?.time)}
                        </Text>
                      </View>
                    </View>

                    {/* Listing thumbnails */}
                    <View style={s.visitorListings}>
                      {client.listings.map((listing, i) => (
                        <View key={i} style={s.visitorListingItem}>
                          {listing.imageUrl ? (
                            <Image
                              source={{ uri: listing.imageUrl }}
                              style={s.visitorListingImg}
                              resizeMode="cover"
                            />
                          ) : (
                            <View style={[s.visitorListingImg, s.visitorListingPlaceholder]}>
                              <Home size={14} color="#ddd" />
                            </View>
                          )}
                          {listing.action === "favorite" && (
                            <View style={s.visitorActionBadge}>
                              <Heart size={8} color="#ef4444" />
                            </View>
                          )}
                          {listing.action === "inquiry" && (
                            <View style={[s.visitorActionBadge, { backgroundColor: "#dcfce7" }]}>
                              <MessageCircle size={8} color="#16a34a" />
                            </View>
                          )}
                        </View>
                      ))}
                    </View>

                    {/* Summary */}
                    <Text style={s.visitorSummary}>
                      浏览了 {client.listings.length} 套房源
                      {client.listings.some(l => l.action === "inquiry") ? " · 有咨询" : ""}
                      {client.listings.some(l => l.action === "favorite") ? " · 有收藏" : ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}

          {/* ── Share Link ── */}
          {userId && (
            <TouchableOpacity style={s.shareCard} activeOpacity={0.85}>
              <View style={s.shareLeft}>
                <Share2 size={20} color="#fff" />
                <View>
                  <Text style={s.shareTitle}>生成推广链接</Text>
                  <Text style={s.shareSub}>客户打开链接后自动录入</Text>
                </View>
              </View>
              <ChevronRight size={18} color="rgba(255,255,255,0.5)" />
            </TouchableOpacity>
          )}

          {/* ── Footer ── */}
          <Text style={s.footer}>Estate Epic v1.0</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const CARD_GAP = 12;
const HALF_W = (SCREEN_W - 40 - CARD_GAP) / 2;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  scrollContent: { paddingBottom: 40 },

  // Header
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24,
  },
  greeting: { fontSize: 14, color: "#aaa", marginBottom: 2 },
  displayName: { fontSize: 28, fontWeight: "800", color: "#000", lineHeight: 34 },
  title: { fontSize: 13, color: "#bbb", marginTop: 4 },
  avatar: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: "#f0f0f0", alignItems: "center", justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  avatarInitial: { fontSize: 20, fontWeight: "700", color: "#666" },

  // Stats
  statsRow: {
    flexDirection: "row", gap: CARD_GAP,
    paddingHorizontal: 20, marginBottom: CARD_GAP,
  },
  statCardLarge: {
    flex: 1, backgroundColor: "#f9f9f9", borderRadius: 20,
    paddingVertical: 24, paddingHorizontal: 20,
  },
  statNum: { fontSize: 36, fontWeight: "800", color: "#000" },
  statLabel: { fontSize: 13, color: "#999", marginTop: 4 },
  statCardSmall: {
    flex: 1, backgroundColor: "#f9f9f9", borderRadius: 20,
    paddingVertical: 16, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  statSmallNum: { fontSize: 20, fontWeight: "700", color: "#000" },
  statSmallLabel: { fontSize: 12, color: "#aaa", flex: 1 },

  // Actions
  sectionLabel: {
    fontSize: 16, fontWeight: "700", color: "#000",
    paddingHorizontal: 20, marginTop: 28, marginBottom: 14,
  },
  actionsGrid: {
    flexDirection: "row", flexWrap: "wrap", gap: CARD_GAP,
    paddingHorizontal: 20,
  },
  actionCard: {
    width: HALF_W, backgroundColor: "#f9f9f9", borderRadius: 20,
    padding: 18,
  },
  actionIcon: {
    width: 44, height: 44, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
  },
  actionTitle: { fontSize: 15, fontWeight: "700", color: "#000" },
  actionSub: { fontSize: 12, color: "#aaa", marginTop: 3 },

  // Share
  shareCard: {
    marginHorizontal: 20, marginTop: 24,
    backgroundColor: "#000", borderRadius: 20,
    paddingVertical: 20, paddingHorizontal: 20,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  shareLeft: { flexDirection: "row", alignItems: "center", gap: 14 },
  shareTitle: { fontSize: 15, fontWeight: "700", color: "#fff" },
  shareSub: { fontSize: 12, color: "rgba(255,255,255,0.5)", marginTop: 2 },

  // Visitor cards
  visitorCard: {
    width: 200, backgroundColor: "#f9f9f9", borderRadius: 20,
    padding: 16,
  },
  visitorHeader: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12,
  },
  visitorAvatar: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#000", alignItems: "center", justifyContent: "center",
  },
  visitorAvatarText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  visitorName: { fontSize: 14, fontWeight: "700", color: "#000" },
  visitorTime: { fontSize: 11, color: "#aaa", marginTop: 1 },
  visitorListings: {
    flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10,
  },
  visitorListingItem: { position: "relative" },
  visitorListingImg: {
    width: 52, height: 52, borderRadius: 10, backgroundColor: "#eee",
  },
  visitorListingPlaceholder: {
    alignItems: "center", justifyContent: "center",
  },
  visitorActionBadge: {
    position: "absolute", top: -3, right: -3,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: "#fee2e2", alignItems: "center", justifyContent: "center",
  },
  visitorSummary: { fontSize: 11, color: "#999" },

  // Footer
  footer: { textAlign: "center", fontSize: 12, color: "#ddd", marginTop: 32 },
});
