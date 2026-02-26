import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { auth } from "@/lib/firebase";

interface Props {
  isMobile: boolean;
  onToggle: () => void;
}

export default function Header({ isMobile, onToggle }: Props) {
  const [displayName, setDisplayName] = useState<string>("U");

  useEffect(() => {
    if (auth) {
      const user = auth.currentUser;
      if (user?.email) {
        setDisplayName(user.email[0]?.toUpperCase() || "U");
      }
    }
  }, []);

  return (
    <header className="h-12 border-b border-slate-200 bg-white flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        {isMobile && (
          <button
            type="button"
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition"
            title="打开菜单"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <span className="text-sm font-medium">欢迎回来！</span>
      </div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className="hidden sm:inline">当前用户</span>
        <div className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
          {displayName}
        </div>
      </div>
    </header>
  );
}
