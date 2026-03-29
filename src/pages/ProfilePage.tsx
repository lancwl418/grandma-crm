import { useEffect, useState, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Users, UserPlus, TrendingUp, Eye, LogOut, ChevronRight, Bot, Search, ClipboardList, Pencil, Check, Camera, Link, Share2 } from "lucide-react";
import ActivityFeed from "@/components/ActivityFeed";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/userContext";

interface Stats {
  totalClients: number;
  newThisMonth: number;
  activeViewers: number;
  inquiries: number;
}

interface AgentProfile {
  username: string;
  display_name: string;
  title: string;
  phone: string;
  wechat: string;
  email: string;
  avatar_url: string;
}

const DEFAULT_PROFILE: AgentProfile = {
  username: "",
  display_name: "",
  title: "房地产经纪人",
  phone: "",
  wechat: "",
  email: "",
  avatar_url: "",
};

export default function ProfilePage() {
  const navigate = useNavigate();
  const userId = useContext(UserContext);
  const [authEmail, setAuthEmail] = useState("");
  const [profile, setProfile] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [stats, setStats] = useState<Stats>({ totalClients: 0, newThisMonth: 0, activeViewers: 0, inquiries: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AgentProfile>(DEFAULT_PROFILE);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    // Get auth email
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.email) setAuthEmail(user.email);
    });

    // Load profile
    supabase
      .from("agent_profiles")
      .select("*")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          const p = {
            username: data.username || "",
            display_name: data.display_name || "",
            title: data.title || "房地产经纪人",
            phone: data.phone || "",
            wechat: data.wechat || "",
            email: data.email || "",
            avatar_url: data.avatar_url || "",
          };
          setProfile(p);
          setDraft(p);
        }
      });

    // Fetch stats
    fetchStats(userId).then((s) => {
      setStats(s);
      setLoading(false);
    });
  }, [userId]);

  const displayName = profile.display_name || authEmail?.split("@")[0] || "Agent";
  const initial = displayName[0]?.toUpperCase() ?? "A";

  const handleSave = useCallback(async () => {
    if (!supabase || !userId) return;
    setSaving(true);
    const { error } = await supabase
      .from("agent_profiles")
      .upsert({
        user_id: userId,
        display_name: draft.display_name,
        title: draft.title,
        phone: draft.phone,
        wechat: draft.wechat,
        email: draft.email || authEmail,
        avatar_url: draft.avatar_url,
      });
    setSaving(false);
    if (!error) {
      setProfile(draft);
      setEditing(false);
      setToast("保存成功");
      setTimeout(() => setToast(""), 2000);
    }
  }, [userId, draft, authEmail]);

  const handleAvatarUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // Try Supabase Storage first
    if (supabase) {
      const ext = file.name.split(".").pop();
      const path = `${userId}.${ext}`;

      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });

      if (!error) {
        const { data } = supabase.storage.from("avatars").getPublicUrl(path);
        if (data?.publicUrl) {
          setDraft((prev) => ({ ...prev, avatar_url: data.publicUrl + "?t=" + Date.now() }));
          setToast("头像已上传");
          setTimeout(() => setToast(""), 2000);
          return;
        }
      }
      console.error("Storage upload failed:", error?.message);
    }

    // Fallback: convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      setDraft((prev) => ({ ...prev, avatar_url: reader.result as string }));
      setToast("头像已更新（请点保存）");
      setTimeout(() => setToast(""), 2000);
    };
    reader.readAsDataURL(file);
  }, [userId]);

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  // ── Edit Modal ──────────────────────────────────────────────

  if (editing) {
    return (
      <div className="h-full w-full bg-slate-50 overflow-y-auto pb-20">
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
          <button onClick={() => setEditing(false)} className="text-sm text-gray-500">取消</button>
          <h2 className="text-base font-semibold">编辑资料</h2>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-sm text-blue-600 font-medium disabled:text-gray-300"
          >
            {saving ? "保存中..." : "保存"}
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              {draft.avatar_url ? (
                <img src={draft.avatar_url} alt="" className="w-20 h-20 rounded-full object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
                  {initial}
                </div>
              )}
              <label className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center cursor-pointer">
                <Camera className="h-3.5 w-3.5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
              </label>
            </div>
          </div>

          {/* Fields */}
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {/* Username — read only */}
            <div className="flex items-center px-4 py-3">
              <span className="w-16 text-sm text-gray-500 shrink-0">用户名</span>
              <span className="flex-1 text-sm text-gray-400 text-right">{draft.username || "—"}</span>
            </div>
            <ProfileField label="显示名" value={draft.display_name} placeholder="显示名称"
              onChange={(v) => setDraft((p) => ({ ...p, display_name: v }))} />
            <ProfileField label="职称" value={draft.title} placeholder="房地产经纪人"
              onChange={(v) => setDraft((p) => ({ ...p, title: v }))} />
            <ProfileField label="电话" value={draft.phone} placeholder="联系电话" type="tel"
              onChange={(v) => setDraft((p) => ({ ...p, phone: v }))} />
            <ProfileField label="微信" value={draft.wechat} placeholder="微信号"
              onChange={(v) => setDraft((p) => ({ ...p, wechat: v }))} />
            <ProfileField label="邮箱" value={draft.email || authEmail} placeholder="电子邮箱" type="email"
              onChange={(v) => setDraft((p) => ({ ...p, email: v }))} />
          </div>
        </div>
      </div>
    );
  }

  // ── Main View ───────────────────────────────────────────────

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto pb-20">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-green-600 text-white text-sm rounded-lg shadow-lg flex items-center gap-1.5">
          <Check className="h-4 w-4" /> {toast}
        </div>
      )}

      {/* Profile Header */}
      <div
        className="overflow-hidden px-6 pt-6 pb-14 text-white bg-cover bg-center"
        style={{
          backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80')`,
        }}
      >
        <div className="flex items-center gap-4">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white/30" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
              {initial}
            </div>
          )}
          <div>
            <h1 className="text-xl font-bold">{displayName}</h1>
            {profile.username && <p className="text-white/60 text-xs">@{profile.username}</p>}
            <p className="text-blue-200 text-sm">{profile.title || "房地产经纪人"}</p>
            {profile.phone && <p className="text-blue-200 text-xs mt-0.5">{profile.phone}</p>}
          </div>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ml-auto self-start p-2 bg-white/20 rounded-lg active:bg-white/30"
          >
            <Pencil className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-8">
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Users className="h-5 w-5 text-blue-600" />} label="客户总数" value={stats.totalClients} loading={loading} onClick={() => navigate("/app/clients")} />
          <StatCard icon={<UserPlus className="h-5 w-5 text-green-600" />} label="本月新增" value={stats.newThisMonth} loading={loading} onClick={() => navigate("/app/clients")} />
          <StatCard icon={<Eye className="h-5 w-5 text-purple-600" />} label="访客" value={stats.activeViewers} loading={loading} subtitle="近7天" onClick={() => navigate("/app/visitors")} />
          <StatCard icon={<TrendingUp className="h-5 w-5 text-orange-600" />} label="感兴趣" value={stats.inquiries} loading={loading} subtitle="近7天" onClick={() => navigate("/app/visitors")} />
        </div>
      </div>

      {/* Activity Feed */}
      <ActivityFeed />

      {/* Share Link */}
      {userId && (
        <div className="px-4 mt-6">
          <button
            type="button"
            onClick={() => {
              const link = `${window.location.origin}/browse/new/${userId}`;
              navigator.clipboard.writeText(link);
              setToast("推广链接已复制");
              setTimeout(() => setToast(""), 2000);
            }}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-sm active:from-blue-700 active:to-indigo-700 transition shadow-sm"
          >
            <Share2 className="h-4 w-4" />
            生成推广链接
          </button>
          <p className="text-[10px] text-gray-400 text-center mt-1.5">新客户打开链接填写信息后自动创建</p>
        </div>
      )}

      {/* Quick Actions */}
      <div className="px-4 mt-6">
        <h3 className="text-sm font-semibold text-gray-500 mb-3 px-1">快捷入口</h3>
        <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
          <MenuItem icon={<Users className="h-5 w-5 text-blue-600" />} label="客户管理" subtitle="查看和管理所有客户" onClick={() => navigate("/app/clients")} />
          <MenuItem icon={<Search className="h-5 w-5 text-purple-600" />} label="房源搜索" subtitle="搜索并分享给客户" onClick={() => navigate("/app/search")} />
          <MenuItem icon={<Bot className="h-5 w-5 text-indigo-600" />} label="AI 助理" subtitle="智能客户管理助手" onClick={() => navigate("/app/assistant")} />
          <MenuItem icon={<Eye className="h-5 w-5 text-green-600" />} label="访客管理" subtitle="查看客户浏览动态" onClick={() => navigate("/app/visitors")} />
        </div>
      </div>

      <p className="text-center text-xs text-gray-300 mt-6">Estate Epic v1.0</p>
    </div>
  );
}

