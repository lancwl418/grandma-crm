# GrandmaCRM — 房地产轻量 CRM

## 项目简介

面向房地产经纪人的轻量级客户关系管理系统，用于跟踪客户、记录跟进、管理待办任务。

## 技术栈

- **前端**: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4
- **后端**: Express (Node.js)，位于 `server/` 目录
- **数据库**: Supabase (PostgreSQL) + Auth
- **LLM**: Anthropic Claude（可切换 OpenAI）
- **样式**: Tailwind CSS 4 (utility-first，无自定义 config 文件)
- **路由**: React Router DOM 7
- **UI 组件**: Radix UI（Dialog、DropdownMenu、Avatar 等）
- **图标**: lucide-react
- **代码规范**: ESLint 9 flat config + typescript-eslint
- **部署**: Render（Static Site + Web Service）

## 常用命令

```bash
# 前端
npm run dev       # 启动开发服务器（Vite HMR）
npm run build     # TypeScript 编译 + Vite 生产构建（tsc -b && vite build）
npm run lint      # ESLint 检查
npm run preview   # 预览生产构建

# 后端
cd server
npm run dev       # 启动 Express 开发服务器（tsx watch，端口 3001）
npm run build     # TypeScript 编译
npm start         # 启动生产服务器
```

## 项目结构

```
├── src/                       # 前端源码
│   ├── components/            # 全局共享组件（AuthGuard, Header, Sidebar）
│   ├── crm/
│   │   ├── components/        # CRM 业务组件（20+ 个）
│   │   ├── utils/             # 工具函数
│   │   │   ├── intentParser.ts     # 意图解析（LLM API + 本地 regex 降级）
│   │   │   ├── chatEngine.ts       # 状态机编排器
│   │   │   ├── dashboardTasks.ts   # 任务提取与分类（逾期/今日/本周）
│   │   │   ├── date.ts             # 日期与生日工具
│   │   │   └── parsing.ts          # 文本解析（电话、微信、预算等）
│   │   ├── ai/                # AI 集成
│   │   │   ├── toolClient.ts  # 前端工具调用客户端
│   │   │   └── parseContract.ts
│   │   ├── constants.ts       # 状态、标签、示例数据等常量
│   │   └── types.ts           # 核心类型定义（Client, ClientLog, CRMFilters）
│   ├── layout/                # 布局组件（AppLayout）
│   ├── lib/                   # 第三方集成
│   │   ├── supabase.ts        # Supabase 客户端（Auth + 数据）
│   │   └── clientService.ts   # 数据访问层（CRUD）
│   ├── pages/                 # 页面组件（Dashboard, Login, RealEstateCRM）
│   ├── routes/                # 路由配置（AppRoutes）
│   ├── App.tsx                # 应用入口
│   └── main.tsx               # Vite 入口
├── server/                    # Express 后端
│   ├── src/
│   │   ├── index.ts           # Express 入口 + CORS + 路由
│   │   ├── routes/
│   │   │   ├── parse.ts       # POST /api/parse
│   │   │   └── tools.ts       # POST /api/tools/execute
│   │   ├── middleware/
│   │   │   └── rateLimiter.ts # IP 限流（30次/分钟）
│   │   ├── lib/
│   │   │   └── supabase.ts    # Supabase admin client
│   │   ├── parseHandler.ts    # 请求校验 + LLM 调用 + 输出校验
│   │   ├── schema.ts          # Zod 校验 schema
│   │   ├── prompt.ts          # LLM system prompt
│   │   ├── providers/         # LLM provider 抽象层
│   │   └── tools/             # 工具执行（搜索客户、创建任务等）
│   └── package.json
├── supabase-schema.sql        # 数据库建表 + RLS SQL
└── vite.config.ts             # Vite 配置（含 dev proxy → Express）
```

## 路由

```
/           → 重定向到 /app
/app        → 布局壳（Sidebar + Header）
  /app      → Dashboard（工作台，默认首页）
  /app/clients → RealEstateCRM（客户列表与详情）
*           → 重定向到 /app
```

## 核心数据模型

定义在 `src/crm/types.ts`：

- **Client**: 客户主体（姓名、电话、微信、状态、紧急度、需求、标签、跟进日志）
- **ClientLog**: 跟进记录（日期、内容、图片、下一步行动）
- **CRMFilters**: 筛选条件

客户状态：新客户 → 看房中 → 意向强烈 → 已下 Offer → 已成交（另有停滞/暂缓）

数据库表：`clients`（客户）+ `client_logs`（跟进记录），通过 RLS 按 user_id 隔离。

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/parse` | LLM 意图解析（限流 30次/分钟） |
| POST | `/api/tools/execute` | 工具执行（搜索、创建任务、更新客户） |
| GET | `/health` | 健康检查 |

## 环境变量

### 前端 (`.env.local`)

```bash
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=               # 生产环境填后端 URL，dev 留空
```

### 后端 (`server/.env`)

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=your-api-key
LLM_PROVIDER=anthropic
FRONTEND_URL=http://localhost:5173
PORT=3001
```

## 路径别名

在 `tsconfig.json` 和 `vite.config.ts` 中统一配置：

```
@/*           → src/*
@components/* → src/components/*
@pages/*      → src/pages/*
@lib/*        → src/lib/*
```

## 编码规范

- 使用 TypeScript strict 模式
- 状态管理使用 React hooks（useState/useCallback/useMemo），无全局状态库
- 组件使用函数式组件 + hooks
- 样式使用 Tailwind CSS utility class，不写自定义 CSS
- UI 语言为中文
- 不使用测试框架（当前无测试）
