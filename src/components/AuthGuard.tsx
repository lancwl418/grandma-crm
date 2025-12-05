import { useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Login from "@/pages/Login";
import AppLayout from "@/layout/AppLayout";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

  if (!user) return <Login />;

  return <AppLayout>{children}</AppLayout>;
}
