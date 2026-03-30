import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Home, User, Phone, Mail, MessageCircle, Star } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const HERO_IMAGES = [
  "https://photos.zillowstatic.com/fp/40b7077a545b01fb212c46fd467a373f-p_e.jpg",
  "https://photos.zillowstatic.com/fp/55de5261588247b703fcc952b49be948-p_e.jpg",
  "https://photos.zillowstatic.com/fp/366401355f96f8e2e0dc28c14cf0bf94-p_e.jpg",
  "https://photos.zillowstatic.com/fp/3136f65f9d0d374dc54a4f0085012589-p_e.jpg",
  "https://photos.zillowstatic.com/fp/5d72e46f3250e0bf71a5b2a343e8e46b-p_e.jpg",
];

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

  // Hero carousel
  const [heroIdx, setHeroIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroIdx((i) => (i + 1) % HERO_IMAGES.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!agentId) return;
    fetch(`${API_BASE}/api/browse/agent-profile/${agentId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.agentName) setAgentName(data.agentName);
        if (data.agentAvatar) setAgentAvatar(data.agentAvatar);
        if (data.agentTitle) setAgentTitle(data.agentTitle);
      })
      .catch(() => {});
  }, [agentId]);

  const canSubmit = name.trim() || phone.trim();

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
        navigate(`/browse/${data.clientId}`, { replace: true });
      } else {
        setError(data.error || "提交失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero carousel header */}
      <div className="relative h-56 sm:h-64 overflow-hidden">
        {HERO_IMAGES.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              i === heroIdx ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60" />

        {/* Content on top of hero */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white px-6">
          {/* Agent greeting */}
          {agentName ? (
            <div className="flex flex-col items-center mb-4">
              {agentAvatar ? (
                <img src={agentAvatar} alt="" className="w-16 h-16 rounded-full object-cover border-2 border-white/40 shadow-lg mb-3" />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-2xl font-bold shadow-lg mb-3">
                  {agentName[0]}
                </div>
              )}
              <p className="text-base font-medium text-center leading-snug">
                你好，我是你的专属房产顾问
              </p>
              <p className="text-xl font-bold mt-1">{agentName}</p>
              {agentTitle && <p className="text-xs text-white/60 mt-0.5">{agentTitle}</p>}
            </div>
          ) : (
            <>
              <img src="/logo.png" alt="" className="w-16 h-16 rounded-xl mb-3 shadow-lg" />
              <h1 className="text-2xl font-bold tracking-tight">Estate Epic</h1>
              <p className="text-white/80 text-sm mt-1">找到你的理想家园</p>
            </>
          )}
        </div>

        {/* Carousel dots */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {HERO_IMAGES.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${
                i === heroIdx ? "bg-white w-4" : "bg-white/40"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Form section */}
      <div className="px-5 -mt-6 relative z-10 pb-10 max-w-md mx-auto">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5 space-y-4">
          <p className="text-sm text-gray-500 text-center">
            为了更好地为您服务<br />请填写以下联系方式
          </p>

          {/* Name */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <User className="h-4 w-4 text-blue-600" />
              姓名 / Name
              <Star className="h-2 w-2 text-red-500 fill-red-500" />
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="请输入您的姓名"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Phone */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-green-600" />
              电话 / Phone
              <Star className="h-2 w-2 text-red-500 fill-red-500" />
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="请输入您的电话号码"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* Email */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Mail className="h-4 w-4 text-purple-600" />
              邮箱 / Email
              <span className="text-xs text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded">选填</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email address"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {/* WeChat */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-emerald-600" />
              微信 / WeChat
              <span className="text-xs text-orange-400 bg-orange-50 px-1.5 py-0.5 rounded">选填</span>
            </label>
            <input
              type="text"
              value={wechat}
              onChange={(e) => setWechat(e.target.value)}
              placeholder="微信号"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          {error && <p className="text-sm text-red-500 text-center">{error}</p>}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium text-base active:from-blue-700 active:to-indigo-700 transition disabled:from-gray-300 disabled:to-gray-300 shadow-lg shadow-blue-200"
          >
            {submitting ? "提交中..." : "开始浏览房源 →"}
          </button>

          <p className="text-xs text-gray-400 text-center">
            您的信息仅用于房产服务，不会分享给第三方
          </p>
        </div>
      </div>
    </div>
  );
}
