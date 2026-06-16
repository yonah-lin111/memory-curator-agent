# Memory Curator Agent — 策展功能实现方案

## 现状分析

当前代码库已有成熟的 Electron + React + TypeScript + SQLite (Drizzle) 架构，包含：

- 完整的 AI ReAct Agent 对话系统（工具调用、流式输出、多 provider）
- 日常记录 CRUD（Todos、Snippets、Journals、Notes、People）
- Weekly Review 页面：数据仪表盘已完成（ECharts 图表），但 **AI 总结面板为占位符**
- Themes / Memories 页面：纯 `COMING SOON` 空壳

**核心策展能力（AI 总结、主题追踪、记忆关联、模式识别）全部缺失。**

---

## Phase 1: AI 周度总结

### 目标

替换 WeeklyReviewPage 右下角 `"总结功能筹备中..."` 占位符，实现一键 AI 总结当周数据，流式输出。

### 1.1 数据库 — `weekly_summaries` 表

在 `src/main/db/schema.ts` 新增：

```typescript
export const weeklySummaries = sqliteTable("weekly_summaries", {
  id: integer().primaryKey({ autoIncrement: true }),
  weekStartDate: text("week_start_date").notNull().unique(), // 'YYYY-MM-DD' (周一)
  title: text().notNull(),
  content: text().notNull(), // Markdown 格式
  modelUsed: text("model_used"),
  generatedAt: text("generated_at").notNull(), // 'YYYY-MM-DD HH:mm'
});

export type WeeklySummaryItem = typeof weeklySummaries.$inferSelect;
export type WeeklySummarySaveInput = Pick<
  typeof weeklySummaries.$inferInsert,
  "weekStartDate" | "title" | "content" | "modelUsed" | "generatedAt"
>;
```

### 1.2 Service — `weeklySummaryService.ts`

**新文件** `src/main/services/weeklySummaryService.ts`：

```typescript
// 遵循现有 pattern：定义局部 DatabaseConnection/Statement + 工厂函数
type DatabaseStatement = {
  all: (...v) => unknown[];
  get: (...v) => unknown;
  run: (...v) => unknown;
};
type DatabaseConnection = { prepare: (sql: string) => DatabaseStatement };

type WeeklySummaryService = {
  getByWeekStart: (weekStartDate: string) => WeeklySummaryItem | null;
  save: (input: WeeklySummarySaveInput) => WeeklySummaryItem;
  delete: (weekStartDate: string) => void;
};

export const createWeeklySummaryService = (
  database: DatabaseConnection,
): WeeklySummaryService => {
  // getByWeekStart — SELECT 按 week_start_date 查唯一行
  // save — INSERT OR REPLACE (upsert)
  // delete — DELETE WHERE week_start_date = ?
};
```

### 1.3 IPC Handler — `weeklyHandlers.ts`

**新文件** `src/main/ipc/weeklyHandlers.ts`：

| IPC Channel               | 用途                    | 实现                                  |
| ------------------------- | ----------------------- | ------------------------------------- |
| `weekly:summary:get`      | 获取某周总结            | `weeklySummaryService.getByWeekStart` |
| `weekly:summary:save`     | 手动保存/编辑           | `weeklySummaryService.save`           |
| `weekly:summary:delete`   | 删除总结                | `weeklySummaryService.delete`         |
| `weekly:summary:generate` | AI 流式生成总结（核心） | 见下方详述                            |

#### `weekly:summary:generate` 流程

**不走完整 ReAct Agent Loop**（无工具调用需求），直接用 `provider.streamTurn()` 做 text-in/text-out 流式生成：

1. 接收参数：`{ weekStartDate: string, model?: AppModelConfig }`
2. 通过 `dailyService.listDay()` 并发拉取周一至周日 7 天的 `DayData`
3. 从 config 获取 provider 配置，调用 `createModelProvider(providerConfig)`
4. 构造 system prompt（策展指令 + 当周 JSON 数据摘要）和 user message
5. 调用 `provider.streamTurn({ model, messages, signal })` 流式输出
6. 每个 `text_delta` → `webContents.send('weekly:summary:delta', { text })`
7. 收集完整文本 → 提取标题（LLM 输出首行） → 写入 `weekly_summaries` 表
8. 发送 `weekly:summary:done` 事件（含 id, title, content）

