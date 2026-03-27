import { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import MobileTabBar from "@/components/MobileTabBar";

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

  useEffect(() => {
    setCollapsed(isMobile);
  }, [isMobile]);

  const toggle = useCallback(() => setCollapsed((c) => !c), []);

  const handleNavigate = useCallback(() => {
    if (isMobile) setCollapsed(true);
  }, [isMobile]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Desktop: sidebar */}
      {!isMobile && (
        <Sidebar collapsed={collapsed} isMobile={false} onNavigate={handleNavigate} onToggle={toggle} />
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header isMobile={isMobile} />
        <main className={`flex-1 overflow-auto ${isMobile ? "pb-14" : ""}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile: bottom tab bar */}
      {isMobile && <MobileTabBar />}
    </div>
  );
}
