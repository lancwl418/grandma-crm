# GrandmaCRM — 房地产轻量 CRM

面向房地产经纪人的轻量级客户关系管理系统，用于跟踪客户、记录跟进、管理待办任务。

## 技术栈

- **前端**: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4
- **后端**: Express (Node.js)
- **数据库**: Supabase (PostgreSQL + Auth)
- **LLM**: Anthropic Claude（AI 意图解析）
- **部署**: Render（Static Site + Web Service）

## 环境变量

### 前端

在项目根目录创建 `.env.local`：

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=                # 生产环境填后端 URL，本地开发留空
```

> 不配置也可运行，使用内存 mock 数据。

### 后端

在 `server/` 目录创建 `.env`（参考 `server/.env.example`）：

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-...
LLM_PROVIDER=anthropic
FRONTEND_URL=http://localhost:5173
PORT=3001
```

## 数据库初始化

1. 在 [Supabase Dashboard](https://supabase.com) 创建项目
2. 进入 SQL Editor，执行 `supabase-schema.sql` 中的全部 SQL
3. 这会创建 `clients` 和 `client_logs` 表，以及 RLS 安全策略

## 本地启动

### 仅前端（无后端，使用 mock 数据 + 本地 regex 解析）

```bash
npm install
npm run dev
# → http://localhost:5173/
```

### 完整启动（前端 + 后端 + AI）

需要两个终端：

```bash
# 终端 1: 启动 Express 后端
cd server
npm install
npm run dev
# → http://localhost:3001/

# 终端 2: 启动前端
npm run dev
# → http://localhost:5173/
# Vite 代理自动将 /api/* → Express 后端
```

## 验证 AI Parse API

```bash
# 确保后端已运行
curl -X POST http://localhost:3001/api/parse \
  -H "Content-Type: application/json" \
  -d '{"utterance":"明天提醒我给王小明打电话"}'

# 期望返回：
# {"intent":"CREATE_TASK","slots":{"clientQuery":"王小明","action":"打电话","dueDateText":"明天"},"confidence":0.95,"traceId":"..."}
```

在聊天面板中测试：

| 输入 | 期望 intent | 关键 slots |
|------|-------------|------------|
| `你好` | GREETING | — |
| `今天有什么任务` | VIEW_TODAY | — |
| `明天提醒我给王小明打电话` | CREATE_TASK | clientQuery=王小明, action=打电话 |
| `找一下王小明` | FIND_CLIENT | clientQuery=王小明 |
| `加个新客户` | ADD_CLIENT | — |
| `打开王小明的资料` | OPEN_CLIENT | clientQuery=王小明 |
| `把王小明的状态改为看房中` | UPDATE_CLIENT | field=status, value=看房中 |

> 如果后端未启动，会自动降级到本地 regex 解析。

## 线上地址

- **前端**: https://grandma-crm-frontend.onrender.com
- **后端**: https://grandma-crm.onrender.com

> Render 免费套餐后端会在 15 分钟无请求后休眠，首次访问约 30 秒启动。

## 部署到 Render

### Static Site（前端）

| 配置 | 值 |
|------|-----|
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |
| Rewrite | `/* → /index.html` |

环境变量：`VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_API_BASE_URL`（后端 Render URL）

### Web Service（后端）

| 配置 | 值 |
|------|-----|
| Root Directory | `server` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Health Check | `/health` |

环境变量：`SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`ANTHROPIC_API_KEY`、`LLM_PROVIDER`、`FRONTEND_URL`（前端 Render URL）

## 常用命令

```bash
# 前端
npm run dev       # 启动前端开发服务器
npm run build     # TypeScript 编译 + Vite 生产构建
npm run lint      # ESLint 检查

# 后端
cd server
npm run dev       # 启动 Express 开发服务器（热重载）
npm run build     # TypeScript 编译
npm start         # 启动生产服务器
```
