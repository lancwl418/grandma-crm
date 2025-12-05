import React, { useState } from "react";
import { Clock } from "lucide-react";
import ImagePreviewModal from "./ImagePreviewModal";
import type { ClientLog } from "@/crm/types";

interface Props {
  log: ClientLog;
  index: number;
}

const LogItem: React.FC<Props> = ({ log, index }) => {
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  function formatToCaliforniaTime(isoString: string) {
    if (!isoString) return "";
  
    const date = new Date(isoString);
  
    return date.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 mb-3">

      {/* 大图预览 */}
      <ImagePreviewModal
        src={previewSrc}
        onClose={() => setPreviewSrc(null)}
      />

      {/* 顶部：序号 + 时间 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-baseline gap-3">
          <span className="text-blue-600 font-semibold text-lg">{index}</span>
          <span className="text-gray-500 text-sm">{formatToCaliforniaTime(log.date)}</span>
        </div>
      </div>

      {/* 内容 */}
      <div className="text-gray-800 leading-relaxed whitespace-pre-line">
        {log.content}
      </div>

      {/* 图片缩略图 + 点击放大 */}
      {log.images && log.images.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {log.images.map((src, idx) => (
            <img
              key={idx}
              src={src}
              alt={`log-image-${idx}`}
              onClick={() => setPreviewSrc(src)}
              className="w-20 h-20 object-cover rounded-md border cursor-pointer hover:opacity-80"
            />
          ))}
        </div>
      )}

      {/* 下一步计划 */}
      {log.nextAction && (
        <div className="mt-3 inline-flex items-center gap-2 text-orange-600 text-sm bg-orange-50 px-3 py-2 rounded-lg">
          <Clock className="h-4 w-4" />
          <span>下步：{log.nextAction}</span>
        </div>
      )}
    </div>
  );
};

export default LogItem;
