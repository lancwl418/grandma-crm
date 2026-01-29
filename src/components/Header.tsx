import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export default function Header() {
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
      <div className="text-sm font-medium">欢迎回来！</div>
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span>当前用户</span>
        <div className="h-7 w-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs">
          {displayName}
        </div>
      </div>
    </header>
  );
}
