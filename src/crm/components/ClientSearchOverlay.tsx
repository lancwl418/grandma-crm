import { useState } from "react";
import { Search, X, Phone, MessageCircle, ChevronRight } from "lucide-react";
import type { Client } from "@/crm/types";
interface Props {
  clients: Client[];
  onSelectClient: (clientId: string) => void;
  onClose: () => void;
}

export default function ClientSearchOverlay({ clients, onSelectClient, onClose }: Props) {
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? clients.filter((c) => {
        const q = query.toLowerCase();
        return (
          c.name?.toLowerCase().includes(q) ||
          c.remarkName?.toLowerCase().includes(q) ||
          c.phone?.includes(q) ||
          c.wechat?.toLowerCase().includes(q)
        );
      })
    : clients;

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-md shadow-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          <Search className="h-4 w-4 text-gray-400 shrink-0" />
          <input
            type="text"
            autoFocus
            placeholder="搜索客户姓名、电话、微信…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 text-sm outline-none bg-transparent"
          />
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">
              {query.trim() ? "没有找到匹配的客户" : "暂无客户"}
            </p>
          ) : (
            filtered.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => onSelectClient(client.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
              >
                {/* Avatar initial */}
                <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs shrink-0">
                  {(client.remarkName || client.name || "?").charAt(0)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {client.remarkName || client.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {client.status}
                    {client.phone && ` · ${client.phone}`}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 text-gray-300 shrink-0" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
