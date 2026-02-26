import React, { useState, useMemo } from "react";
import { X, Search, ChevronDown } from "lucide-react";
import AddLogPanel from "./AddLogPanel";
import type { Client, ClientLog } from "@/crm/types";

interface Props {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  clients?: Client[];
  onAddLog: (log: ClientLog, client: Client) => void;
}

const AddTaskModal: React.FC<Props> = ({ open, onClose, client: externalClient, clients = [], onAddLog }) => {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!open) return null;

  const client = externalClient || selectedClient;
  const needsClientPicker = !externalClient && clients.length > 0;

  const filteredClients = clients.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.remarkName && c.remarkName.toLowerCase().includes(q)) ||
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q))
    );
  });

  const resetAndClose = () => {
    setSelectedClient(null);
    setSearchQuery("");
    setDropdownOpen(false);
    onClose();
  };

  const handleAddLog = (log: ClientLog) => {
    if (!client) return;
    onAddLog(log, client);
    resetAndClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={resetAndClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">{externalClient ? "记一笔" : "新建任务"}</h2>
            {client && (
              <p className="text-sm text-gray-500 mt-1">
                客户：{client.remarkName || client.name}
              </p>
            )}
          </div>
          <button
            onClick={resetAndClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Client Picker */}
        {needsClientPicker && !selectedClient && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">选择客户</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 border border-gray-200 rounded-lg text-left hover:border-gray-300 transition bg-white"
              >
                <span className="text-sm text-gray-400">搜索或选择客户...</span>
                <ChevronDown className="h-4 w-4 text-gray-400" />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-64 overflow-hidden flex flex-col">
                  <div className="p-2 border-b border-gray-100">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="输入姓名、备注或电话..."
                        className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-blue-400"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {filteredClients.length === 0 ? (
                      <p className="text-sm text-gray-400 py-4 text-center">未找到匹配客户</p>
                    ) : (
                      filteredClients.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(c);
                            setDropdownOpen(false);
                            setSearchQuery("");
                          }}
                          className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition flex items-center justify-between"
                        >
                          <div>
                            <p className="text-sm font-medium text-gray-800">{c.remarkName || c.name}</p>
                            {c.name && c.remarkName && (
                              <p className="text-xs text-gray-400">{c.name}</p>
                            )}
                          </div>
                          <span className="text-xs text-gray-400">{c.status}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 已选客户，可切换 */}
        {needsClientPicker && selectedClient && (
          <div className="mb-4 flex items-center gap-2">
            <span className="text-sm text-gray-500">客户：</span>
            <span className="text-sm font-medium">{selectedClient.remarkName || selectedClient.name}</span>
            <button
              type="button"
              onClick={() => setSelectedClient(null)}
              className="text-xs text-blue-600 hover:text-blue-700 ml-1"
            >
              切换
            </button>
          </div>
        )}

        {/* AddLogPanel */}
        {client ? (
          <AddLogPanel onAddLog={handleAddLog} />
        ) : (
          !needsClientPicker && (
            <p className="text-sm text-gray-400 text-center py-8">请先选择客户</p>
          )
        )}
      </div>
    </div>
  );
};

export default AddTaskModal;
