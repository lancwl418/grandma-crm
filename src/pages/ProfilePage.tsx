import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, TrendingUp, Eye, CalendarCheck, LogOut, ChevronRight, Bot, Search, ClipboardList } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/userContext";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface Stats {
  totalClients: number;
  newThisMonth: number;
  activeViewers: number;
  inquiries: number;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const userId = useContext(UserContext);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [stats, setStats] = useState<Stats>({ totalClients: 0, newThisMonth: 0, activeViewers: 0, inquiries: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Get user info
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setEmail(user.email ?? "");
        setDisplayName(
          user.user_metadata?.full_name ??
          user.user_metadata?.name ??
          user.email?.split("@")[0] ??
          "Agent"
        );
      }
    });

    // Fetch stats
    if (userId) {
      fetchStats(userId).then((s) => {
        setStats(s);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [userId]);

  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
  };

  const initial = displayName?.[0]?.toUpperCase() ?? email?.[0]?.toUpperCase() ?? "A";

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto pb-20">
      {/* Profile Header */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-8 pb-10 text-white">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {initial}
          </div>
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            <p className="text-blue-200 text-sm">{email}</p>
            <p className="text-blue-200 text-xs mt-0.5">房地产经纪人</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-5">
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={<Users className="h-5 w-5 text-blue-600" />}
            label="客户总数"
            value={stats.totalClients}
            loading={loading}
          />
          <StatCard
            icon={<UserPlus className="h-5 w-5 text-green-600" />}
            label="本月新增"
            value={stats.newThisMonth}
            loading={loading}
          />
          <StatCard
            icon={<Eye className="h-5 w-5 text-purple-600" />}
            label="活跃访客"
            value={stats.activeViewers}
            loading={loading}
            subtitle="近7天"
          />
          <StatCard
            icon={<TrendingUp className="h-5 w-5 text-orange-600" />}
            label="感兴趣"
            value={stats.inquiries}
            loading={loading}
            subtitle="近7天"
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">快捷入口</h3>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <MenuItem
            icon={<Users className="h-5 w-5 text-blue-600" />}
            label="客户管理"
            subtitle="查看和管理所有客户"
            onClick={() => navigate("/app/clients")}
          />
          <MenuItem
            icon={<Search className="h-5 w-5 text-purple-600" />}
            label="房源搜索"
            subtitle="Zillow 房源搜索"
            onClick={() => navigate("/app/assistant")}
          />
          <MenuItem
            icon={<Bot className="h-5 w-5 text-indigo-600" />}
            label="AI 助理"
            subtitle="智能客户管理助手"
            onClick={() => navigate("/app/assistant")}
          />
          <MenuItem
            icon={<ClipboardList className="h-5 w-5 text-green-600" />}
            label="今日待办"
            subtitle="查看待处理任务"
            onClick={() => navigate("/app")}
          />
        </div>
      </div>

      {/* Logout */}
      <div className="px-4 mt-6">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 py-3 bg-white rounded-xl border border-gray-200 text-red-500 text-sm font-medium active:bg-red-50 transition"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
      </div>

      <p className="text-center text-xs text-gray-300 mt-6">GrandmaCRM v1.0</p>
    </div>
  );
}

// ── Sub Components ──────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  loading,
  subtitle,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
  subtitle?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">
        {loading ? "—" : value}
      </div>
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  subtitle,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition"
    >
      {icon}
      <div className="flex-1 text-left">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-gray-300" />
    </button>
  );
}

// ── Data Fetching ───────────────────────────────────────────

async function fetchStats(userId: string): Promise<Stats> {
  const result: Stats = { totalClients: 0, newThisMonth: 0, activeViewers: 0, inquiries: 0 };

  if (!supabase) return result;

  try {
    // Total clients
    const { count: total } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    result.totalClients = total ?? 0;

    // New this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: newCount } = await supabase
      .from("clients")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString());
    result.newThisMonth = newCount ?? 0;

    // Active viewers (clients with browse activity in last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { data: viewData } = await supabase
      .from("client_listing_views")
      .select("client_id")
      .gte("created_at", weekAgo.toISOString());
    const uniqueViewers = new Set((viewData ?? []).map((v: any) => v.client_id));
    result.activeViewers = uniqueViewers.size;

    // Inquiries in last 7 days
    const { count: inquiryCount } = await supabase
      .from("client_listing_views")
      .select("id", { count: "exact", head: true })
      .eq("action", "inquiry")
      .gte("created_at", weekAgo.toISOString());
    result.inquiries = inquiryCount ?? 0;
  } catch (err) {
    console.error("[ProfilePage] fetchStats error:", err);
  }

  return result;
}
