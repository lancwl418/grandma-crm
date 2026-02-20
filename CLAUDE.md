# GrandmaCRM — 房地产轻量 CRM

## 项目简介

面向房地产经纪人的轻量级客户关系管理系统，用于跟踪客户、记录跟进、管理待办任务。

## 技术栈

- **框架**: React 19 + TypeScript 5.9
- **构建**: Vite 7
- **样式**: Tailwind CSS 4 (utility-first，无自定义 config 文件)
- **路由**: React Router DOM 7
- **UI 组件**: Radix UI（Dialog、DropdownMenu、Avatar 等）
- **图标**: lucide-react
- **后端**: Firebase（Auth + Firestore，可选，无配置时优雅降级）
- **代码规范**: ESLint 9 flat config + typescript-eslint

## 常用命令

```bash
npm run dev       # 启动开发服务器（Vite HMR）
npm run build     # TypeScript 编译 + Vite 生产构建（tsc -b && vite build）
npm run lint      # ESLint 检查
npm run preview   # 预览生产构建
```

## 项目结构

```
src/
├── components/          # 全局共享组件（AuthGuard, Header, Sidebar）
├── crm/
│   ├── components/      # CRM 业务组件（20+ 个）
│   ├── utils/           # 工具函数
│   │   ├── dashboardTasks.ts   # 任务提取与分类（逾期/今日/本周）
│   │   ├── date.ts             # 日期与生日工具
│   │   ├── parsing.ts          # 文本解析（电话、微信、预算等）
│   │   └── selectNextActions.ts # Top 3 客户智能选择算法
│   ├── constants.ts     # 状态、标签、示例数据等常量
│   └── types.ts         # 核心类型定义（Client, ClientLog, CRMFilters）
├── layout/              # 布局组件（AppLayout）
├── lib/                 # 第三方集成（firebase.ts）
├── pages/               # 页面组件（Dashboard, Home, Login, RealEstateCRM）
├── routes/              # 路由配置（AppRoutes）
├── App.tsx              # 应用入口
└── main.tsx             # Vite 入口
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
