import React, { useState } from "react";
import { Clock } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";
import type { ClientLog } from "@/crm/types";

interface Props {
  log: ClientLog;
  index: number;
  isLast?: boolean;
}

function formatTime(isoString: string): { dateStr: string; timeStr: string } {
  if (!isoString) return { dateStr: "", timeStr: "" };
  const date = new Date(isoString);
  const month = date.toLocaleString("zh-CN", { timeZone: "America/Los_Angeles", month: "numeric" });
  const day = date.toLocaleString("zh-CN", { timeZone: "America/Los_Angeles", day: "numeric" });
  const time = date.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return { dateStr: `${month}月${day}日`, timeStr: time };
}

const LogItem: React.FC<Props> = ({ log, isLast }) => {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const { dateStr, timeStr } = formatTime(log.date);

  return (
    <div className="relative flex gap-4">
      <ImagePreviewModal
        src={previewSrc}
        onClose={() => setPreviewSrc(null)}
      />

      {/* 时间线：圆点 + 竖线 */}
      <div className="flex flex-col items-center pt-1">
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${log.nextAction ? "bg-orange-400" : "bg-blue-400"}`} />
        {!isLast && <div className="w-px flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* 内容区 */}
      <div className={`flex-1 ${isLast ? "pb-0" : "pb-6"}`}>
        {/* 时间 */}
        <p className="text-xs text-gray-400 mb-1">
          {dateStr} {timeStr}
        </p>

        {/* 正文 */}
        <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">{log.content}</p>

        {/* 图片 */}
        {log.images && log.images.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {log.images.map((src, idx) => (
              <img
                key={idx}
                src={src}
                alt={`log-img-${idx}`}
                onClick={() => setPreviewSrc(src)}
                className="w-16 h-16 object-cover rounded-md border cursor-pointer hover:opacity-80"
              />
            ))}
          </div>
        )}

        {/* 下一步 */}
        {log.nextAction && (
          <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-orange-600 bg-orange-50 px-2.5 py-1.5 rounded-md">
            <Clock className="h-3.5 w-3.5" />
            <span>下步：{log.nextActionTodo || log.nextAction}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default LogItem;
