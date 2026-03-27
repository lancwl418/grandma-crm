import type Anthropic from "@anthropic-ai/sdk";

export const CHAT_TOOLS: Anthropic.Messages.Tool[] = [
  {
    name: "search_clients",
    description:
      "搜索客户。根据姓名、备注名模糊匹配查找客户。当用户提到某个客户名字时使用此工具确认客户身份。",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "搜索关键词（客户姓名、备注名或部分名字）",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_followup",
    description:
      "为客户创建跟进任务或待办事项。需要先通过 search_clients 确认客户ID。",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "客户ID（从搜索结果获取）" },
        action: {
          type: "string",
          description: "具体事项（如：打电话跟进、带看XX楼盘、发房源信息）",
        },
        dueDate: {
          type: "string",
          description: "截止日期，格式 YYYY-MM-DD",
        },
      },
      required: ["clientId", "action", "dueDate"],
    },
  },
  {
    name: "update_client",
    description:
      "更新客户信息。需要先通过 search_clients 确认客户ID。可更新字段：status（状态：新客户/看房中/意向强烈/已下Offer/已成交/停滞/暂缓）、urgency（紧急度：high/medium/low）、phone（电话）、wechat（微信）、budget（预算）、tags（标签）。",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "客户ID（从搜索结果获取）" },
        field: {
          type: "string",
          description: "要更新的字段",
          enum: ["status", "urgency", "phone", "wechat", "budget", "tags"],
        },
        value: { type: "string", description: "新的值" },
      },
      required: ["clientId", "field", "value"],
    },
  },
  {
    name: "navigate_to_client",
    description:
      "打开客户的详情页面。当用户要求查看某客户资料，或完成操作后需要引导用户查看时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "客户ID" },
        clientName: { type: "string", description: "客户姓名（用于显示）" },
      },
      required: ["clientId", "clientName"],
    },
  },
  {
    name: "open_add_client_form",
    description: "打开新增客户表单。当用户要求添加或录入新客户时使用。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "show_client_candidates",
    description:
      "当搜索到多个匹配客户、需要用户选择时使用。展示候选客户卡片列表让用户点选。",
    input_schema: {
      type: "object" as const,
      properties: {
        candidates: {
          type: "array",
          description: "候选客户列表",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              status: { type: "string" },
            },
            required: ["id", "name"],
          },
        },
      },
      required: ["candidates"],
    },
  },
  {
    name: "show_today_tasks",
    description:
      "显示今日待办任务列表。当用户问今天有什么任务、有什么要做的，或者打招呼时展示任务概览。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
];
