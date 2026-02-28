import { Bot } from "lucide-react";

interface Props {
  onClick: () => void;
  isActive: boolean;
}

export default function AssistantAvatar({ onClick, isActive }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="打开助理菜单"
      className="relative group outline-none"
    >
      {/* Pulse ring when active */}
      {isActive && (
        <span
          className="absolute inset-0 rounded-full bg-blue-400/30"
          style={{ animation: "pulse-ring 1.5s ease-out infinite" }}
        />
      )}

      {/* Main avatar circle */}
      <div
        className={`
          relative w-28 h-28 rounded-full
          bg-gradient-to-br from-blue-500 to-indigo-600
          flex items-center justify-center
          shadow-xl cursor-pointer
          transition-transform duration-300 ease-out
          active:scale-95
          ${isActive ? "scale-110 ring-4 ring-blue-300/50" : "hover:scale-105"}
        `}
        style={!isActive ? { animation: "float 3s ease-in-out infinite" } : undefined}
      >
        <Bot className="h-12 w-12 text-white" />
      </div>
    </button>
  );
}
