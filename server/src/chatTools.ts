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
  {
    name: "add_client_log",
    description:
      "为客户添加跟进记录。用于记录已经发生的沟通，如打了电话、发了微信、带看了房子等。需要先通过 search_clients 确认客户ID。",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "客户ID（从搜索结果获取）" },
        content: {
          type: "string",
          description: "跟进内容（如：电话沟通，客户表示预算可以提高到500万）",
        },
        nextAction: {
          type: "string",
          description: "下一步计划（可选，如：周五再跟进确认看房时间）",
        },
      },
      required: ["clientId", "content"],
    },
  },
  {
    name: "get_client_detail",
    description:
      "查看客户的详细信息，包括状态、联系方式、预算、需求标签和最近的跟进记录。当用户询问某个客户的情况时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "客户ID（从搜索结果获取）" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "get_client_stats",
    description:
      "获取客户统计概览：总数、各状态分布、各紧急度分布。当用户问「我有多少客户」、「客户情况怎么样」、「目前有多少看房中的」等统计类问题时使用。",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "list_clients_by_filter",
    description:
      "按条件筛选客户列表。可按状态（新客户/看房中/意向强烈/已下Offer/已成交/停滞/暂缓）或紧急度（high/medium/low）筛选。当用户问「看房中的客户有哪些」、「紧急客户」等问题时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        status: {
          type: "string",
          description: "客户状态筛选",
          enum: ["新客户", "看房中", "意向强烈", "已下Offer", "已成交", "停滞", "暂缓"],
        },
        urgency: {
          type: "string",
          description: "紧急度筛选",
          enum: ["high", "medium", "low"],
        },
        limit: {
          type: "number",
          description: "返回数量上限（默认20，最大50）",
        },
      },
    },
  },
];
