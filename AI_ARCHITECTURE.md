# AI-Native Assistant Mode — Architecture

> GrandmaCRM AI 助理模式架构文档
> 更新: 2026-02-27

---

## 设计原则

1. **LLM 是解析器+生成器，不是决策引擎** — 不让 LLM 选客户 ID、不让它直接写数据库
2. **数据库决定实体解析** — 客户名 → Client 匹配始终在本地/DB 完成
3. **歧义通过 UI + 确定性过滤解决** — 候选卡片选择 或 提取 filter 后确定性筛选
4. **记忆 = CRM 数据** — 不引入向量数据库，所有知识写回 Client 字段
5. **上下文最小化** — 不发送完整聊天记录给 LLM，只发当前话语 + 最小 sessionHints

---

## 分阶段实施计划

### Phase 1: Core AI Command Loop (第 1-3 周)

**目标**: 用 LLM Parse API 替换本地 regex，保留现有状态机和 UI。

| # | 里程碑 | 负责 | 状态 | 备注 |
|---|--------|------|------|------|
| 1.1 | 本地 regex 意图分类 + slot 提取 | FE | 已完成 | `intentParser.ts` + `voiceTaskParser.ts` |
| 1.2 | 状态机编排器 (IDLE / DISAMBIGUATION / MISSING_SLOTS) | FE | 已完成 | `chatEngine.ts` |
| 1.3 | 消歧 UI（候选卡片 + 点击选择） | FE | 已完成 | `ChatPanel.tsx` |
| 1.4 | 缺失 slot 追问流程 | FE | 已完成 | `askingSlot` 驱动多轮追问 |
| 1.5 | 设计 Parse API 契约 (JSON Schema) | BE+AI | 待做 | 输入: `{ utterance, locale, sessionHints? }` 输出: `ParsedIntent` |
| 1.6 | 实现 Parse API（LLM + system prompt + JSON mode） | BE+AI | 待做 | Temperature 0, function-calling, ~200 tokens |
| 1.7 | 替换 `intentParser.ts:parse()` 为 Parse API 调用 | FE+BE | 待做 | 代码已预留 swap point |
| 1.8 | 新增 `UPDATE_CLIENT` / `OPEN_CLIENT` 意图 | BE+AI | 待做 | 扩展 `IntentType` union |

**支持的意图**: FIND_CLIENT, CREATE_TASK, ADD_CLIENT, VIEW_TODAY, GREETING, UNKNOWN
**待新增**: UPDATE_CLIENT, OPEN_CLIENT

**依赖**: 1.5→1.6→1.7。1.1-1.4 是 1.7 的前置（已完成）。

### Phase 1.5: Session Memory (第 3-4 周)

**目标**: 多轮对话上下文保持，无需发送完整历史给 LLM。

| # | 里程碑 | 负责 | 状态 |
|---|--------|------|------|
| 1.5.1 | 定义 `SessionContext` 类型 (`lastMentionedClientId`, `lastIntent`, `turnCount`) | FE | 待做 |
| 1.5.2 | 将最小上下文注入 Parse API 作为 `sessionHints` | FE+BE | 待做 |
| 1.5.3 | 代词解析："给他打电话" → 关联上次提到的客户 | BE+AI | 待做 |
| 1.5.4 | 上下文接续：FIND_CLIENT 后 → "给他建个任务" | FE | 待做 |

**依赖**: 需要 Phase 1.7 (Parse API 已集成)。

### Phase 2: Structured Workspace Memory (第 5-7 周)

**目标**: 将对话中的知识转为 CRM 结构化数据（areas/budget/tags 等）。

| # | 里程碑 | 负责 | 状态 |
|---|--------|------|------|
| 2.1 | 定义可提取字段映射 (areas/budget/type/tags) | FE+AI | 待做 |
| 2.2 | 构建 Extract API（从日志提取结构化字段） | BE+AI | 待做 |
| 2.3 | 确认 UI（可编辑 chips，接受/拒绝/修改） | FE | 待做 |
| 2.4 | Write-back：合并确认后的字段到 Client | FE | 待做 |
| 2.5 | 批量整理："整理笔记"处理客户所有历史日志 | FE+AI | 待做 |

### Phase 3: Controlled Generate (第 7-9 周，可选)

**目标**: LLM 生成消息草稿/摘要，用户确认后才发送/保存。

| # | 里程碑 | 负责 | 状态 |
|---|--------|------|------|
| 3.1 | 定义 Generate API 契约 (template + context → draft) | BE+AI | 待做 |
| 3.2 | 实现 Generate API | BE+AI | 待做 |
| 3.3 | "帮我写跟进微信" 意图 → 生成草稿 | FE+AI | 待做 |
| 3.4 | "总结客户情况" 意图 → 生成摘要 | FE+AI | 待做 |
| 3.5 | 复制到剪贴板 CTA | FE | 待做 |

### 时间线

