import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { User, Phone, Mail, MessageCircle, Star, Copy, Check, ChevronDown, Send } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

const HERO_IMAGES = [
  "https://photos.zillowstatic.com/fp/40b7077a545b01fb212c46fd467a373f-p_e.jpg",
  "https://photos.zillowstatic.com/fp/55de5261588247b703fcc952b49be948-p_e.jpg",
  "https://photos.zillowstatic.com/fp/366401355f96f8e2e0dc28c14cf0bf94-p_e.jpg",
  "https://photos.zillowstatic.com/fp/3136f65f9d0d374dc54a4f0085012589-p_e.jpg",
  "https://photos.zillowstatic.com/fp/5d72e46f3250e0bf71a5b2a343e8e46b-p_e.jpg",
];

const AREA_CODES = [
  { code: "+1", label: "+1 美国/加拿大", flag: "🇺🇸" },
  { code: "+86", label: "+86 中国", flag: "🇨🇳" },
];

function getStorageKey(agentId: string) {
  return `browse_client_${agentId}`;
}

export default function BrowseRegister() {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [areaCode, setAreaCode] = useState("+1");
  const [areaDropdownOpen, setAreaDropdownOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [wechat, setWechat] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Link modal after registration
  const [linkModal, setLinkModal] = useState<{ url: string; clientId: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [smsSending, setSmsSending] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsError, setSmsError] = useState("");

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

  // Check localStorage for existing registration
  useEffect(() => {
    if (!agentId) return;
    try {
      const saved = localStorage.getItem(getStorageKey(agentId));
      if (saved) {
        const { clientId } = JSON.parse(saved);
        if (clientId) {
          navigate(`/browse/${clientId}`, { replace: true });
          return;
        }
      }
    } catch {}
  }, [agentId, navigate]);

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

  const canSubmit = name.trim() && phone.trim();

  const handleSubmit = async () => {
    if (!canSubmit || !agentId) return;
    setSubmitting(true);
    setError("");

    const fullPhone = `${areaCode}${phone.trim()}`;

    try {
      const res = await fetch(`${API_BASE}/api/browse/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId,
          name: name.trim() || undefined,
          phone: fullPhone,
          email: email.trim() || undefined,
          wechat: wechat.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (data.ok && data.clientId) {
        // Save to localStorage
        try {
          localStorage.setItem(
            getStorageKey(agentId),
            JSON.stringify({ clientId: data.clientId })
          );
        } catch {}

        // Show link modal instead of navigating directly
        const browseUrl = `${window.location.origin}/browse/${data.clientId}`;
        setLinkModal({ url: browseUrl, clientId: data.clientId });
      } else {
        setError(data.error || "提交失败，请重试");
      }
    } catch {
      setError("网络错误，请重试");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!linkModal) return;
    try {
      await navigator.clipboard.writeText(linkModal.url);
    } catch {
      window.prompt("请复制以下链接：", linkModal.url);
    }
    setCopied(true);
    setTimeout(() => {
      navigate(`/browse/${linkModal.clientId}`, { replace: true });
    }, 1200);
  };

  const handleSendSms = async () => {
    if (!linkModal || !phone.trim()) return;
    setSmsSending(true);
    setSmsError("");

    const fullPhone = `${areaCode}${phone.trim()}`;

    try {
      const res = await fetch(`${API_BASE}/api/browse/send-sms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fullPhone,
          clientId: linkModal.clientId,
          browseUrl: linkModal.url,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        setSmsSent(true);
      } else {
        setSmsError(data.error || "发送失败");
      }
    } catch {
      setSmsError("网络错误，请重试");
    } finally {
      setSmsSending(false);
    }
  };

  const selectedArea = AREA_CODES.find((a) => a.code === areaCode) || AREA_CODES[0];

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

          {/* Phone with area code */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Phone className="h-4 w-4 text-green-600" />
              电话 / Phone
              <Star className="h-2 w-2 text-red-500 fill-red-500" />
            </label>
            <div className="flex gap-2">
              {/* Area code dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setAreaDropdownOpen(!areaDropdownOpen)}
                  className="flex items-center gap-1 border-2 border-gray-200 rounded-xl px-3 py-3 text-sm bg-gray-50 hover:bg-gray-100 transition min-w-[90px]"
                >
                  <span>{selectedArea.flag}</span>
                  <span className="font-medium">{selectedArea.code}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
                </button>
                {areaDropdownOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setAreaDropdownOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 overflow-hidden min-w-[180px]">
                      {AREA_CODES.map((area) => (
                        <button
                          key={area.code}
                          type="button"
                          onClick={() => {
                            setAreaCode(area.code);
                            setAreaDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-2 px-4 py-3 text-sm hover:bg-blue-50 transition ${
                            areaCode === area.code ? "bg-blue-50 text-blue-600 font-medium" : "text-gray-700"
                          }`}
                        >
                          <span>{area.flag}</span>
                          <span>{area.label}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Phone input */}
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入电话号码"
                className="flex-1 border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 transition"
              />
            </div>
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

      {/* Link modal */}
      {linkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-5">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check className="h-7 w-7 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">注册成功</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                这是您的专属浏览链接，为了方便下次访问<br />
                <span className="font-medium text-gray-700">请先复制保存到浏览器中打开</span>
              </p>
            </div>

            {/* Link display */}
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <p className="text-xs text-gray-500 break-all leading-relaxed select-all">
                {linkModal.url}
              </p>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={copied}
              className={`w-full py-3.5 rounded-xl font-medium text-base transition flex items-center justify-center gap-2 ${
                copied
                  ? "bg-green-500 text-white"
                  : "bg-gradient-to-r from-blue-600 to-indigo-600 text-white active:from-blue-700 active:to-indigo-700 shadow-lg shadow-blue-200"
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-5 w-5" />
                  已复制，正在跳转...
                </>
              ) : (
                <>
                  <Copy className="h-5 w-5" />
                  复制链接
                </>
              )}
            </button>

            {/* Send SMS button */}
            {phone.trim() && (
              <button
                type="button"
                onClick={handleSendSms}
                disabled={smsSending || smsSent}
                className={`w-full py-3 rounded-xl font-medium text-sm transition flex items-center justify-center gap-2 border-2 ${
                  smsSent
                    ? "border-green-200 bg-green-50 text-green-600"
                    : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 active:bg-gray-100"
                }`}
              >
                {smsSent ? (
                  <>
                    <Check className="h-4 w-4" />
                    短信已发送至 {areaCode}{phone.trim()}
                  </>
                ) : smsSending ? (
                  "发送中..."
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    发送链接到我的手机
                  </>
                )}
              </button>
            )}
            {smsError && <p className="text-xs text-red-500 text-center">{smsError}</p>}

            <p className="text-xs text-gray-400 text-center">
              建议将链接保存到浏览器书签，方便随时查看房源
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
