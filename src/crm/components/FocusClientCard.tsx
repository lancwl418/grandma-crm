import React, { useMemo } from "react";
import { ChevronRight } from "lucide-react";
import type { Client } from "@/crm/types";

interface Props {
  client: Client;
  onViewDetail: () => void;
}

function parseDateFromNextAction(nextAction: string): Date | null {
  const dateMatch = nextAction.match(/^(\d{4}-\d{2}-\d{2})[：:]/);
  if (dateMatch) {
    const date = new Date(dateMatch[1]);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function countDatedTasks(client: Client): number {
  if (!client.logs) return 0;
  let n = 0;
  for (const log of client.logs) {
    if (!log.nextAction) continue;
    if (parseDateFromNextAction(log.nextAction)) n++;
  }
  return n;
}

/**
 * 优先客户区块用：仅展示客户名、区域、价值/状态标签、待办数、查看详情。
 * 不展示电话/微信/预算等隐私信息。
 */
const FocusClientCard: React.FC<Props> = ({ client, onViewDetail }) => {
  const taskCount = useMemo(() => countDatedTasks(client), [client]);
  const areaShort = client.requirements?.areas?.[0] || "";

  const valueLabel = useMemo(() => {
    if (client.urgency === "high") return "高意向";
    if (client.urgency === "medium") return "中等";
    return "建议关注";
  }, [client.urgency]);

  const todoSummary = taskCount > 0 ? `有待办 · 共 ${taskCount} 个` : "暂无待办 · 建议关注";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900 truncate">
              {client.remarkName || client.name}
            </h3>
            {areaShort && (
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded flex-shrink-0">
                {areaShort}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">{todoSummary}</p>
        </div>
        <span
          className={`
            text-xs font-semibold px-2 py-1 rounded flex-shrink-0
            ${client.urgency === "high" ? "bg-amber-100 text-amber-700" : ""}
            ${client.urgency === "medium" ? "bg-blue-100 text-blue-700" : ""}
            ${client.urgency === "low" ? "bg-gray-100 text-gray-600" : ""}
          `}
        >
          {valueLabel}
        </span>
      </div>
      <button
        type="button"
        onClick={onViewDetail}
        className="w-full flex items-center justify-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium py-2 rounded-lg border border-gray-200 hover:border-blue-200 transition"
      >
        查看详情
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export default FocusClientCard;
