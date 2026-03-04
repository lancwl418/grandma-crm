# GrandmaCRM — 房地产轻量 CRM

面向房地产经纪人的轻量级客户关系管理系统，用于跟踪客户、记录跟进、管理待办任务。

## 技术栈

- **前端**: React 19 + TypeScript 5.9 + Vite 7 + Tailwind CSS 4
- **后端**: Firebase Functions (v2) — AI Parse API
- **LLM**: Anthropic Claude（可切换 OpenAI）
- **数据**: Firebase Auth + Firestore（可选，无配置时优雅降级）

## 环境变量

### 前端（可选）

在项目根目录创建 `.env.local`：

```bash
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123
```

> 不配置也可运行，使用内存数据。

### AI Parse API（`functions/.env`）

```bash
LLM_PROVIDER=anthropic          # anthropic 或 openai
ANTHROPIC_API_KEY=sk-ant-...    # Anthropic API Key
ANTHROPIC_MODEL=claude-sonnet-4-20250514  # 可选，默认 claude-sonnet
```

> 此文件已被 `.gitignore` 忽略，不会提交。

## 本地启动

### 仅前端（无 AI Parse API，使用本地 regex 降级）

```bash
npm install
npm run dev
# → http://localhost:5173/
```

### 完整启动（前端 + AI Parse API）

需要两个终端：

```bash
# 终端 1: 启动 Firebase Functions Emulator
cd functions
npm install
npm run build
firebase emulators:start --only functions
# → Functions emulator 运行在 http://localhost:5001/

# 终端 2: 启动前端
npm run dev
# → http://localhost:5173/
# Vite 代理自动将 /api/parse → Firebase emulator
```

> 需要安装 Firebase CLI：`npm install -g firebase-tools`

## 验证 AI Parse API

### 方式 1: curl 直接测试

```bash
# 确保 emulator 已运行
curl -X POST http://localhost:5001/grandma-crm/us-central1/parse \
  -H "Content-Type: application/json" \
  -d '{"utterance":"明天提醒我给王小明打电话"}'

# 期望返回：
# {"intent":"CREATE_TASK","slots":{"clientQuery":"王小明","action":"打电话","dueDateText":"明天"},"confidence":0.95}
```

### 方式 2: 在聊天面板中测试

启动完整环境后，在聊天面板输入以下内容：

| 输入 | 期望 intent | 关键 slots |
|------|-------------|------------|
| `你好` | GREETING | — |
| `今天有什么任务` | VIEW_TODAY | — |
| `明天提醒我给王小明打电话` | CREATE_TASK | clientQuery=王小明, action=打电话, dueDateText=明天 |
| `找一下王小明` | FIND_CLIENT | clientQuery=王小明 |
| `加个新客户` | ADD_CLIENT | — |

> 如果 emulator 未启动，会自动降级到本地 regex 解析，功能不受影响。

## 常用命令

```bash
npm run dev       # 启动前端开发服务器
npm run build     # TypeScript 编译 + Vite 生产构建
npm run lint      # ESLint 检查
npm run preview   # 预览生产构建
```

## Supabase 底层方案（推荐）

如果你要从一开始就搭可扩展底层，使用 Supabase/Postgres：

1. 先执行数据库初始化 SQL：
   - `docs/supabase/001_init_crm.sql`
2. 再按迁移清单逐步替换前后端数据层：
   - `docs/supabase/MIGRATION_PLAN.md`

## 项目结构

```
├── src/                    # 前端源码
│   ├── crm/
│   │   ├── components/     # CRM 业务组件
│   │   ├── utils/
│   │   │   ├── intentParser.ts   # 意图解析（LLM API + 本地 regex 降级）
│   │   │   ├── chatEngine.ts     # 状态机编排器
│   │   │   └── voiceTaskParser.ts # 本地 regex 解析
│   │   ├── constants.ts    # 常量与示例数据
│   │   └── types.ts        # 核心类型定义
│   ├── pages/              # 页面组件
│   └── lib/                # 第三方集成
├── functions/              # Firebase Functions（AI Parse API）
│   ├── src/
│   │   ├── index.ts        # HTTP endpoint + 限流
│   │   ├── parseHandler.ts # 请求校验 + LLM 调用 + 输出校验
│   │   ├── schema.ts       # Zod 校验 schema
│   │   ├── prompt.ts       # LLM system prompt
│   │   └── providers/      # LLM provider 抽象层
│   │       ├── types.ts    # 接口定义
│   │       ├── anthropic.ts # Claude 实现
│   │       ├── openai.ts   # OpenAI stub
│   │       └── index.ts    # 工厂函数
│   └── package.json
├── firebase.json           # Firebase 配置
└── vite.config.ts          # Vite 配置（含 dev proxy）
```
