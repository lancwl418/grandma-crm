import React, { useState } from "react";
import { Phone, MessageCircle, CheckCircle2, ChevronRight } from "lucide-react";
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
    <div className="flex items-center gap-3 px-4 py-3 bg-white rounded-xl border border-gray-100 hover:border-gray-200 transition">
      {/* 逾期指示点 */}
      <div className={`w-2 h-2 rounded-full shrink-0 ${task.isOverdue ? "bg-red-500" : "bg-blue-500"}`} />

      {/* 客户名 + 任务 */}
      <button
        type="button"
        onClick={() => onOpenClient(task.clientId)}
        className="flex-1 min-w-0 text-left"
      >
        <p className="text-sm font-medium text-gray-900 truncate">
          {task.clientName}
          <span className="text-gray-400 mx-1.5">·</span>
          <span className="text-gray-600 font-normal">{task.title}</span>
        </p>
        {task.isOverdue && (
          <p className="text-xs text-red-500">逾期 {task.daysOverdue} 天</p>
        )}
      </button>

      {/* 快捷操作 */}
      <div className="flex items-center gap-1.5 shrink-0">
        {clientPhone && (
          <a
            href={`tel:${clientPhone}`}
            className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition"
            title="拨号"
          >
            <Phone className="h-4 w-4" />
          </a>
        )}
        {clientWechat && (
          <button
            type="button"
            onClick={handleCopyWechat}
            className="p-2 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition"
            title={copyFeedback ? "已复制" : "复制微信号"}
          >
            <MessageCircle className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onComplete(task.logId)}
          className="p-2 rounded-lg bg-gray-50 text-gray-500 hover:bg-green-50 hover:text-green-600 transition"
          title="完成"
        >
          <CheckCircle2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default BriefingCard;
