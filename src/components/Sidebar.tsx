import { Home, Users, ClipboardList, Bell, Settings } from "lucide-react";

export default function Sidebar() {
  return (
    <aside className="w-52 shrink-0 border-r border-slate-200 bg-white flex flex-col">
      <div className="px-4 py-4 border-b border-slate-200">
        <div className="text-lg font-bold text-slate-900">GrandmaCRM</div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 text-sm">
        <SidebarItem icon={Home} label="客户管理" active />
        <SidebarItem icon={ClipboardList} label="跟进记录" />
        <SidebarItem icon={Bell} label="任务提醒" />
        <SidebarItem icon={Settings} label="设置" />
      </nav>
    </aside>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active
}: {
  icon: typeof Home;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      className={`w-full flex items-center px-3 py-2 rounded-lg mb-1 ${
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
