# Bill Agent + Tool 实现方案

## 现状分析

当前系统已有成熟的 Agent 体系：

- **Agent Mentions**（`aiChatAgentMentions.ts`）：7 个硬编码 agent（people / todo / snippets / journal / notes / today / common），用户通过 `@xxx_agent` token 选择
- **服务端工具链**（`agent/tools/`）：每个 domain 对应一组工具（peopleTool / todoTool / snippetsTool / journalTool / notesTool），工具通过 `toolRegistry.ts` 统一注册
- **Agent Directives**（`agentHints.ts`）：根据前端传来的 `AiChatAgentHint[]` 注入 system directive，引导 AI 优先调用对应工具
- **`billsService.ts` 已存在**：封装了 `list` / `create` / `update` / `delete` / `todaySummary` 等数据库方法，可直接复用

**Bill domain 完全缺失**：无 agent definition、无工具实现、无 directive 配置。

---

## 实施计划

### Step 1: 服务端 — Bills 工具类型定义

**文件**：`src/main/agent/types.ts`

在 `AgentToolInput` / `AgentToolResult` 联合类型中新增 bills 相关类型，参照现有 `PeopleQueryToolInput` 等模式。

```typescript
// 账单查询输入
export interface BillQueryToolInput {
  startDate?: string // 起始日期 YYYY-MM-DD
  endDate?: string // 结束日期 YYYY-MM-DD
  type?: 'income' | 'expense' // 收支类型
  category?: string // 分类
  keyword?: string // 关键词搜索
  limit?: number // 数量限制
}

// 账单条目
export interface BillQueryToolItem {
  id: number
  date: string
  type: 'income' | 'expense'
  amount: number
  category: string
  description: string
  createdAt: string
}

// 账单汇总
export interface BillSummaryToolResult {
  date: string
  totalIncome: number
  totalExpense: number
  balance: number
  items: BillQueryToolItem[]
}
```

---

### Step 2: 服务端 — Bills 工具实现

**文件**：`src/main/agent/tools/billsTool.ts`（新增 ~150 行）

参照 `peopleTool.ts` 模式，实现两个只读工具：

- `bills_tool_list` — 按日期范围/类型/分类查询账单列表
- `bills_tool_summary` — 查询指定日期的收支汇总

```
export const createBillsTools = (billsService: BillsService) => [
  {
    name: 'bills_tool_list',
    schema: z.object({
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      type: z.enum(['income', 'expense']).optional(),
      category: z.string().optional(),
      limit: z.number().optional().default(50),
    }),
    handler: async (input) => { /* → billsService.list() */ },
  },
  {
    name: 'bills_tool_summary',
    schema: z.object({
      date: z.string(), // YYYY-MM-DD
    }),
    handler: async (input) => { /* → billsService.todaySummary() */ },
  },
]
```

**安全考量**：首版仅开放只读工具，不暴露 `create` / `update` / `delete`。

---

### Step 3: 服务端 — 工具注册

**文件**：`src/main/agent/tools/toolRegistry.ts`

三处改动：

1. **imports** 新增：

```typescript
import { createBillsTools } from '@/agent/tools/billsTool'
import type { BillsService } from '@/services/billsService'
```

2. **AgentToolRegistryContext** 新增字段：

```typescript
billsService: Pick<BillsService, 'list' | 'todaySummary'>
```

3. **builtinToolFactories** 数组新增：

```typescript
({ billsService }) => billsService ? createBillsTools(billsService) : [],
```

**文件**：`src/main/ipc/aiHandlers.ts`

创建 registry 时注入 `billsService`：

```typescript
const registry = createAgentToolRegistry({
  // ... 现有 services
  billsService: createBillsService(db),
})
```

---

### Step 4: 服务端 — Agent Directive 配置

**文件**：`src/main/agent/core/agentHints.ts`

两处改动：

1. `AiChatAgentId` 联合类型新增 `'bills'`
2. `AI_CHAT_AGENT_DIRECTIVE_CONFIGS` 数组新增：

