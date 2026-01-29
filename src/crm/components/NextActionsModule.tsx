import React from "react";
import { Lightbulb, ChevronRight, CheckCircle2 } from "lucide-react";

export type NextAction = {
  id: string;
  clientId: string;
  clientName: string;
  badgeText?: string; // e.g. 高意向/看房中/投资客
  actionTitle: string;
  reason: string;
  ctaText: string; // e.g. 打开客户/去记录/标记完成
  kind: "overdue" | "today" | "revive";
  taskId?: string; // 如果是来自任务，记录任务ID
};

interface Props {
  actions: NextAction[];
  onOpenClient: (clientId: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onAddLog?: (clientId: string) => void;
}

const NextActionsModule: React.FC<Props> = ({
  actions,
  onOpenClient,
  onCompleteTask,
  onAddLog,
}) => {
  if (actions.length === 0) {
    return null;
  }

  const handleAction = (action: NextAction) => {
    if (action.ctaText.includes("标记完成") || action.ctaText === "标记完成") {
      if (action.taskId && onCompleteTask) {
        onCompleteTask(action.taskId);
      }
    } else if (action.ctaText === "去记录" || action.ctaText.includes("记录")) {
      if (onAddLog) {
        onAddLog(action.clientId);
      }
    } else {
      // 默认打开客户（包括"打开客户"、"优先处理逾期任务"、"今天要收尾"等）
      onOpenClient(action.clientId);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
      {/* 标题 */}
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="h-5 w-5 text-amber-500" />
        <h2 className="text-lg font-bold text-gray-900">今日行动建议</h2>
      </div>

      {/* 建议列表 */}
      <div className="space-y-3">
        {actions.map((action) => (
          <div
            key={action.id}
            className="border border-gray-100 rounded-lg p-4 hover:border-blue-200 hover:bg-blue-50/30 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {/* 客户名称 + 标签 */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold text-gray-900">
                    {action.clientName}
                  </span>
                  {action.badgeText && (
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {action.badgeText}
                    </span>
                  )}
                </div>

                {/* 建议动作 */}
                <div className="text-sm font-medium text-gray-800 mb-1">
                  {action.actionTitle}
                </div>

                {/* 理由 */}
                <div className="text-xs text-gray-500">{action.reason}</div>
              </div>

              {/* CTA 按钮 */}
              <button
                onClick={() => handleAction(action)}
                className={`
                  flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition
                  ${
                    action.kind === "overdue"
                      ? "bg-red-50 text-red-700 hover:bg-red-100"
                      : action.kind === "today"
                      ? "bg-orange-50 text-orange-700 hover:bg-orange-100"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }
                `}
              >
                {action.ctaText === "标记完成" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                <span>{action.ctaText}</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NextActionsModule;
