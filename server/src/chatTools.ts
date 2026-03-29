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
  {
    name: "get_recent_activity",
    description:
      "获取最近的跟进活动记录。显示最近几天跟进了哪些客户、做了什么。当用户问「最近跟进了谁」、「这几天做了什么」、「工作汇报」时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "查看最近几天的记录（默认7天）",
        },
      },
    },
  },
  {
    name: "get_stale_clients",
    description:
      "获取长时间未跟进的客户列表。当用户问「哪些客户很久没跟进了」、「有没有被遗忘的客户」、「需要跟进的客户」时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "超过多少天未跟进算「长时间」（默认7天）",
        },
      },
    },
  },
  {
    name: "get_new_clients_count",
    description:
      "获取指定时间段内新增的客户数量。当用户问「这周新增了几个客户」、「本月新客户」、「最近有多少新客户」时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "查看最近几天新增的客户（默认7天，传30为本月）",
        },
      },
    },
  },
  {
    name: "get_client_browse_history",
    description:
      "查看客户的房源浏览记录。显示客户通过分享链接看了哪些房子、什么时候看的、有没有收藏。当经纪人问「某客户最近看了什么房」、「客户对哪些房子感兴趣」时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        clientId: { type: "string", description: "客户ID（从搜索结果获取）" },
      },
      required: ["clientId"],
    },
  },
  {
    name: "search_listings",
    description:
      "在 Zillow 上搜索房源。可按城市/地址/邮编搜索，支持价格、卧室数、卫浴数、房屋类型筛选。当用户要求找房子、搜房源时使用。",
    input_schema: {
      type: "object" as const,
      properties: {
        location: {
          type: "string",
          description: "搜索地点（城市名+州缩写，如 'Irvine, CA'；或邮编如 '92602'；或具体地址）",
        },
        listingType: {
          type: "string",
          description: "房源类型：sale（买房，默认）或 rent（租房）",
          enum: ["sale", "rent"],
        },
        minPrice: {
          type: "number",
          description: "最低价格（美元）",
        },
        maxPrice: {
          type: "number",
          description: "最高价格（美元）",
        },
        bedsMin: {
          type: "number",
          description: "最少卧室数",
        },
        bathsMin: {
          type: "number",
          description: "最少卫浴数",
        },
        homeType: {
          type: "string",
          description: "房屋类型",
          enum: ["SINGLE_FAMILY", "CONDO", "TOWNHOUSE", "MULTI_FAMILY", "APARTMENT"],
        },
      },
      required: ["location"],
    },
  },
  {
    name: "get_listing_detail",
    description:
      "获取某个 Zillow 房源的详细信息，包括完整描述、学区、图片、估价等。需要从 search_listings 结果中获取 zpid。",
    input_schema: {
      type: "object" as const,
      properties: {
        zpid: {
          type: "number",
          description: "Zillow 房源 ID（从搜索结果获取）",
        },
      },
      required: ["zpid"],
    },
  },
];
