import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Login from "@/pages/Login";
import AppLayout from "@/layout/AppLayout";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      // 如果没有 Firebase，直接允许访问
      setLoading(false);
      return;
    }

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );

  // 如果没有 Firebase 配置，直接允许访问
  if (!auth) {
    return <AppLayout>{children}</AppLayout>;
  }

  if (!user) return <Login />;

  return <AppLayout>{children}</AppLayout>;
}
