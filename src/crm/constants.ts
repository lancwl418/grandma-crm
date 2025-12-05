import { Flame, Coffee, Activity } from "lucide-react";
import type { Client, ClientStatus, UrgencyConfig } from "./types";

export const CLIENT_STATUSES: ClientStatus[] = [
  { label: '新客户', color: 'bg-green-100 text-green-700' },
  { label: '看房中', color: 'bg-blue-100 text-blue-700' },
  { label: '意向强烈', color: 'bg-orange-100 text-orange-700' },
  { label: '已下Offer', color: 'bg-purple-100 text-purple-700' },
  { label: '遇到困难/停滞', color: 'bg-yellow-100 text-yellow-800' },
  { label: '已成交', color: 'bg-red-100 text-red-700' },
  { label: '暂缓/冷淡', color: 'bg-gray-100 text-gray-600' }
];

export const URGENCY_LEVELS: Record<string, UrgencyConfig> = {
  high: { value: 'high', label: '非常紧急', Icon: Flame, color: 'bg-rose-100 text-rose-700 border-rose-200' },
  medium: { value: 'medium', label: '中等', Icon: Activity, color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  low: { value: 'low', label: '不急/慢慢看', Icon: Coffee, color: 'bg-gray-100 text-gray-500 border-gray-200' }
};

// 避免你 import 报错
export const SAMPLE_CLIENTS: Client[] = [
  {
    id: "c1",
    name: "王小明",
    remarkName: "学区房客户",
    phone: "1234567890",
    wechat: "wx001",
    birthday: "1990-02-15",
    status: "新客户",
    urgency: "high",
    requirements: {
      budgetMin: "100万",
      budgetMax: "150万",
      areas: ["Irvine", "Tustin"],
      type: "Condo",
      tags: ["学区房", "首次购房"],
      notes: "偏好新小区，靠近学校"
    },
    logs: [
      {
        id: "c1-log-1",
        date: "2025-02-01",
        content: "初次沟通，对 Irvine 地区学区房感兴趣。",
        images: [],
        nextAction: "安排看房",
        nextActionTodo: "下周末安排 2 套看房"
      },
      {
        id: "c1-log-2",
        date: "2025-02-10",
        content: "客户看房后反馈满意度高。",
        images: [],
        nextAction: "跟进预算确认"
      }
    ],
    tags: ["学区房", "首次购房"]
  },

  {
    id: "c2",
    name: "Lisa Huang",
    remarkName: "投资客",
    phone: "9876543210",
    wechat: "lisa-invest",
    birthday: "1985-06-20",
    status: "已成交",
    urgency: "low",
    requirements: {
      budgetMin: "80万",
      budgetMax: "100万",
      areas: ["Costa Mesa", "Anaheim"],
      type: "Townhouse",
      tags: ["投资", "出租需求"],
      notes: "购买后预计长期出租"
    },
    logs: [
      {
        id: "c2-log-1",
        date: "2025-01-12",
        content: "客户想找高租金回报的 townhouse。",
        nextAction: "推荐 Anaheim 区域新盘"
      }
    ],
    tags: ["投资", "出租需求"]
  },

  {
    id: "c3",
    name: "陈建国",
    remarkName: "豪宅客户",
    phone: "6668889999",
    wechat: "cjg-rich",
    birthday: "1978-11-02",
    status: "看房中",
    urgency: "medium",
    requirements: {
      budgetMin: "300万",
      budgetMax: "500万",
      areas: ["Newport Beach", "Laguna Beach"],
      type: "Single House",
      tags: ["豪宅", "海景"],
      notes: "必须有海景与大庭院"
    },
    logs: [
      {
        id: "c3-log-1",
        date: "2025-02-05",
        content: "客户看中一套 Newport Beach 海景房。",
        nextAction: "准备出 offer"
      }
    ],
    tags: ["豪宅", "海景"]
  },

  {
    id: "c4",
    name: "赵丽",
    remarkName: "新移民",
    phone: "1357924680",
    wechat: "zhaoli2025",
    birthday: "1992-12-05",
    status: "暂缓/冷淡",
    urgency: "low",
    requirements: {
      budgetMin: "60万",
      budgetMax: "80万",
      areas: ["Fullerton"],
      type: "Condo",
      tags: ["新移民"],
      notes: "预算有限，需要慢慢看"
    },
    logs: [
      {
        id: "c4-log-1",
        date: "2025-02-01",
        content: "沟通后发现预算有限，决定先不急。",
      }
    ],
    tags: ["新移民"]
  },

  {
    id: "c5",
    name: "Jenny Wu",
    remarkName: "首次购房者",
    phone: "5551231234",
    wechat: "jennyhome",
    birthday: "1994-03-18",
    status: "意向强烈",
    urgency: "high",
    requirements: {
      budgetMin: "70万",
      budgetMax: "90万",
      areas: ["Lake Forest", "Mission Viejo"],
      type: "Townhouse",
      tags: ["首次购房"],
      notes: "希望三房两卫"
    },
    logs: [
      {
        id: "c5-log-1",
        date: "2025-02-05",
        content: "客户非常积极，本周末看房。",
        nextAction: "准备预审贷款"
      }
    ],
    tags: ["首次购房"]
  }
];

export const TAG_OPTIONS = [
  "学区房",
  "投资",
  "新移民",
  "首次购房",
  "出租需求",
  "豪宅",
];

// =========================
//  快速跟进模板（带 emoji）
// =========================
export const QUICK_LOG_TEMPLATES = [
  {
    key: "call_unanswered",
    label: "⚡📞 电话未接",
    content: "致电客户无人接听，已通过微信留言告知事宜。",
  },
  {
    key: "organize_listings",
    label: "⚡🔍 整理房源",
    content: "正在根据客户最新反馈筛选新一轮房源，计划整理好后发送给客户。",
  },
  {
    key: "sent_listings",
    label: "⚡📬 已发房源",
    content: "已通过微信发送最新房源清单，请客户查看并反馈意向。",
  },
  {
    key: "confirmed_viewing",
    label: "⚡📅 确认约看",
    content: "已与客户确认看房时间与地点，提醒提前安排好行程。",
  },
  {
    key: "viewing_satisfied",
    label: "⚡✅ 带看满意",
    content: "本次带看整体满意，客户对其中一两套房源有进一步兴趣。",
  },
  {
    key: "viewing_rejected",
    label: "⚡❌ 带看否决",
    content: "本次带看整体不合适，已与客户沟通具体原因并调整选房方向。",
  },
  {
    key: "still_considering",
    label: "⚡🤔 还在考虑",
    content: "客户表示还在综合比较，计划几天后再做下一步跟进。",
  },
];

// =========================
//  下一步计划：预设选项
// =========================
export const NEXT_ACTION_OPTIONS = [
  {
    emoji: "📅",
    label: "安排看房",
    value: "安排线下看房，确认时间地点。",
  },
  {
    emoji: "📩",
    label: "发送房源",
    value: "发送新一轮匹配房源给客户。",
  },
  {
    emoji: "💰",
    label: "确认贷款方案",
    value: "与客户沟通贷款方案和预算区间。",
  },
  {
    emoji: "🔁",
    label: "跟进反馈",
    value: "通过微信跟进客户对现有房源的反馈。",
  },
];

export const AREAS_MAPPING: Record<string, string> = {
  Irvine: "Irvine（尔湾）",
  Tustin: "Tustin（塔斯廷）",
  "Chino Hills": "Chino Hills（奇诺岗）",
  Walnut: "Walnut（核桃市）",
  DiamondBar: "Diamond Bar（钻石吧）",
};