```
W1-2:  Phase 1 (Parse API 设计/实现/替换)
W3:    Phase 1.8 + Phase 1.5 前半 (新意图 + session context)
W4:    Phase 1.5 后半 (代词解析 + 上下文接续)
W5-6:  Phase 2 (Extract API + 确认 UI)
W7:    Phase 2 收尾 (Write-back + 批量整理)
W8-9:  Phase 3 (Generate API + 草稿/摘要)
```

---

## 系统流程

### 核心数据流

```
User Input (文字/语音)
       │
       ▼
chatEngine.processInput(input, state, context)
       │
       ├─ IDLE            → handleIdle()    → parse(input, clients)
       ├─ DISAMBIGUATION  → handleDisambiguation()  → 在候选列表中匹配
       └─ MISSING_SLOTS   → handleMissingSlots()    → parseSlot()
       │
       ▼
AssistantResponse {
  text,            // 回复消息
  newState,        // 新状态机状态
  candidates?,     // 消歧候选卡片
  tasks?,          // 内联任务卡片
  ctaClientId?,    // "查看客户" CTA
  sideEffects[]    // 要执行的副作用 (ADD_LOG, OPEN_CLIENT, ...)
}
       │
       ▼
ChatPanel: 渲染消息 + 更新状态 + 执行副作用
```

### Parse API 契约 (Phase 1 替换点)

```
当前 (本地 regex):
  intentParser.ts:parse(input, clients)
    ├─ classifyIntent(input)          → IntentType
    └─ voiceTaskParser.parseVoiceTask(input, clients)
         ├─ parseRelativeDate(text)   → date
         ├─ matchClient(text, clients)→ ClientMatch[]
         └─ extractAction(text, ...)  → string

未来 (LLM Parse API):
  POST /api/parse
  Request: {
    "utterance": "明天提醒我给王小明打电话",
    "locale": "zh-CN",
    "sessionHints": {
      "lastClientName": "陈建国",
      "lastIntent": "FIND_CLIENT"
    }
  }
  Response: {
    "intent": "CREATE_TASK",
    "slots": {
      "clientQuery": "王小明",
      "action": "打电话",
      "dueDateText": "明天",
      "dueDateISO": "2026-02-28"
    },
    "confidence": 0.95
  }

关键: 客户解析 (clientQuery → Client) 始终在本地执行。
LLM 只提取原始字符串，DB 是权威。
```

### 状态机转换

```
                   ┌─────────────┐
                   │    IDLE     │
                   └──┬──────┬──┘
                      │      │
            多个匹配   │      │  缺少 slot
                      ▼      ▼
    ┌───────────────────┐  ┌──────────────────┐
    │ AWAITING_         │  │ AWAITING_        │
    │ DISAMBIGUATION    │  │ MISSING_SLOTS    │
    │ candidates[]      │  │ askingSlot       │
    │ draft 部分填充    │  │ draft 部分填充    │
    └──┬─────────┬──────┘  └──┬─────────┬─────┘
       │         │            │         │
   点击卡片   文字缩小    slot 成功   还缺 slot
       │      范围            │         │
       ▼      ▼              ▼         ▼
    解析到单个客户          循环回 MISSING_SLOTS
       │                        │
       ├── 全部 slot 齐全       全部 slot 齐全
       ▼                        ▼
    ┌────────────────────────────────┐
    │     EXECUTE + RESET → IDLE    │
    └────────────────────────────────┘

  逃逸: 任何非 IDLE 状态下 looksLikeNewIntent() → 放弃当前流程, 回 IDLE
```

---

## QA 测试矩阵

### Phase 1: Core AI Command Loop

| ID | 描述 | 输入 | 期望行为 | 优先级 |
|----|------|------|----------|--------|
| P1-01 | 问候语 | "你好" | 问候 + 待办计数 | P0 |
| P1-02 | 今日待办 | "今天有什么任务" | 内联 BriefingCard 列表 | P0 |
| P1-03 | 精确找客户 | "找一下王小明" | CTA 按钮 → 点击打开详情 | P0 |
| P1-04 | 模糊找（消歧） | "帮我找王" | 候选卡片, AWAITING_DISAMBIGUATION | P0 |
| P1-05 | 消歧点击 | 点击候选卡片 | 选中 → 打开详情 | P0 |
| P1-06 | 消歧文字缩小 | "学区" | 从候选中筛出含"学区"的 | P1 |
| P1-07 | 创建任务(齐全) | "明天提醒我给王小明打电话" | 直接创建, ADD_LOG | P0 |
| P1-08 | 创建任务(缺客户) | "明天提醒我打电话" | 追问客户 | P0 |
| P1-09 | 创建任务(缺日期) | "提醒我给王小明打电话" | 追问日期 | P0 |
| P1-10 | 补充日期 | P1-09 后 "后天" | 创建成功 | P0 |
| P1-11 | 补充客户 | P1-08 后 "王小明" | 匹配客户 | P0 |
| P1-12 | 中途意图切换 | AWAITING 时 "今天有什么任务" | 放弃当前, 展示待办 | P1 |
| P1-13 | 添加客户 | "加个新客户" | 打开 AddClientPopup | P0 |
| P1-14 | 无法识别 | "天气怎么样" | 帮助提示 | P1 |
| P1-15 | 姓+称呼 | "找王先生" | 匹配姓王客户 | P1 |
| P1-16 | 日期下周三 | "下周三提醒我给陈建国看房" | dueDate = 下周三 | P1 |
| P1-17 | Parse API 超时 | API 失败 | 降级本地 regex | P0 |
| P1-18 | CTA 跳转 | 点"查看客户" | ClientDetail 页面 | P0 |

