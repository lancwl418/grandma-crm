import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Home, Phone } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function ClientLogin() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone.trim()) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/browse/client-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (data.clientId) {
        navigate(`/browse/${data.clientId}`, { replace: true });
      } else {
        setError("未找到该手机号对应的账户，请联系您的经纪人获取专属链接");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col items-center justify-center px-6">
      <img src="/logo.png" alt="Estate Epic" className="w-16 h-16 rounded-xl mb-4 shadow-lg" />
      <h1 className="text-xl font-bold text-gray-900 mb-1">Estate Epic 找房</h1>
      <p className="text-sm text-gray-400 mb-8">输入手机号进入您的专属页面</p>

      <div className="w-full max-w-sm space-y-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-green-600" />
              手机号码
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              placeholder="请输入您的手机号"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!phone.trim() || loading}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-base active:from-blue-700 active:to-indigo-700 transition disabled:from-gray-300 disabled:to-gray-300 shadow-lg shadow-blue-200"
          >
            {loading ? "查找中..." : "进入找房"}
          </button>
        </div>

        <p className="text-xs text-gray-400 text-center">
          还没有账户？请联系您的房产经纪人获取专属链接
        </p>
      </div>
    </div>
  );
}
