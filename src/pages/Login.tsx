import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Home } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function Login() {
  const [identifier, setIdentifier] = useState(""); // email or username
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(""); // signup only
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        let email = identifier.trim();

        // If no @ sign, treat as username → look up email
        if (!email.includes("@")) {
          const res = await fetch(`${API_BASE}/api/browse/lookup-username?username=${encodeURIComponent(email)}`);
          const data = await res.json();
          if (data.email) {
            email = data.email;
          } else {
            throw new Error("用户名不存在");
          }
        }

        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        if (!identifier.includes("@")) {
          throw new Error("请输入有效的邮箱地址");
        }
        if (!username.trim()) {
          throw new Error("请输入用户名");
        }

        const { data, error } = await supabase.auth.signUp({
          email: identifier.trim(),
          password,
          options: {
            data: { username: username.trim() },
          },
        });
        if (error) throw error;

        // Save username to agent_profiles
        if (data.user) {
          await supabase.from("agent_profiles").upsert({
            user_id: data.user.id,
            username: username.trim().toLowerCase(),
            display_name: username.trim(),
          });
        }
      }
    } catch (err: any) {
      setError(err.message || "操作失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-b from-blue-50 to-white px-4">
      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl shadow-lg w-full max-w-sm border border-gray-100">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-3">
            <Home className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Estate Epic</h2>
          <p className="text-xs text-gray-400 mt-1">{mode === "login" ? "欢迎回来" : "创建新账号"}</p>
        </div>

        {/* Username (signup only) */}
        {mode === "signup" && (
          <input
            className="border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 w-full text-sm focus:outline-none focus:border-blue-500 transition"
            placeholder="用户名 / Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        )}

        <input
          className="border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 w-full text-sm focus:outline-none focus:border-blue-500 transition"
          placeholder={mode === "login" ? "邮箱或用户名" : "邮箱 / Email"}
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
        />
        <input
          className="border-2 border-gray-200 rounded-xl px-4 py-3 mb-3 w-full text-sm focus:outline-none focus:border-blue-500 transition"
          placeholder="密码 / Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="text-red-500 text-xs mb-3 text-center">{error}</div>}

        <button
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white w-full py-3 rounded-xl font-medium text-sm active:from-blue-700 active:to-indigo-700 transition disabled:from-gray-300 disabled:to-gray-300 shadow-sm"
        >
          {loading ? "请稍候..." : mode === "login" ? "登录" : "注册"}
        </button>

        <div
          className="text-xs text-blue-500 cursor-pointer text-center mt-4"
          onClick={() => { setMode(mode === "login" ? "signup" : "login"); setError(""); }}
        >
          {mode === "login" ? "没有账号？注册" : "已有账号？登录"}
        </div>
      </form>
    </div>
  );
}