// ── Sub Components ──────────────────────────────────────────

function ProfileField({
  label, value, placeholder, type = "text", onChange,
}: {
  label: string; value: string; placeholder: string; type?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center px-4 py-3">
      <span className="w-16 text-sm text-gray-500 shrink-0">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 text-sm text-gray-900 outline-none bg-transparent text-right"
      />
    </div>
  );
}

function StatCard({ icon, label, value, loading, subtitle, onClick }: {
  icon: React.ReactNode; label: string; value: number; loading: boolean; subtitle?: string; onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm text-left active:bg-gray-50 transition"
    >
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{loading ? "—" : value}</div>
      {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
    </button>
  );
}

function MenuItem({ icon, label, subtitle, onClick }: {
  icon: React.ReactNode; label: string; subtitle: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition">
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
    const { count: total } = await supabase
      .from("clients").select("id", { count: "exact", head: true }).eq("user_id", userId);
    result.totalClients = total ?? 0;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const { count: newCount } = await supabase
      .from("clients").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", monthStart.toISOString());
    result.newThisMonth = newCount ?? 0;

    // Get this agent's client IDs first
    const { data: myClients } = await supabase
      .from("clients").select("id").eq("user_id", userId);
    const myClientIds = (myClients ?? []).map((c: any) => c.id);

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    if (myClientIds.length > 0) {
      const { data: viewData } = await supabase
        .from("client_listing_views").select("client_id")
        .in("client_id", myClientIds)
        .gte("created_at", weekAgo.toISOString());
      result.activeViewers = new Set((viewData ?? []).map((v: any) => v.client_id)).size;

      const { count: inquiryCount } = await supabase
        .from("client_listing_views").select("id", { count: "exact", head: true })
        .in("client_id", myClientIds)
        .eq("action", "inquiry").gte("created_at", weekAgo.toISOString());
      result.inquiries = inquiryCount ?? 0;
    }
  } catch (err) {
    console.error("[ProfilePage] fetchStats error:", err);
  }
  return result;
}