```typescript
{
  id: 'bills',
  token: 'bills_agent',
  description: 'Prefer Bills-related expense tracking, income records, and daily summary context.',
  tools: ['bills_tool_list', 'bills_tool_summary'],
}
```

---

### Step 5: 前端 — Agent 定义

**文件**：`src/renderer/src/features/ai-chat/aiChatAgentMentions.ts`

三处改动：

1. `AiChatAgentId` 联合类型新增 `"bills"`：

```typescript
export type AiChatAgentId = "people" | "todo" | "snippets" | "journal" | "notes" | "today" | "common" | "bills";
```

2. `AI_CHAT_AGENT_MENTION_OPTIONS` 数组新增：

```typescript
{
  id: "bills",
  token: "@bills_agent",
  label: "bills",
  description: "检索账单记录，查询收支明细与今日消费摘要",
}
```

3. `AGENT_TOKEN_PATTERN` 正则新增 `bills`：

```typescript
const AGENT_TOKEN_PATTERN = /(^|\s)(@(people|todo|snippets|journal|notes|today|common|bills)_agent)(?=$|\s)/g;
```

---

### Step 6: 前端 — 类型同步

**文件**：`src/renderer/src/features/ai-chat/types.ts`

两处改动：

1. `AiChatAgentHint.id` 联合添加 `"bills"`（第 48 行）
2. `AiChatMessagePart` 的 `agentId` 联合添加 `"bills"`（第 301 行）

---

## 数据流

```
AiChatInput 输入框
  │  用户输入 "@bills 查一下今天花了多少钱"
  │  → parseAiChatAgentMentionText() → { text: "查一下...", agents: [{ id: "bills", priority: 1 }] }
  ▼
useAiChatController → startAiChatMessage
  │  → toAiChatAgentHints() → [{ id: "bills", priority: 1 }]
  │  → window.api.ai.startChat({ agents, ... })
  ▼
IPC → chatRunner → agentHints
  │  → renderAiChatAgentDirective() → 注入 system message:
  │    "1. bills_agent: Prefer Bills-related expense tracking..."
  │    "Current available tools: bills_tool_list, bills_tool_summary."
  ▼
ReAct Agent → AI Model
  │  模型根据 directive 调用 bills_tool_list / bills_tool_summary
  ▼
billsTool.execute() → billsService → SQLite bills 表
  │  工具结果回灌模型 → 生成最终回复
  ▼
AiChatWorkspace → 用户看到回答（含 AiToolCallBlock 工具执行时间线）
```

---

## 不变更文件（数据驱动、无需改动）

| 文件 | 原因 |
|------|------|
| `AiChatInput/AiChatInput.tsx` | 纯视图，不依赖具体 agent |
| `AiChatInput/types.ts` | `AiChatInputCommandId` 不涉及 agent |
| `AiChatInput/constants.ts` | 斜杠命令列表，无关 agent |
| `AiChatInput/utils.ts` | `resolveAgentMentionPanelState` 只检测 `@`，不关心具体 agent |
| `AiChatInput/hooks/useAiChatMentions.ts` | 通过 `getMatchedAiChatAgentMentions()` 自动匹配 |
| `AiChatInput/components/MentionCommandPanels.tsx` | 通用 CommandPanel，数据驱动渲染 |

---

## 风险与验证

| 风险 | 缓解 |
|------|------|
| `AiChatAgentId` 在 3 处定义不同步 | 必须全部更新（前端 2 处 + 后端 1 处） |
| 后端工具未注册时前端 agent 已可用 | `normalizeAiChatAgentHints` 会过滤未知 ID，降级显示 fallback 文案，不崩溃 |
| `bills` 表可能不存在 | 需确认 SQLite schema 已包含 bills 表 |

### 验证项

- [ ] `@bills` 在输入框中能模糊匹配并显示面板
- [ ] 发送后 `AiChatAgentHint` 正确传递到主进程
- [ ] AI 能调用 `bills_tool_list` / `bills_tool_summary`
- [ ] 工具执行时间线在 `AiToolCallBlock` 中正确渲染
- [ ] 上下文管理正确插入 `kind: "tool"` 的上下文条目
- [ ] 切换到其他 agent 时 bills 工具不被错误调用
