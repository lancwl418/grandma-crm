import React from "react";
import { X } from "lucide-react";
import AddLogPanel from "./AddLogPanel";
import type { Client, ClientLog } from "@/crm/types";

interface Props {
  open: boolean;
  onClose: () => void;
  client: Client | null;
  onAddLog: (log: ClientLog) => void;
}

const AddTaskModal: React.FC<Props> = ({ open, onClose, client, onAddLog }) => {
  if (!open) return null;

  const handleAddLog = (log: ClientLog) => {
    onAddLog(log);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl w-full max-w-2xl p-6 shadow-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold">记一笔</h2>
            {client && (
              <p className="text-sm text-gray-500 mt-1">
                客户：{client.remarkName || client.name}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* AddLogPanel */}
        <AddLogPanel onAddLog={handleAddLog} />
      </div>
    </div>
  );
};

export default AddTaskModal;
