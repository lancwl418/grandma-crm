import React from "react";
import { MapPin, Phone, MessageCircle, DollarSign, ChevronRight, Cake } from "lucide-react";
import type { Client } from "@/crm/types";
import { CLIENT_STATUSES, URGENCY_LEVELS } from "@/crm/constants";

interface Props {
  client: Client;
  onClick: () => void;
}

const ClientCard: React.FC<Props> = ({ client, onClick }) => {
  const status = CLIENT_STATUSES.find((s) => s.label === client.status);
  const urgency = URGENCY_LEVELS[client.urgency];
  const logs = (client.logs || [])
    .sort((a: any, b: any) => (a.time < b.time ? 1 : -1))
    .slice(0, 4); // 只显示 4 条
  
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
    <div
      onClick={onClick}
      className="
        bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-4
        hover:shadow-md transition cursor-pointer relative
        flex flex-col gap-3
      "
    >
      {/* 顶部区：名字 + 状态徽章 */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-gray-900 leading-tight">
            {client.remarkName || client.name}
          </h3>
          {client.name && client.name !== client.remarkName && (
            <div className="text-xs text-gray-400">真名：{client.name}</div>
          )}
        </div>

        <div className="flex flex-col gap-1 items-end">
          <span
            className={`text-[10px] px-2 py-0.5 rounded font-medium ${status?.color}`}
          >
            {client.status}
          </span>

          <span
            className={`text-[10px] px-2 py-0.5 rounded border font-medium flex items-center gap-1 ${urgency.color}`}
          >
            <urgency.Icon className="w-3 h-3" />
            {urgency.label}
          </span>
        </div>
      </div>

      {/* 区域 */}
      {client.requirements?.areas?.length > 0 && (
        <div className="flex items-center text-gray-700 text-sm">
          <MapPin className="h-4 w-4 mr-2 text-gray-400" />
          <span className="truncate">{client.requirements.areas.join(", ")}</span>
        </div>
      )}

      {/* 电话 & 微信 */}
      <div className="flex flex-col text-sm text-gray-700 gap-1">
        <div className="flex items-center">
          <Phone className="h-4 w-4 mr-2 text-gray-400" />
          {client.phone || <span className="text-gray-300">暂无电话</span>}
        </div>

        {client.wechat && (
          <div className="flex items-center text-green-600">
            <MessageCircle className="h-4 w-4 mr-2" />
            {client.wechat}
          </div>
        )}
      </div>

      {/* 预算 */}
      <div className="flex items-center text-gray-700 text-sm">
        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
        {client.requirements?.budgetMin}-{client.requirements?.budgetMax} 万
      </div>

      {/* 标签 */}
      {client.requirements?.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {client.requirements.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="bg-gray-100 border border-gray-200 text-gray-500 px-1.5 py-0.5 rounded text-[10px]"
            >
              #{tag}
            </span>
          ))}

          {client.requirements.tags.length > 3 && (
            <span className="text-[10px] text-gray-400">
              +{client.requirements.tags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* 最近动态 */}
      <div className="bg-gray-50 p-3 rounded-lg mt-2">
        <div className="text-gray-700 font-medium text-sm mb-1">
          最近动态
        </div>

        {logs.length === 0 && (
          <div className="text-gray-400 text-xs">暂无记录</div>
        )}

        {logs.map((log: any, idx: number) => (
          <div key={idx} className="text-gray-600 text-xs mb-1 leading-snug">
            <span className="font-semibold text-gray-500">
              {formatToCaliforniaTime(log.date)}
            </span>
            ：{log.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ClientCard;
