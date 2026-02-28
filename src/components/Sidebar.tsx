import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users, Bot, ChevronsLeft, ChevronsRight, Menu } from "lucide-react";

interface Props {
  collapsed: boolean;
  isMobile: boolean;
  onNavigate: () => void;
  onToggle: () => void;
}

export default function Sidebar({ collapsed, isMobile, onNavigate, onToggle }: Props) {
  const location = useLocation();
  const navigate = useNavigate();

  const isDashboard = location.pathname === "/app" || location.pathname === "/app/";
  const isClients = location.pathname === "/app/clients";
  const isAssistant = location.pathname === "/app/assistant";

  const handleNav = (path: string) => {
    navigate(path);
    onNavigate();
  };

  // 手机端：固定定位抽屉；桌面端：正常文档流
  const asideClass = isMobile
    ? `fixed inset-y-0 left-0 z-50 w-52 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 ${
        collapsed ? "-translate-x-full" : "translate-x-0"
      }`
    : `shrink-0 border-r border-slate-200 bg-white flex flex-col transition-all duration-200 ${
        collapsed ? "w-14" : "w-52"
      }`;

  return (
    <aside className={asideClass}>
      <div className={`py-4 border-b border-slate-200 flex items-center ${collapsed && !isMobile ? "px-2 justify-center" : "px-4 justify-between"}`}>
        {collapsed && !isMobile ? (
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            title="展开侧栏"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        ) : (
          <>
            <div className="text-lg font-bold text-slate-900 truncate">GrandmaCRM</div>
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"
              title="收起侧栏"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <nav className={`flex-1 py-4 space-y-1 text-sm ${collapsed && !isMobile ? "px-1" : "px-3"}`}>
        <SidebarItem
          icon={Home}
          label="工作台"
          active={isDashboard}
          collapsed={collapsed && !isMobile}
          onClick={() => handleNav("/app")}
        />
        <SidebarItem
          icon={Users}
          label="客户"
          active={isClients}
          collapsed={collapsed && !isMobile}
          onClick={() => handleNav("/app/clients")}
        />
        <SidebarItem
          icon={Bot}
          label="助理"
          active={isAssistant}
          collapsed={collapsed && !isMobile}
          onClick={() => handleNav("/app/assistant")}
        />
      </nav>

    </aside>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  collapsed,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center rounded-lg mb-1 transition ${
        collapsed ? "justify-center px-2 py-2" : "px-3 py-2"
      } ${
        active
          ? "bg-slate-900 text-slate-50"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon className={`h-4 w-4 ${collapsed ? "" : "mr-2"}`} />
      {!collapsed && label}
    </button>
  );
}
