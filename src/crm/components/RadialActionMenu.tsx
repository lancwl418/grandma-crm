import { UserPlus, ListPlus, Calendar, Search, FileText } from "lucide-react";
import type { ComponentType } from "react";

export type ActionKey = "addClient" | "addTask" | "viewToday" | "searchClient" | "organizeNotes";

interface RadialAction {
  key: ActionKey;
  label: string;
  icon: ComponentType<{ className?: string }>;
  color: string;
}

const ACTIONS: RadialAction[] = [
  { key: "addClient",     label: "添加客户", icon: UserPlus,  color: "bg-blue-500 text-white" },
  { key: "addTask",       label: "新建任务", icon: ListPlus,  color: "bg-green-500 text-white" },
  { key: "viewToday",     label: "今日待办", icon: Calendar,  color: "bg-amber-500 text-white" },
  { key: "searchClient",  label: "搜索客户", icon: Search,    color: "bg-purple-500 text-white" },
  { key: "organizeNotes", label: "整理笔记", icon: FileText,  color: "bg-rose-500 text-white" },
];

const RADIUS = 120;
const START_ANGLE = -150; // degrees (from 3-o'clock, negative = above)
const END_ANGLE = -30;

interface Props {
  open: boolean;
  onAction: (key: ActionKey) => void;
}

export default function RadialActionMenu({ open, onAction }: Props) {
  const angleStep = (END_ANGLE - START_ANGLE) / (ACTIONS.length - 1);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {ACTIONS.map((action, i) => {
        const angleDeg = START_ANGLE + i * angleStep;
        const angleRad = (angleDeg * Math.PI) / 180;
        const x = Math.cos(angleRad) * RADIUS;
        const y = Math.sin(angleRad) * RADIUS;
        const Icon = action.icon;

        return (
          <div
            key={action.key}
            className="absolute left-1/2 top-1/2 flex flex-col items-center"
            style={{
              transform: open
                ? `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`
                : "translate(-50%, -50%)",
              opacity: open ? 1 : 0,
              transition: `all 300ms ease-out`,
              transitionDelay: open ? `${i * 60}ms` : "0ms",
              pointerEvents: open ? "auto" : "none",
            }}
          >
            <button
              type="button"
              onClick={() => onAction(action.key)}
              className={`w-12 h-12 rounded-full ${action.color} shadow-lg flex items-center justify-center
                transition-transform duration-150 hover:scale-110 active:scale-95`}
              title={action.label}
            >
              <Icon className="h-5 w-5" />
            </button>
            <span
              className="mt-1.5 text-xs text-gray-600 font-medium whitespace-nowrap"
              style={{
                opacity: open ? 1 : 0,
                transition: "opacity 200ms ease-out",
                transitionDelay: open ? `${i * 60 + 150}ms` : "0ms",
              }}
            >
              {action.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
