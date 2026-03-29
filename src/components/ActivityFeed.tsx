import { useEffect, useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Home } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/userContext";

interface ActivityItem {
  clientId: string;
  clientName: string;
  address: string;
  imageUrl: string | null;
  action: string;
  time: string;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "刚刚";
  if (diffMins < 60) return `${diffMins}分钟前`;
  if (diffHours < 24) return `${diffHours}小时前`;
  return `${Math.floor(diffMs / 86400000)}天前`;
}

function actionLabel(action: string): string {
  if (action === "favorite") return "收藏了";
  if (action === "inquiry") return "对感兴趣";
  return "浏览了";
}

export default function ActivityFeed() {
  const userId = useContext(UserContext);
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    if (!supabase || !userId) return;

    (async () => {
      // Get my client IDs
      const { data: clients } = await supabase
        .from("clients")
        .select("id, remark_name, name")
        .eq("user_id", userId);

      if (!clients || clients.length === 0) return;

      const clientMap = new Map<string, string>();
      const clientIds: string[] = [];
      for (const c of clients) {
        clientMap.set(c.id, c.remark_name || c.name || "客户");
        clientIds.push(c.id);
      }

      // Get recent views
      const { data: views } = await supabase
        .from("client_listing_views")
        .select("client_id, address, image_url, action, created_at")
        .in("client_id", clientIds)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!views || views.length === 0) return;

      const items: ActivityItem[] = views.map((v: any) => ({
        clientId: v.client_id,
        clientName: clientMap.get(v.client_id) || "客户",
        address: v.address || "",
        imageUrl: v.image_url,
        action: v.action,
        time: v.created_at,
      }));

      setActivities(items);
    })();
  }, [userId]);

  // Auto scroll
  useEffect(() => {
    if (activities.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentIdx((i) => (i + 1) % activities.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [activities.length]);

  if (activities.length === 0) return null;

  const current = activities[currentIdx];
  // Extract city from address
  const city = current.address.split(",").slice(-2, -1)[0]?.trim() || current.address.split(",")[0] || "";

  return (
    <div className="px-4 mt-4">
      <button
        type="button"
        onClick={() => navigate("/app/visitors")}
        className="w-full bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden active:bg-gray-50 transition"
      >
        <div className="flex items-center gap-3 p-3">
          {/* Thumbnail */}
          {current.imageUrl ? (
            <img src={current.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <Home className="h-5 w-5 text-gray-300" />
            </div>
          )}

          {/* Text */}
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm text-gray-800 truncate">
              <span className="font-medium text-blue-600">{current.clientName}</span>
              {" "}
              <span className="text-gray-400">{formatTime(current.time)}</span>
              {" "}
              {actionLabel(current.action)}
            </p>
            <p className="text-xs text-gray-400 truncate mt-0.5">
              {city} 的房源
            </p>
          </div>

          {/* Dot indicator */}
          <div className="flex flex-col gap-0.5 shrink-0">
            {activities.slice(0, Math.min(5, activities.length)).map((_, i) => (
              <div
                key={i}
                className={`w-1 h-1 rounded-full ${i === currentIdx % Math.min(5, activities.length) ? "bg-blue-500" : "bg-gray-200"}`}
              />
            ))}
          </div>
        </div>
      </button>
    </div>
  );
}
