import { Megaphone, Sparkles } from "lucide-react";

export default function MarketingPage() {
  return (
    <div className="h-full w-full bg-slate-50 flex flex-col items-center justify-center p-6 pb-20">
      <div className="w-20 h-20 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center mb-6">
        <Megaphone className="h-10 w-10 text-white" />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mb-2">营销中心</h1>
      <p className="text-sm text-gray-400 mb-6 text-center">即将上线</p>
      <div className="bg-white rounded-xl border border-gray-100 p-5 max-w-sm w-full space-y-3">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-orange-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">智能推荐房源</p>
            <p className="text-xs text-gray-400">根据客户偏好自动推荐匹配房源</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-pink-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">批量分享</p>
            <p className="text-xs text-gray-400">一键将精选房源发送给多个客户</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">数据分析</p>
            <p className="text-xs text-gray-400">客户行为洞察与转化分析</p>
          </div>
        </div>
      </div>
    </div>
  );
}
