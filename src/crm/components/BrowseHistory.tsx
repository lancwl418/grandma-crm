import { useEffect, useState } from "react";
import { Eye, Heart, Clock, Home, MessageCircleHeart } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface BrowseView {
  zpid: string;
  address: string;
  price: number;
  action: string;
  image_url: string | null;
  created_at: string;
}

type GroupedView = BrowseView & { viewCount: number; hasFavorite: boolean; hasInquiry: boolean };

function formatTime(iso: string): string {
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
  return `$${price}`;
}

const COLLAPSED_COUNT = 5;

function ListingRow({ v }: { v: GroupedView }) {
  return (
    <a
      href={`https://www.zillow.com/homedetails/${v.zpid}_zpid/`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 py-2 border-b border-blue-50 last:border-0 hover:bg-blue-50/50 rounded-lg px-1 -mx-1 transition"
    >
      {v.image_url ? (
        <img src={v.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
      ) : (
        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <Home className="h-4 w-4 text-gray-300" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-blue-700 underline-offset-2 hover:underline truncate">{v.address || `Listing #${v.zpid}`}</p>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
          <span>{formatPrice(v.price)}</span>
          <span className="flex items-center gap-0.5">
            <Clock className="h-3 w-3" />
            {formatTime(v.created_at)}
          </span>
          {v.viewCount > 1 && (
            <span className="flex items-center gap-0.5">
              <Eye className="h-3 w-3" />
              {v.viewCount}次
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {v.hasInquiry && (
          <span className="flex items-center gap-0.5 text-[10px] text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full font-medium">
            <MessageCircleHeart className="h-3 w-3" />
            感兴趣
          </span>
        )}
        {v.hasFavorite && !v.hasInquiry && (
          <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
        )}
      </div>
    </a>
  );
}

export default function BrowseHistory({ clientId }: { clientId: string }) {
  const [views, setViews] = useState<BrowseView[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "interested">("all");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/browse/history/${clientId}`)
      .then((res) => res.json())
      .then((data) => setViews(data.views ?? []))
      .catch(() => setViews([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return null;
  if (views.length === 0) return null;

  // Group by unique zpid
  const uniqueViews = new Map<string, GroupedView>();
  for (const v of views) {
    const existing = uniqueViews.get(v.zpid);
    if (!existing) {
      uniqueViews.set(v.zpid, { ...v, viewCount: 1, hasFavorite: v.action === "favorite", hasInquiry: v.action === "inquiry" });
    } else {
      existing.viewCount++;
      if (v.action === "favorite") existing.hasFavorite = true;
      if (v.action === "inquiry") existing.hasInquiry = true;
    }
  }

  const allItems = Array.from(uniqueViews.values()).sort((a, b) => {
    if (a.hasInquiry !== b.hasInquiry) return a.hasInquiry ? -1 : 1;
    if (a.hasFavorite !== b.hasFavorite) return a.hasFavorite ? -1 : 1;
    return 0;
  });

  const interestedItems = allItems.filter((v) => v.hasInquiry || v.hasFavorite);
  const displayItems = tab === "interested" ? interestedItems : allItems;
  const shouldCollapse = displayItems.length > COLLAPSED_COUNT && !expanded;
  const visibleItems = shouldCollapse ? displayItems.slice(0, COLLAPSED_COUNT) : displayItems;
  const hiddenCount = displayItems.length - COLLAPSED_COUNT;

  return (
    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-blue-600" />
          <span className="font-semibold text-gray-900 text-sm">房源动态</span>
          <span className="text-xs text-gray-400">({allItems.length})</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-3">
        <button
          type="button"
          onClick={() => { setTab("all"); setExpanded(false); }}
          className={`px-3 py-1 text-xs rounded-full font-medium transition ${
            tab === "all" ? "bg-blue-600 text-white" : "bg-white text-gray-500 border border-gray-200"
          }`}
        >
          全部浏览 ({allItems.length})
        </button>
        <button
          type="button"
          onClick={() => { setTab("interested"); setExpanded(false); }}
          className={`px-3 py-1 text-xs rounded-full font-medium transition ${
            tab === "interested" ? "bg-green-600 text-white" : "bg-white text-gray-500 border border-gray-200"
          }`}
        >
          感兴趣 ({interestedItems.length})
        </button>
      </div>

      {/* List */}
      {displayItems.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">
          {tab === "interested" ? "暂无感兴趣的房源" : "暂无浏览记录"}
        </p>
      ) : (
        <div className="space-y-1">
          {visibleItems.map((v) => (
            <ListingRow key={v.zpid} v={v} />
          ))}

          {/* Expand / Collapse */}
          {displayItems.length > COLLAPSED_COUNT && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-full text-center py-2 text-xs text-blue-600 font-medium active:text-blue-700"
            >
              {expanded ? "收起" : `展开更多 (${hiddenCount} 条)`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
