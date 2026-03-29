import { useEffect, useState, useContext, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Clock, MessageCircleHeart, ChevronRight, ChevronDown, Heart, Home } from "lucide-react";
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
  zpid: string;
  address: string;
  price: number;
  image_url: string | null;
  action: string;
  created_at: string;
}

interface ListingView {
  zpid: string;
  address: string;
  price: number;
  imageUrl: string | null;
  isInquiry: boolean;
  isFavorite: boolean;
  viewCount: number;
  lastViewedAt: string;
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
  listings: ListingView[];
}

type TabKey = "all" | "active" | "focus" | "longterm" | "closed";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "所有访客" },
  { key: "active", label: "活跃客户" },
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

function formatPrice(price: number): string {
  if (price >= 1000000) return `$${(price / 1000000).toFixed(1)}M`;
  if (price >= 1000) return `$${(price / 1000).toFixed(0)}K`;
  if (price > 0) return `$${price}`;
  return "";
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(1, Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / 86400000));
}

const FOCUS_STATUSES = new Set(["看房中", "意向强烈", "已下Offer"]);
const LONGTERM_STATUSES = new Set(["新客户", "遇到困难/停滞", "暂缓/冷淡"]);
const CLOSED_STATUSES = new Set(["已成交"]);

// ── Listing Slider Card ────────────────────────────────────

function ListingSliderCard({ listing }: { listing: ListingView }) {
  return (
    <a
      href={`https://www.zillow.com/homedetails/${listing.zpid}_zpid/`}
      target="_blank"
      rel="noopener noreferrer"
      className="shrink-0 w-36 bg-white rounded-xl border border-gray-100 overflow-hidden active:bg-gray-50"
    >
      {listing.imageUrl ? (
        <img src={listing.imageUrl} alt="" className="w-full h-20 object-cover" />
      ) : (
        <div className="w-full h-20 bg-gray-100 flex items-center justify-center">
          <Home className="h-5 w-5 text-gray-300" />
        </div>
      )}
      <div className="p-2">
        <p className="text-xs font-medium text-gray-900 truncate">
          {formatPrice(listing.price)}
        </p>
        <p className="text-[10px] text-gray-400 truncate">{listing.address}</p>
        <div className="flex items-center gap-1 mt-1">
          {listing.isInquiry && (
            <span className="text-[9px] text-green-700 bg-green-100 px-1 py-0.5 rounded font-medium">感兴趣</span>
          )}
          {listing.isFavorite && !listing.isInquiry && (
            <Heart className="h-2.5 w-2.5 text-red-500 fill-red-500" />
          )}
          {listing.viewCount > 1 && (
            <span className="text-[9px] text-gray-400">{listing.viewCount}次</span>
          )}
        </div>
      </div>
    </a>
  );
}

// ── Visitor Card ───────────────────────────────────────────

function VisitorCard({ visitor }: { visitor: VisitorInfo }) {
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  // Sort listings: inquiry first, then favorite, then by view count
  const sortedListings = useMemo(() =>
    [...visitor.listings].sort((a, b) => {
      if (a.isInquiry !== b.isInquiry) return a.isInquiry ? -1 : 1;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      return b.viewCount - a.viewCount;
    }),
  [visitor.listings]);

  const uniqueListings = sortedListings.length;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Main row — click to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 active:bg-gray-50 transition text-left"
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
          </div>
        </div>

        {/* Expand indicator */}
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Expanded: listing slider + client detail link */}
      {expanded && (
        <div className="border-t border-gray-50 px-4 py-3 bg-gray-50/50">
          {sortedListings.length > 0 && (
            <>
              <p className="text-xs text-gray-400 mb-2">浏览了 {uniqueListings} 套房源</p>
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {sortedListings.map((listing) => (
                  <ListingSliderCard key={listing.zpid} listing={listing} />
                ))}
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => navigate("/app/clients")}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg active:bg-blue-100 transition"
          >
            查看客户详情
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────

export default function VisitorsPage() {
  const userId = useContext(UserContext);

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

        // 2. Get all listing views (with full data for slider)
        const { data: views } = await supabase
          .from("client_listing_views")
          .select("client_id, zpid, address, price, image_url, action, created_at")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false });

        if (!views || views.length === 0) {
          setVisitors([]);
          setLoading(false);
          return;
        }

        // 3. Aggregate per client + per listing
        const clientAgg = new Map<string, {
          lastAt: string;
          firstAt: string;
          totalViews: number;
          hasInquiry: boolean;
          listings: Map<string, ListingView>;
        }>();

        for (const v of views as ViewRow[]) {
          let agg = clientAgg.get(v.client_id);
          if (!agg) {
            agg = {
              lastAt: v.created_at,
              firstAt: v.created_at,
              totalViews: 0,
              hasInquiry: false,
              listings: new Map(),
            };
            clientAgg.set(v.client_id, agg);
          }

          agg.totalViews++;
          agg.firstAt = v.created_at; // views ordered desc, last = earliest
          if (v.action === "inquiry") agg.hasInquiry = true;

          // Per-listing aggregation
          let listing = agg.listings.get(v.zpid);
          if (!listing) {
            listing = {
              zpid: v.zpid,
              address: v.address,
              price: v.price,
              imageUrl: v.image_url,
              isInquiry: v.action === "inquiry",
              isFavorite: v.action === "favorite",
              viewCount: 1,
              lastViewedAt: v.created_at,
            };
            agg.listings.set(v.zpid, listing);
          } else {
            listing.viewCount++;
            if (v.action === "inquiry") listing.isInquiry = true;
            if (v.action === "favorite") listing.isFavorite = true;
          }
        }

        // 4. Build visitor list
        const result: VisitorInfo[] = [];
        for (const [clientId, agg] of clientAgg) {
          const client = clientMap.get(clientId);
          if (!client) continue;
          result.push({
            clientId,
            clientName: client.remark_name || client.name || "未命名客户",
            clientStatus: client.status,
            lastActiveAt: agg.lastAt,
            firstVisitAt: agg.firstAt,
            totalDays: daysBetween(agg.firstAt, agg.lastAt),
            viewCount: agg.totalViews,
            hasInquiry: agg.hasInquiry,
            listings: Array.from(agg.listings.values()),
          });
        }

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

  // Active = visited in last 7 days
  const sevenDaysAgo = Date.now() - 7 * 86400000;

  const filtered = useMemo(() => {
    switch (activeTab) {
      case "active":
        return visitors.filter((v) => new Date(v.lastActiveAt).getTime() > sevenDaysAgo);
      case "focus":
        return visitors.filter((v) => FOCUS_STATUSES.has(v.clientStatus));
      case "longterm":
        return visitors.filter((v) => LONGTERM_STATUSES.has(v.clientStatus));
      case "closed":
        return visitors.filter((v) => CLOSED_STATUSES.has(v.clientStatus));
      default:
        return visitors;
    }
  }, [visitors, activeTab, sevenDaysAgo]);

  const tabCounts = useMemo(() => ({
    all: visitors.length,
    active: visitors.filter((v) => new Date(v.lastActiveAt).getTime() > sevenDaysAgo).length,
    focus: visitors.filter((v) => FOCUS_STATUSES.has(v.clientStatus)).length,
    longterm: visitors.filter((v) => LONGTERM_STATUSES.has(v.clientStatus)).length,
    closed: visitors.filter((v) => CLOSED_STATUSES.has(v.clientStatus)).length,
  }), [visitors, sevenDaysAgo]);

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
          <VisitorCard key={visitor.clientId} visitor={visitor} />
        ))}
      </div>
    </div>
  );
}