### 1.4 UI 改造

修改 `WeeklyReviewPage.tsx` 右列面板：

**新增 `<WeeklySummaryPanel>` 子组件**，状态机：

```
idle ──→ loading ──→ streaming ──→ done
  │                                    │
  └──────── 重新生成 ─────────────────┘
```

- **Idle**：已有总结 → 渲染 Markdown；无总结 → 显示「生成周度总结」按钮
- **Loading**：按钮变 loading spinner
- **Streaming**：`useRef` 累积文本 + `requestAnimationFrame` 批量渲染，避免频繁 DOM 更新
- **Done**：Markdown 渲染 + 「重新生成」「编辑」操作按钮
- **依赖**：`window.api.weekly.summary.get()` / `.generate()` / `.save()` / `.delete()`
- 监听 `ipcRenderer.on('weekly:summary:delta')` / `'weekly:summary:done'`

### 1.5 注册点

| 文件                                        | 变更                                                |
| ------------------------------------------- | --------------------------------------------------- |
| `src/main/db/schema.ts`                     | 新增 `weeklySummaries` 表 + 类型                    |
| `src/main/services/weeklySummaryService.ts` | **新文件**                                          |
| `src/main/ipc/weeklyHandlers.ts`            | **新文件**                                          |
| `src/main/index.ts`                         | `app.whenReady()` 中调用 `registerWeeklyHandlers()` |
| `src/preload/index.ts`                      | 暴露 `window.api.weekly` 命名空间                   |
| `src/renderer/src/pages/weekly-review/`     | 新增 `WeeklySummaryPanel.tsx`，修改主页面           |

---

## Phase 2: 长期主题追踪（Themes）

### 目标

用户手动定义 + AI 自动建议长期主题（如「职业转型」「亲密关系」等），将笔记/日记/片段关联到主题，追踪叙事演变。

### 2.1 数据库 — `themes` + `theme_items` 表

在 `src/main/db/schema.ts` 新增：

```typescript
// themes 表 — 主题定义
export const themes = sqliteTable("themes", {
  id: integer().primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull().unique(), // UUID
  name: text().notNull(),
  description: text().notNull().default(""),
  color: text(), // 可选 hex
  status: text().notNull().default("active"), // 'active' | 'archived'
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// theme_items 表 — 主题 ↔ 素材 多对多
export const themeItems = sqliteTable(
  "theme_items",
  {
    id: integer().primaryKey({ autoIncrement: true }),
    externalId: text("external_id").notNull().unique(),
    themeExternalId: text("theme_external_id").notNull(),
    sourceType: text("source_type").notNull(), // 'note' | 'journal' | 'snippet'
    sourceId: text("source_id").notNull(),
    relevanceNote: text().notNull().default(""),
    aiExtracted: integer("ai_extracted").notNull().default(0), // 0=手动, 1=AI
    createdAt: text("created_at").notNull(),
    // 唯一约束: (theme_external_id, source_type, source_id)
  },
  (table) => ({
    uniqueThemeSource: unique().on(
      table.themeExternalId,
      table.sourceType,
      table.sourceId,
    ),
  }),
);
```

导出类型：`ThemeItem`, `ThemeCreateInput`, `ThemeUpdateInput`, `ThemeItemItem`, `ThemeItemsCreateInput`

### 2.2 Service — `themesService.ts`

**新文件** `src/main/services/themesService.ts`：

| 方法                                                | 用途                                      |
| --------------------------------------------------- | ----------------------------------------- |
| `list()`                                            | 获取所有主题                              |
| `getByExternalId(id)`                               | 单个主题                                  |
| `create(input)`                                     | 新建（生成 externalId）                   |
| `update(id, input)`                                 | 更新名称/描述/状态                        |
| `delete(id)`                                        | 删除（级联删除 items）                    |
| `addItem(themeExternalId, input)`                   | 添加关联条目                              |
| `removeItem(themeExternalId, sourceType, sourceId)` | 移除关联                                  |
| `listItems(themeExternalId)`                        | 某主题的所有关联条目（join 源表获取摘要） |
| `querySql(sql)`                                     | 供 AI Agent 原始查询                      |

