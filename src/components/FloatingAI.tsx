import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, X } from "lucide-react";

const GREETING_KEY = "estate-epic-ai-greeted";

export default function FloatingAI() {
  const navigate = useNavigate();
  const [visible, setVisible] = useState(true);
  const [showBubble, setShowBubble] = useState(false);

  // First login greeting
  useEffect(() => {
    const greeted = localStorage.getItem(GREETING_KEY);
    if (!greeted) {
      setShowBubble(true);
      localStorage.setItem(GREETING_KEY, "1");
    }
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed right-4 bottom-20 md:bottom-6 z-30 flex flex-col items-end gap-2">
      {/* Chat bubble */}
      {showBubble && (
        <div className="relative bg-white rounded-2xl rounded-br-sm shadow-lg border border-gray-100 px-4 py-3 max-w-[220px] animate-fade-in">
          <p className="text-sm text-gray-800 leading-relaxed">
            老板你来啦！我是你的专属 AI 助理，有什么需要随时找我～
          </p>
          <button
            type="button"
            onClick={() => setShowBubble(false)}
            className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-gray-200 rounded-full flex items-center justify-center"
          >
            <X className="h-3 w-3 text-gray-500" />
          </button>
        </div>
      )}

      {/* Floating icon */}
      <div className="relative">
        <button
          type="button"
          onClick={() => navigate("/app/assistant")}
          className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg active:shadow-md active:scale-95 transition"
        >
          <Bot className="h-6 w-6" />
        </button>
        {/* Close button */}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setVisible(false); }}
          className="absolute -top-1 -right-1 w-5 h-5 bg-gray-400 rounded-full flex items-center justify-center"
        >
          <X className="h-3 w-3 text-white" />
        </button>
      </div>
    </div>
  );
}
