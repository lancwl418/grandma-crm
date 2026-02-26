import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 768 : false
  );
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(!e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return isMobile;
}

export default function Home() {
  const isMobile = useIsMobile();
  const [collapsed, setCollapsed] = useState(isMobile);

  // 响应屏幕变化：手机收起，桌面展开
  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  // 手机端点击导航后自动收起
  const handleNavigate = useCallback(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* 手机端遮罩 */}
      {isMobile && !collapsed && (
        <div
          className="fixed inset-0 bg-black/30 z-40"
          onClick={() => setCollapsed(true)}
        />
      )}

      <Sidebar collapsed={collapsed} isMobile={isMobile} onNavigate={handleNavigate} onToggle={toggle} />

      <div className="flex-1 flex flex-col min-w-0">
        <Header isMobile={isMobile} onToggle={toggle} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
