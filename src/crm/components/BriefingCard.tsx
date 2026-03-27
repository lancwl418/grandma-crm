import React, { useState } from "react";
import { Phone, MessageCircle, CheckCircle2 } from "lucide-react";
import type { FlatTask } from "@/crm/utils/dashboardTasks";

interface Props {
  task: FlatTask;
  clientPhone?: string;
  clientWechat?: string;
  onComplete: (logId: string) => void;
  onOpenClient: (clientId: string) => void;
}

const BriefingCard: React.FC<Props> = ({ task, clientPhone, clientWechat, onComplete, onOpenClient }) => {
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyWechat = () => {
    if (clientWechat) {
      navigator.clipboard.writeText(clientWechat);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 1500);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Tappable content area */}
      <button
        type="button"
        onClick={() => onOpenClient(task.clientId)}
        className="w-full text-left px-4 py-3 active:bg-gray-50 transition"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${task.isOverdue ? "bg-red-500" : "bg-blue-500"}`} />
          <span className="text-xs text-gray-400">{task.clientName}</span>
          {task.isOverdue && (
            <span className="text-[10px] text-red-500 font-medium">逾期 {task.daysOverdue} 天</span>
          )}
        </div>
        <p className="text-sm font-medium text-gray-900 mt-1 leading-snug">{task.title}</p>
      </button>

      {/* Action buttons */}
      <div className="flex items-center border-t border-gray-50 divide-x divide-gray-100">
        <button
          type="button"
          onClick={() => onComplete(task.logId)}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-green-600 active:bg-green-50 transition"
        >
          <CheckCircle2 className="h-4 w-4" />
          完成
        </button>
        {clientPhone && (
          <a
            href={`tel:${clientPhone}`}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-blue-600 active:bg-blue-50 transition"
          >
            <Phone className="h-4 w-4" />
            拨号
          </a>
        )}
        {clientWechat && (
          <button
            type="button"
            onClick={handleCopyWechat}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium text-emerald-600 active:bg-emerald-50 transition"
          >
            <MessageCircle className="h-4 w-4" />
            {copyFeedback ? "已复制" : "微信"}
          </button>
        )}
      </div>
    </div>
  );
};

export default BriefingCard;
