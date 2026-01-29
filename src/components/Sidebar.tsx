import { useLocation, useNavigate } from "react-router-dom";
import { Home, Users } from "lucide-react";

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isDashboard = location.pathname === "/app" || location.pathname === "/app/";
  const isClients = location.pathname === "/app/clients";

  return (
    <aside className="w-52 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="text-lg font-bold text-slate-900">GrandmaCRM</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
        <SidebarItem
          icon={Home}
          label="工作台"
          active={isDashboard}
          onClick={() => navigate("/app")}
        />
        <SidebarItem
          icon={Users}
          label="客户"
          active={isClients}
          onClick={() => navigate("/app/clients")}
        />
      </nav>
    </aside>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  onClick
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center px-3 py-2 rounded-lg mb-1 transition ${
        active
          ? "bg-slate-900 text-slate-50"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </button>
  );
}
