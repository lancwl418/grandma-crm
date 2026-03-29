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
  const uniqueViews = new Map<string, BrowseView & { viewCount: number; hasFavorite: boolean; hasInquiry: boolean }>();
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

  // Sort: inquiries first, then favorites, then views
  const grouped = Array.from(uniqueViews.values()).sort((a, b) => {
    if (a.hasInquiry !== b.hasInquiry) return a.hasInquiry ? -1 : 1;
    if (a.hasFavorite !== b.hasFavorite) return a.hasFavorite ? -1 : 1;
    return 0;
  });

  const inquiryCount = grouped.filter((v) => v.hasInquiry).length;

  return (
    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Home className="h-4 w-4 text-blue-600" />
        <span className="font-semibold text-gray-900 text-sm">房源浏览记录</span>
        <span className="text-xs text-gray-400">({grouped.length} 套)</span>
        {inquiryCount > 0 && (
          <span className="text-xs text-white bg-green-500 px-1.5 py-0.5 rounded-full font-medium">
            {inquiryCount} 个感兴趣
          </span>
        )}
      </div>

      <div className="space-y-2">
        {grouped.map((v) => (
          <a
            key={v.zpid}
            href={`https://www.zillow.com/homedetails/${v.zpid}_zpid/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 py-2 border-b border-blue-50 last:border-0 hover:bg-blue-50/50 rounded-lg px-1 -mx-1 transition"
          >
            {v.image_url ? (
              <img src={v.image_url} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <Home className="h-5 w-5 text-gray-300" />
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
                    看了 {v.viewCount} 次
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
              {v.hasFavorite && (
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              )}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