### 2.3 Agent Tool — `themeTool.ts`

**新文件** `src/main/agent/tools/themeTool.ts`：

| 工具                     | 类型           | 说明                    |
| ------------------------ | -------------- | ----------------------- |
| `theme_tool_query`       | 查询           | 列出主题/关联，支持 sql |
| `theme_tool_add`         | 写入（带确认） | 创建新主题              |
| `theme_tool_update`      | 写入（带确认） | 更新主题                |
| `theme_tool_delete`      | 写入（带确认） | 删除主题                |
| `theme_tool_item_add`    | 写入（带确认） | 关联素材到主题          |
| `theme_tool_item_remove` | 写入（带确认） | 移除关联                |

分组导出：`createThemeTools(themesService): AgentTool[]`

### 2.4 IPC — `themesHandlers.ts`

**新文件** `src/main/ipc/themesHandlers.ts`：

```
themes:list / themes:create / themes:update / themes:delete
themes:items:list / themes:items:add / themes:items:remove
```

### 2.5 UI — ThemesPage 重写

当前 `ThemesPage.tsx`（15 行占位符）→ 完整页面：

- **左列（主题列表，~w-80）**：卡片式主题列表，含名称/描述/状态标签/关联数，支持新建/编辑/归档
- **右列（主题详情）**：选中主题后展开，显示：
  - 主题基本信息（名称、描述、时间范围）
  - 关联素材时间线（按时间排序，来源类型图标区分 note/journal/snippet）
  - 每条素材的可展开预览 + 关联说明 + AI/手动标记
- **交互**：AI Chat 中 `@curation 帮我分析本周日记的主要主题` → Agent 用 tool 读取日记 → 建议新主题或关联

### 2.6 注册点

| 文件                                   | 变更                       |
| -------------------------------------- | -------------------------- |
| `src/main/db/schema.ts`                | 新增 2 表 + 类型           |
| `src/main/services/themesService.ts`   | **新文件**                 |
| `src/main/agent/tools/themeTool.ts`    | **新文件**                 |
| `src/main/agent/tools/toolRegistry.ts` | 注册 themeTools            |
| `src/main/ipc/themesHandlers.ts`       | **新文件**                 |
| `src/main/index.ts`                    | `registerThemesHandlers()` |
| `src/preload/index.ts`                 | `window.api.themes`        |
| `src/renderer/src/pages/themes/`       | 重写为完整页面             |

---

## Phase 3: 记忆关联（Memories）

### 目标

AI 在用户素材之间发现并建立有意义的线索连接（如「这篇笔记提到的概念 A 和 3 个月前那段日记呼应」），帮助用户看到碎片之间的联系。

### 3.1 数据库 — `memory_links` 表

在 `src/main/db/schema.ts` 新增：

```typescript
export const memoryLinks = sqliteTable("memory_links", {
  id: integer().primaryKey({ autoIncrement: true }),
  externalId: text("external_id").notNull().unique(),
  // 源
  sourceType: text("source_type").notNull(), // 'note' | 'journal' | 'snippet' | 'todo'
  sourceId: text("source_id").notNull(),
  sourceExcerpt: text("source_excerpt").notNull().default(""), // 源内容摘要
  // 目标
  targetType: text("target_type").notNull(),
  targetId: text("target_id").notNull(),
  targetExcerpt: text("target_excerpt").notNull().default(""),
  // 关联元数据
  linkType: text("link_type").notNull().default("related"), // related | contradicts | extends | references
  description: text().notNull(), // AI 生成的关联描述
  confidence: integer().notNull().default(50), // 0-100
  status: text().notNull().default("suggested"), // suggested | confirmed | dismissed
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

导出类型：`MemoryLinkItem`, `MemoryLinkCreateInput`, `MemoryLinkUpdateInput`

### 3.2 Service — `memoryLinksService.ts`

**新文件** `src/main/services/memoryLinksService.ts`：

| 方法                                 | 用途                                          |
| ------------------------------------ | --------------------------------------------- |
| `list(params)`                       | 分页列表，支持 status/linkType 筛选、时间倒序 |
| `getByExternalId(id)`                | 单条关联详情                                  |
| `create(input)`                      | 创建关联（含 externalId）                     |
| `update(id, input)`                  | 更新状态/描述/类型                            |
| `delete(id)`                         | 删除                                          |
| `findBySource(sourceType, sourceId)` | 查找某条目的所有关联                          |
| `querySql(sql)`                      | AI Agent 原始查询                             |

### 3.3 Agent Tool — `memoryLinkTool.ts`

**新文件** `src/main/agent/tools/memoryLinkTool.ts`：

| 工具                       | 类型           | 说明                                         |
| -------------------------- | -------------- | -------------------------------------------- |
| `memory_link_tool_query`   | 查询           | 查询已有关联，支持过滤                       |
| `memory_link_tool_suggest` | 查询（核心）   | 给定源条目，搜索可能的相关条目并返回候选列表 |
| `memory_link_tool_add`     | 写入（带确认） | 创建新关联                                   |
| `memory_link_tool_update`  | 写入（带确认） | 确认/驳回/编辑关联                           |
| `memory_link_tool_delete`  | 写入（带确认） | 删除关联                                     |

`memory_link_tool_suggest` 逻辑：

```
输入: { sourceType, sourceId, maxResults? }
执行:
  1. 读取源内容 → 提取关键概念（用 LLM 或简单 TF-IDF 分词）
  2. 搜索同类型 + 跨类型近期条目（各 service 的 querySql/全文搜索）
  3. 返回候选匹配列表（每条含 excerpt + relevance score）
