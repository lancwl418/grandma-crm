// =========================
//  跟进记录（Log）类型
// =========================
export type ClientLog = {
  id: string;
  date: string;            // 2025-11-30
  content: string;         // 跟进内容
  images?: string[];       // 跟进上传图片
  nextAction?: string;     // 下一步计划（文字）
  nextActionTodo?: string; // 下一步具体事项（如加油 / 发房源）
};


// =========================
//   客户（Client）类型
// =========================
export type Client = {
  id: string;

  // 名字相关
  name?: string;        // 真实姓名（小号）
  remarkName: string;   // 昵称 / 微信备注（大号）

  phone?: string;
  wechat?: string;
  birthday?: string; // ISO string date，如 1992-01-11

  status: string;
  urgency: "high" | "medium" | "low";

  tags: string[];

  requirements: {
    budgetMin?: string;
    budgetMax?: string;
    areas: string[];
    type?: string;
    tags: string[];
    notes?: string;
  };

  logs: ClientLog[];
};

export type ClientStatus = {
  label: string;
  color: string;
};

export type UrgencyConfig = {
  value: string;
  label: string;
  Icon: any;
  color: string;
};

export type CRMFilters = {
  tags: string[];
  urgency: string[];
  birthday?: number; // 未来 X 天生日
  keyword: string;
};
