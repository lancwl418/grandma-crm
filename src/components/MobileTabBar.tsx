import { useLocation, useNavigate } from "react-router-dom";
import { Eye, Bot, User, Settings } from "lucide-react";

const TABS = [
  { path: "/app", label: "我的", icon: User },
  { path: "/app/visitors", label: "访客", icon: Eye },
  { path: "/app/assistant", label: "助理", icon: Bot },
  { path: "/app/settings", label: "设置", icon: Settings },
] as const;

export default function MobileTabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  const currentPath = location.pathname;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 flex items-stretch safe-bottom md:hidden">
      {TABS.map(({ path, label, icon: Icon }) => {
        const active =
          path === "/app"
            ? currentPath === "/app" || currentPath === "/app/"
            : currentPath.startsWith(path);

        return (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 transition ${
              active
                ? "text-blue-600"
                : "text-slate-400 active:text-slate-600"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="text-[10px] font-medium">{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