AI 基于此分析 → 调用 add 工具创建关联
```

### 3.4 IPC — `memoryHandlers.ts`

**新文件** `src/main/ipc/memoryHandlers.ts`：

```
memories:links:list / create / update / delete / find-suggestions
```

### 3.5 UI — MemoriesPage 重写

当前 `MemoriesPage.tsx`（15 行占位符）→ 完整页面：

- **顶部工具栏**：状态筛选（suggested/confirmed/dismissed）+ 关联类型筛选 + 跳转 AI Chat 入口
- **主区域 — 记忆卡片瀑布流**：
  - 双面板对比布局（左=源片段，右=目标片段）
  - 中间连接线 + `linkType` 徽章 + 置信度进度条
  - 描述文字 + 时间戳
  - 操作栏：✅ 确认 / ❌ 驳回 / ✏️ 编辑 / 🔗 跳转到源页面
- **空态**：引导文案「尚未发现记忆关联，尝试在 AI 对话中说 '@curation 帮我找到与这篇笔记相关的其他记忆'」

### 3.6 注册点

| 文件                                      | 变更                         |
| ----------------------------------------- | ---------------------------- |
| `src/main/db/schema.ts`                   | 新增 `memoryLinks` 表 + 类型 |
| `src/main/services/memoryLinksService.ts` | **新文件**                   |
| `src/main/agent/tools/memoryLinkTool.ts`  | **新文件**                   |
| `src/main/agent/tools/toolRegistry.ts`    | 注册 memoryLinkTools         |
| `src/main/ipc/memoryHandlers.ts`          | **新文件**                   |
| `src/main/index.ts`                       | `registerMemoryHandlers()`   |
| `src/preload/index.ts`                    | `window.api.memories`        |
| `src/renderer/src/pages/memories/`        | 重写为完整页面               |

---

## Phase 4: Agent 主动策展交互

### 目标

将 Phase 1-3 的所有能力注入 AI Agent，让策展成为 Agent 的核心能力之一。

### 4.1 新增 curaton agent

修改 `src/main/agent/core/agentHints.ts`：

```typescript
// AiChatAgentId 新增
type AiChatAgentId = 'people' | 'todo' | 'snippets' | 'journal'
  | 'notes' | 'today' | 'common' | 'curation'

