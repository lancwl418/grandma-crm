import { useEffect, useState, useContext, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Clock, MessageCircleHeart, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/userContext";

// ── Types ──────────────────────────────────────────────────

interface ClientRow {
  id: string;
  remark_name: string;
  name: string | null;
  status: string;
}

interface ViewRow {
  client_id: string;
  action: string;
  created_at: string;
}

interface VisitorInfo {
  clientId: string;
  clientName: string;
  clientStatus: string;
  lastActiveAt: string;
  firstVisitAt: string;
  totalDays: number;
  viewCount: number;
  hasInquiry: boolean;
}

type TabKey = "all" | "focus" | "longterm" | "closed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "所有访客" },
  { key: "focus", label: "当前重点" },
  { key: "longterm", label: "长期跟踪" },
  { key: "closed", label: "已成交" },
];

// ── Helpers ────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / 86400000));
}

// Focus statuses: actively looking
const FOCUS_STATUSES = new Set(["看房中", "意向强烈", "已下Offer"]);
const LONGTERM_STATUSES = new Set(["新客户", "遇到困难/停滞", "暂缓/冷淡"]);
const CLOSED_STATUSES = new Set(["已成交"]);

// ── Component ──────────────────────────────────────────────

export default function VisitorsPage() {
  const userId = useContext(UserContext);
  const navigate = useNavigate();

  const [visitors, setVisitors] = useState<VisitorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("all");

  useEffect(() => {
    if (!supabase || !userId) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        // 1. Get all clients for this agent
        const { data: clients } = await supabase
          .from("clients")
          .select("id, remark_name, name, status")
          .eq("user_id", userId);

        if (!clients || clients.length === 0) {
          setVisitors([]);
          setLoading(false);
          return;
        }

        const clientMap = new Map<string, ClientRow>();
        const clientIds: string[] = [];
        for (const c of clients as ClientRow[]) {
          clientMap.set(c.id, c);
          clientIds.push(c.id);
        }

        // 2. Get all listing views for these clients
        const { data: views } = await supabase
          .from("client_listing_views")
          .select("client_id, action, created_at")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false });

        if (!views || views.length === 0) {
          setVisitors([]);
          setLoading(false);
          return;
        }

        // 3. Aggregate per client
        const agg = new Map<string, {
          lastAt: string;
          firstAt: string;
          count: number;
          hasInquiry: boolean;
        }>();

        for (const v of views as ViewRow[]) {
          const existing = agg.get(v.client_id);
          if (!existing) {
            agg.set(v.client_id, {
              lastAt: v.created_at,
              firstAt: v.created_at,
              count: 1,
              hasInquiry: v.action === "inquiry",
            });
          } else {
            existing.count++;
            if (v.action === "inquiry") existing.hasInquiry = true;
            // views are ordered desc, so first seen = last in iteration
            existing.firstAt = v.created_at;
          }
        }

        // 4. Build visitor list
        const result: VisitorInfo[] = [];
        for (const [clientId, data] of agg) {
          const client = clientMap.get(clientId);
          if (!client) continue;
          result.push({
            clientId,
            clientName: client.remark_name || client.name || "未命名客户",
            clientStatus: client.status,
            lastActiveAt: data.lastAt,
            firstVisitAt: data.firstAt,
            totalDays: daysBetween(data.firstAt, data.lastAt),
            viewCount: data.count,
            hasInquiry: data.hasInquiry,
          });
        }

        // Sort by last active (most recent first)
        result.sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
        setVisitors(result);
      } catch (err) {
        console.error("[VisitorsPage] fetch error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  // ── Filtered list ────────────────────────────────────────

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "focus":
        return visitors.filter((v) => FOCUS_STATUSES.has(v.clientStatus));
      case "longterm":
        return visitors.filter((v) => LONGTERM_STATUSES.has(v.clientStatus));
      case "closed":
        return visitors.filter((v) => CLOSED_STATUSES.has(v.clientStatus));
      default:
        return visitors;
    }
  }, [visitors, activeTab]);

  // ── Tab counts ───────────────────────────────────────────

  const tabCounts = useMemo(() => ({
    all: visitors.length,
    focus: visitors.filter((v) => FOCUS_STATUSES.has(v.clientStatus)).length,
    longterm: visitors.filter((v) => LONGTERM_STATUSES.has(v.clientStatus)).length,
    closed: visitors.filter((v) => CLOSED_STATUSES.has(v.clientStatus)).length,
  }), [visitors]);

  // ── Render ───────────────────────────────────────────────

  return (
    <div className="h-full w-full bg-slate-50 overflow-y-auto pb-20">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900">访客</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          浏览过房源的客户 ({visitors.length})
        </p>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b px-4 py-2 flex gap-2 overflow-x-auto sticky top-[53px] z-10">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-1.5 text-xs rounded-full font-medium transition whitespace-nowrap ${
              activeTab === tab.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            {tab.label} ({tabCounts[tab.key]})
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {loading && (
          <div className="text-center py-12 text-gray-400 text-sm">加载中...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-12">
            <Eye className="h-10 w-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">暂无访客数据</p>
            <p className="text-xs text-gray-300 mt-1">客户浏览房源后会出现在这里</p>
          </div>
        )}

        {filtered.map((visitor) => (
          <button
            key={visitor.clientId}
            type="button"
            onClick={() => navigate("/app/clients")}
            className="w-full bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3 active:bg-gray-50 transition text-left"
          >
            {/* Avatar */}
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-600 shrink-0">
              {visitor.clientName[0]}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-900 truncate">
                  {visitor.clientName}
                </span>
                {visitor.hasInquiry && (
                  <span className="flex items-center gap-0.5 text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full font-medium shrink-0">
                    <MessageCircleHeart className="h-3 w-3" />
                    感兴趣
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatRelativeTime(visitor.lastActiveAt)}
                </span>
                <span className="flex items-center gap-0.5">
                  <Eye className="h-3 w-3" />
                  {visitor.viewCount} 条浏览
                </span>
                {visitor.totalDays > 1 && (
                  <span>跟踪 {visitor.totalDays} 天</span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
