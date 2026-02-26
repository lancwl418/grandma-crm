import React, { useState } from "react";
import { Plus, X, Mic, FileText } from "lucide-react";

interface Props {
  onNewTask: () => void;
  onVoiceTask: () => void;
}

const FloatingActionButton: React.FC<Props> = ({ onNewTask, onVoiceTask }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2">
      {/* 展开的子按钮 */}
      {expanded && (
        <>
          <button
            type="button"
            onClick={() => {
              onVoiceTask();
              setExpanded(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm rounded-full shadow-lg hover:bg-green-700 transition animate-in"
          >
            <Mic className="h-4 w-4" />
            语音建任务
          </button>
          <button
            type="button"
            onClick={() => {
              onNewTask();
              setExpanded(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm rounded-full shadow-lg hover:bg-blue-700 transition"
          >
            <FileText className="h-4 w-4" />
            新建任务
          </button>
        </>
      )}

      {/* 主按钮 */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 ${
          expanded
            ? "bg-gray-700 hover:bg-gray-800 rotate-45"
            : "bg-blue-600 hover:bg-blue-700"
        }`}
      >
        <Plus className="h-6 w-6 text-white" />
      </button>
    </div>
  );
};

export default FloatingActionButton;