### Phase 1.5: Session Memory

| ID | 描述 | 输入 | 期望行为 | 优先级 |
|----|------|------|----------|--------|
| P1.5-01 | 代词"他" | "找王小明" → "给他建个任务" | "他"=王小明 | P0 |
| P1.5-02 | "这个客户" | "找陈建国" → "这个客户怎样" | 关联陈建国 | P0 |
| P1.5-03 | 连续操作 | 建完任务 → "再加一个后天的" | 复用客户 | P1 |
| P1.5-04 | 超时重置 | 5分钟后 "给他打电话" | 追问客户 | P1 |

### Phase 2: Structured Workspace Memory

| ID | 描述 | 输入 | 期望行为 | 优先级 |
|----|------|------|----------|--------|
| P2-01 | 提取预算 | 日志 "预算80到100万" | budgetMin/Max 确认 UI | P0 |
| P2-02 | 提取区域 | "对尔湾学区房感兴趣" | areas + tags chips | P0 |
| P2-03 | 拒绝提取 | 用户点删除 | 不写入 Client | P0 |
| P2-04 | 批量整理 | "整理笔记" | 处理全部日志 | P1 |

### Phase 3: Controlled Generate

| ID | 描述 | 输入 | 期望行为 | 优先级 |
|----|------|------|----------|--------|
| P3-01 | 草拟微信 | "帮我写跟进微信给王小明" | 草稿 (含客户名/跟进) | P0 |
| P3-02 | 客户总结 | "总结王小明情况" | 3-5 条摘要 | P0 |
| P3-03 | 不编造细节 | 生成微信 | 只引用 CRM 数据 | P0 |
| P3-04 | 找不到客户 | "写微信给张三" | "未找到" | P1 |

---

## Non-Goals（明确不做的事）

### 架构

- **LLM 作为决策引擎** — 幻觉风险，LLM 不决定写哪条数据
- **向量数据库 / 隐式记忆** — CRM 字段就是结构化记忆
- **全局状态管理库** (Redux/Zustand) — useState 足够
- **多 Agent 链 / LangChain** — 单轮解析 + 单轮生成即可
- **后端 REST 持久化** — 本阶段用内存 + Firebase(可选)

### 功能

- **微信 API 集成** — 个人号不开放，复制到剪贴板即可
- **自动发送房源推荐** — 经纪人需把关，只做草稿
- **MLS 房源对接** — 接入成本高，CRM 聚焦客户管理
- **多用户/团队协作** — 需要 RBAC，当前面向单人
- **日历集成** — nextAction 日期已够驱动提醒

### AI/LLM

- **发送完整聊天记录给 LLM** — Token 爆炸 + 隐私风险
- **LLM 做客户 ID 解析** — 必须本地 matchClient() 或 DB
- **Fine-tune 模型** — 5-6 个意图 few-shot 足够
- **流式输出** — Parse ~200 tokens, Generate < 500 字
- **本地/端侧 LLM** — 浏览器跑不了有用的模型

### UX

- **语音合成 (TTS) 回复** — 中英混杂 TTS 质量差
- **助理人格/情感化回复** — 专业工具，简洁确认式最优
- **多模态输入（图片分析）** — 需要 vision model，范围大
- **对话记录持久化** — 助理对话是临时工具性的，CRM 数据才需持久化

---

## 关键文件索引

| 文件 | 职责 |
|------|------|
| `src/crm/utils/intentParser.ts` | 意图解析层 (LLM swap point) |
| `src/crm/utils/chatEngine.ts` | 状态机编排器 |
| `src/crm/utils/voiceTaskParser.ts` | 本地 regex 解析 (日期/客户/动作) |
| `src/crm/components/ChatPanel.tsx` | 聊天 UI + 状态管理 |
| `src/pages/AssistantDashboard.tsx` | 助理主页面 + 副作用分发 |
| `src/crm/components/AssistantAvatar.tsx` | AI 头像动画 |
| `src/crm/components/RadialActionMenu.tsx` | 径向操作菜单 |
| `src/crm/components/ClientSearchOverlay.tsx` | 搜索覆盖层 |
| `src/crm/types.ts` | 核心类型 (Client, ClientLog) |

---

## 成功指标

> 30 秒内，新用户可以：说出一个任务 → 解决客户歧义 → 成功创建任务。
>
> 助理感觉：确定性、有帮助、不会"幻觉"、不复杂。
