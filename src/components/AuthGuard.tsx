import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { UserContext } from "@/lib/userContext";
import type { User } from "@supabase/supabase-js";
import Login from "@/pages/Login";

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center text-slate-500">
        Loading...
      </div>
    );

  if (!supabase) {
    return <>{children}</>;
  }

  if (!user) return <Login />;

  return (
    <UserContext.Provider value={user.id}>
      {children}
    </UserContext.Provider>
  );
}
