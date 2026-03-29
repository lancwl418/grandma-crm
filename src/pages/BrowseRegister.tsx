import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Home, User, Phone, Mail, MessageCircle } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

export default function BrowseRegister() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [wechat, setWechat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Agent info
  const [agentName, setAgentName] = useState("");
  const [agentAvatar, setAgentAvatar] = useState("");
  const [agentTitle, setAgentTitle] = useState("");

  // Load agent profile
  useEffect(() => {
    if (!agentId) return;
    // We need an endpoint to get agent info by user_id (not client_id)
    // For now, just show default
  }, [agentId]);

  const canSubmit = name.trim() || phone.trim() || email.trim();

  const handleSubmit = async () => {
    if (!canSubmit || !agentId) return;
    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/api/browse/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          name: name.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          wechat: wechat.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok && data.clientId) {
        // Redirect to personal browse page
        navigate(`/browse/${data.clientId}`, { replace: true });
      } else {
        setError(data.error || "Registration failed");
      }
    } catch {
      setError("Network error, please try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white flex flex-col">
      {/* Header */}
      <div className="px-6 pt-12 pb-6 text-center">
        <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-4">
          <Home className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Estate Epic 找房</h1>
        <p className="text-sm text-gray-500 mt-1">填写信息开始浏览房源</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 pb-8">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4 max-w-md mx-auto">
          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Name / 姓名
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5" /> Phone / 电话
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> Email / 邮箱
              <span className="text-gray-300 font-normal">optional</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* WeChat */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> WeChat / 微信
              <span className="text-gray-300 font-normal">optional</span>
            </label>
            <input
              type="text"
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              placeholder="WeChat ID"
              className="w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-medium text-base active:bg-blue-700 transition disabled:bg-gray-300"
          >
            {submitting ? "提交中..." : "开始浏览房源"}
          </button>

          <p className="text-[10px] text-gray-300 text-center">
            Your information will only be shared with your agent
          </p>
        </div>
      </div>
    </div>
  );
}