// 新增 directive config
{
  token: 'curation_agent',
  description: 'Prefer Memory Curation tools: weekly summaries, '
    + 'theme tracking, memory link discovery, pattern analysis, '
    + 'and proactive questioning for self-reflection.',
  tools: [
    // 周度总结
    'curation_tool_fetch_weekly_data',
    'curation_tool_save_weekly_summary',
    // 主题管理
    'theme_tool_query', 'theme_tool_add', 'theme_tool_update',
    'theme_tool_item_add', 'theme_tool_item_remove',
    // 记忆关联
    'memory_link_tool_query', 'memory_link_tool_suggest',
    'memory_link_tool_add', 'memory_link_tool_update',
    // 通用策展
    'common_tool_ask', 'journal_tool_query',
    'notes_tool_query', 'snippets_tool_query',
  ],
}
```

### 4.2 增强 System Prompt

修改 `src/main/ipc/aiHandlers.ts` → `createSystemPrompt()`，**追加策展指令**：

```
## Curation Agent Guidelines
When the user invokes the curation agent (@curation) or shows curation
intent (review, reflection, pattern discovery, "what's going on with..."):

1. Weekly Review: Generate structured summaries covering completion rate,
   emotional fluctuations, key events, and repeating themes across the week.

2. Theme Tracking: Extract long-term themes from notes, journals, and
   snippets. Track narrative evolution across time. Proactively suggest
   themes when you notice patterns.

3. Memory Connections: Discover semantic connections between temporally
   distant entries. Link ideas, emotions, or reflections that echo each
   other even if the user hasn't noticed.

4. Proactive Questioning: After presenting analysis, ask 1-2 follow-up
   questions to deepen the user's self-understanding. The goal is not
   to inform but to provoke reflection.
```

### 4.3 工具整合

修改 `src/main/agent/tools/toolRegistry.ts`：

- `AgentToolRegistryContext` 新增 `themesService` / `memoryLinksService`
- `builtinToolFactories` 新增 `themeTools` / `memoryLinkTools` factories

修改 `src/main/ipc/aiHandlers.ts`：

- `registerAiHandlers` 中创建 `themesService` / `memoryLinksService` 实例
- 注入到 `createAgentToolRegistry` 的 context
- 处理 `curation` agent 的工具过滤（非 curation agent 时排除策展工具）

### 4.4 ask tool 增强

修改 `src/main/agent/tools/askTool.ts`：

- 当模型发出 ask，且当前对话包含策展意图时 → 在 ask 文本中追加引导性提问
- ask 模板在策展路径下提供更结构化的选项（多选而非自由文本）

---

## 文件变更汇总

| 阶段        | 新文件                                                       | 修改文件 | 关键风险                                |
| ----------- | ------------------------------------------------------------ | -------- | --------------------------------------- |
| **Phase 1** | 2 (`weeklySummaryService`, `weeklyHandlers`)                 | 5        | 低 — 独立功能，不影响现有逻辑           |
| **Phase 2** | 3 (`themesService`, `themesHandlers`, `themeTool`)           | 6        | 中 — 新增 2 张表，需要处理数据迁移      |
| **Phase 3** | 3 (`memoryLinksService`, `memoryHandlers`, `memoryLinkTool`) | 6        | 中高 — `suggest` 工具的搜索算法需要调优 |
| **Phase 4** | 0                                                            | 4        | 低 — 在已有 Agent 系统上扩展            |

**总计**：8 个新文件，约 15 个修改文件。

---

## 风险与对策

| 风险                                        | 对策                                                                                      |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| LLM 对中文策展的生成质量不稳定              | system prompt 中文示例 + temperature 调低 + 可选 re-generation                            |
| `memory_link_tool_suggest` 跨类型搜索性能差 | 限制搜索范围（近 6 个月）+ 候选上限 20 条 + LLM 二次筛选                                  |
| 数据库迁移（新增 4 张表）                   | Drizzle 的 `ALTER TABLE` 限制，使用 `CREATE TABLE IF NOT EXISTS` 而非迁移，不破坏现有数据 |
| Weekly summary 生成 token 消耗大            | 构造 prompt 时限制每天数据的摘要长度（各 500 字以内），total context < 8K tokens          |
| 策展工具的确认逻辑影响 UX                   | 写操作保留确认机制（Phase 2-3），只读操作直接执行                                         |

---

## 依赖关系图

```
Phase 1 (独立，无依赖)
  │
  ├──→ Phase 2 (独立，可并行)
  │     │
  │     └──→ Phase 4 (依赖 Phase 2/3 的工具)
  │
  └──→ Phase 3 (独立，可并行)
        │
        └──→ Phase 4
```

Phase 2 和 Phase 3 互不依赖，可在 Phase 1 完成后并行推进。

---
