import { useEffect, useState } from "react";
import { Eye, Heart, Clock, Home } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

interface BrowseView {
  zpid: string;
  address: string;
  price: number;
  action: string;
  created_at: string;
}

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

export default function BrowseHistory({ clientId }: { clientId: string }) {
  const [views, setViews] = useState<BrowseView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/browse/history/${clientId}`)
      .then((res) => res.json())
      .then((data) => setViews(data.views ?? []))
      .catch(() => setViews([]))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return null;
  if (views.length === 0) return null;

  // Group by unique zpid, keep latest per listing
  const uniqueViews = new Map<string, BrowseView & { viewCount: number; hasFavorite: boolean }>();
  for (const v of views) {
    const existing = uniqueViews.get(v.zpid);
    if (!existing) {
      uniqueViews.set(v.zpid, { ...v, viewCount: 1, hasFavorite: v.action === "favorite" });
    } else {
      existing.viewCount++;
      if (v.action === "favorite") existing.hasFavorite = true;
    }
  }

  const grouped = Array.from(uniqueViews.values());

  return (
    <div className="bg-white p-4 sm:p-5 rounded-[24px] shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <Home className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-gray-900 text-sm">房源浏览记录</span>
        <span className="text-xs text-gray-400">({grouped.length} 套)</span>
      </div>

      <div className="space-y-2">
        {grouped.map((v) => (
          <div
            key={v.zpid}
            className="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800 truncate">{v.address || `Listing #${v.zpid}`}</p>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-400">
                <span>{formatPrice(v.price)}</span>
                <span className="flex items-center gap-0.5">
                  <Clock className="h-3 w-3" />
                  {formatTime(v.created_at)}
                </span>
                {v.viewCount > 1 && (
                  <span className="flex items-center gap-0.5">
                    <Eye className="h-3 w-3" />
                    看了 {v.viewCount} 次
                  </span>
                )}
              </div>
            </div>
            {v.hasFavorite && (
              <Heart className="h-4 w-4 text-red-500 fill-red-500 shrink-0 mt-0.5" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
