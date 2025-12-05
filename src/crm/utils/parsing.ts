export type ParsedClient = {
  remarkName?: string;
  name?: string;
  phone?: string;
  wechat?: string;
  birthday?: string;
  budgetMin?: string;
  budgetMax?: string;
  areas?: string[];
  tags?: string[];
  notes?: string;
};

const PHONE_REGEX = /(\+?1[-\s]?)?(\d{3})[-\s]?(\d{3})[-\s]?(\d{4})/;
const WECHAT_REGEX = /微信[:：]?\s*([a-zA-Z0-9_\-]+)/;
const BUDGET_REGEX = /(\d+)\s*[-~到]\s*(\d+)\s*(万|USD|\$)?/;

export function parsePastedClient(text: string): ParsedClient {
  const result: ParsedClient = {
    areas: [],
    tags: []
  };

  const clean = text.trim();

  result.remarkName = clean.split("\n")[0].trim();

  const phoneMatch = clean.match(PHONE_REGEX);
  if (phoneMatch) result.phone = phoneMatch[0];

  const wechatMatch = clean.match(WECHAT_REGEX);
  if (wechatMatch) result.wechat = wechatMatch[1];

  const budgetMatch = clean.match(BUDGET_REGEX);
  if (budgetMatch) {
    result.budgetMin = budgetMatch[1];
    result.budgetMax = budgetMatch[2];
  }

  const AREA_KEYWORDS = ["Irvine", "Tustin", "Chino Hills", "Walnut"];
  AREA_KEYWORDS.forEach((a) => {
    if (clean.includes(a)) result.areas!.push(a);
  });

  const TAG_KEYWORDS = ["学区房", "首次购房", "投资", "急", "仓库"];
  TAG_KEYWORDS.forEach((tag) => {
    if (clean.includes(tag)) result.tags!.push(tag);
  });

  result.notes = clean;

  return result;
}

/** 简单文本识别 */
export function extractInfoFromText(text: string) {
  if (!text) return {};

  const phoneMatch = text.match(/1\d{10}/);
  const nameMatch = text.match(/([A-Za-z\u4e00-\u9fa5]{2,10})/);

  return {
    remarkName: nameMatch?.[1] || "",
    phone: phoneMatch?.[0] || "",
    status: "新客户",
    urgency: "medium"
  };
}

/** 模拟图片 OCR */
export async function extractInfoFromImage(file: File) {
  await new Promise((r) => setTimeout(r, 1500));

  return {
    remarkName: "微信用户",
    phone: "12345678901",
    status: "新客户",
    urgency: "medium"
  };
}
